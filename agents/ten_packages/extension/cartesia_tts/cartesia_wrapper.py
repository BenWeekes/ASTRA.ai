# cartesia_wrapper.py

import asyncio
import websockets
import json
import base64
import logging
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CartesiaConfig:
    # Configuration class for Cartesia API
    def __init__(self, api_key, model_id, voice_id, sample_rate, cartesia_version):
        # Initialize configuration parameters
        self.api_key = api_key
        self.model_id = model_id
        self.voice_id = voice_id
        self.sample_rate = sample_rate
        self.cartesia_version = cartesia_version

class CartesiaWrapper:
    # Wrapper class for Cartesia API interactions
    def __init__(self, config: CartesiaConfig):
        # Initialize wrapper with configuration
        self.config = config
        self.websocket = None
        self.context_id = 0

    async def connect(self):
        # Establish WebSocket connection to Cartesia API
        ws_url = f"wss://api.cartesia.ai/tts/websocket?api_key={self.config.api_key}&cartesia_version={self.config.cartesia_version}"
        try:
            self.websocket = await websockets.connect(ws_url)
            logger.info("Connected to Cartesia WebSocket")
        except Exception as e:
            logger.error(f"Failed to connect to Cartesia API: {str(e)}")
            raise

    async def synthesize(self, text):
        # Synthesize speech from text using Cartesia API
        if not self.websocket:
            await self.connect()

        self.context_id += 1
        request = {
            "context_id": f"context_{self.context_id}",
            "model_id": self.config.model_id,
            "transcript": text,
            "voice": {"mode": "id", "id": self.config.voice_id},
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": int(self.config.sample_rate)
            },
            "language": "en",
            "add_timestamps": False
        }

        try:
            # Send synthesis request
            await self.websocket.send(json.dumps(request))

            # Receive and process audio chunks
            audio_data = bytearray()
            while True:
                response = await self.websocket.recv()
                message = json.loads(response)

                if message['type'] == 'chunk':
                    chunk_data = base64.b64decode(message['data'])
                    audio_data.extend(chunk_data)
                elif message['type'] == 'done':
                    break
                else:
                    logger.warning(f"Unknown message type: {message['type']}")

            return audio_data
        except websockets.exceptions.ConnectionClosed:
            # Handle connection errors and retry
            logger.error("WebSocket connection closed unexpectedly. Attempting to reconnect...")
            await self.connect()
            return await self.synthesize(text)  # Retry the synthesis after reconnecting
        except Exception as e:
            logger.error(f"Error during synthesis: {str(e)}")
            raise

    async def close(self):
        # Close WebSocket connection
        if self.websocket:
            await self.websocket.close()
            logger.info("Closed WebSocket connection to Cartesia API")

    async def send_heartbeat(self):
        # Send heartbeat message to keep connection alive
        if self.websocket:
            try:
                await self.websocket.send(json.dumps({"type": "heartbeat"}))
                logger.debug("Heartbeat sent")
            except Exception as e:
                logger.error(f"Failed to send heartbeat: {str(e)}")

    async def start_heartbeat(self, interval=30):
        # Start periodic heartbeat sending
        while True:
            await asyncio.sleep(interval)
            await self.send_heartbeat()
