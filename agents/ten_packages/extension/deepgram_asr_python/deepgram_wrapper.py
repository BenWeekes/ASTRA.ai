# deepgram_wrapper.py
import asyncio
import websockets
from urllib.parse import urlencode
import json

from .log import logger

class DeepgramConfig:
    def __init__(self,
                 api_key: str,
                 sample_rate: int,
                 language: str,
                 model: str):
        self.api_key = api_key
        self.sample_rate = sample_rate
        self.language = language
        self.model = model

    @classmethod
    def default_config(cls):
        return cls(
            api_key="",
            sample_rate=16000,
            language='en-US',
            model='general'
        )

class AsyncDeepgramWrapper:
    def __init__(self, config: DeepgramConfig, queue: asyncio.Queue, extension):
        self.queue = queue
        self.extension = extension
        self.stopped = False
        self.config = config
        self.websocket = None

    async def create_connection(self):
        try:
            params = {
                'encoding': 'linear16',
                'sample_rate': self.config.sample_rate,
                'channels': 1,
                'language': self.config.language,
                'model': self.config.model,
                'punctuate': 'true',
                'interim_results': 'true'
            }
            url = f"wss://api.deepgram.com/v1/listen?{urlencode(params)}"

            logger.info(f"Connecting to Deepgram WebSocket: {url}")
            self.websocket = await websockets.connect(
                url,
                extra_headers={"Authorization": f"Token {self.config.api_key}"}
            )

            logger.info("Connected to Deepgram WebSocket")

            # Start a task to handle incoming messages
            asyncio.create_task(self.handle_messages())

        except Exception as e:
            logger.exception(f"Error creating Deepgram connection: {e}")
            return False

        return True

    async def handle_messages(self):
        try:
            logger.info("Starting to handle Deepgram messages")
            async for message in self.websocket:
                data = json.loads(message)
                logger.debug(f"Received message from Deepgram: {data}")
                if 'channel' in data:
                    channel = data['channel']
                    transcript = channel['alternatives'][0]
                    text = transcript.get('transcript', '')
                    is_final = channel.get('type') == 'final'
                    if text:
                        logger.info(f"Processing transcription: text='{text}', is_final={is_final}")
                        self.extension.send_transcription_data(text, is_final, True)  # Assuming all audio is user audio

                        # If this is a final transcription, let's log it clearly
                        if is_final:
                            logger.info(f"Received FINAL transcription: '{text}'")
                else:
                    logger.warning(f"Received message without 'channel' key: {data}")
        except websockets.exceptions.ConnectionClosed:
            logger.info("Deepgram WebSocket connection closed")
        except Exception as e:
            logger.exception(f"Error handling Deepgram messages: {e}")

    async def send_frame(self):
        while not self.stopped:
            try:
                item = await asyncio.wait_for(self.queue.get(), timeout=10.0)

                if item is None:
                    logger.warning("send_frame: exit due to None value got.")
                    return

                pcm_frame, is_user_audio = item
                frame_buf = pcm_frame.get_buf()
                if not frame_buf:
                    logger.warning("send_frame: empty pcm_frame detected.")
                    continue

                if not self.websocket:
                    logger.info("lazy init connection.")
                    if not await self.create_connection():
                        continue

                # Send the raw audio data directly
                await self.websocket.send(bytes(frame_buf))
                logger.debug(f"Sent audio frame: size={len(frame_buf)}, is_user_audio={is_user_audio}")
                self.queue.task_done()
            except asyncio.TimeoutError:
                if self.websocket:
                    await self.websocket.close()
                    self.websocket = None
                    logger.debug("send_frame: no data for 10s, will close current connection and create a new one when receiving new frame.")
                else:
                    logger.debug("send_frame: waiting for pcm frame.")
            except websockets.exceptions.ConnectionClosed:
                logger.warning("WebSocket connection closed. Attempting to reconnect...")
                self.websocket = None
            except Exception as e:
                logger.exception(f"Error in send_frame: {e}")

        logger.info("send_frame: exit due to self.stopped == True")

    async def transcribe_loop(self):
        try:
            logger.info("Starting transcribe loop")
            await self.send_frame()
        except Exception as e:
            logger.exception(f"Error in transcribe loop: {e}")
        finally:
            if self.websocket:
                await self.websocket.close()
            logger.info("Transcribe loop ended")
