# deepgram_asr_extension.py

from ten import (
    Extension,
    TenEnv,
    Cmd,
    AudioFrame,
    StatusCode,
    CmdResult,
    Data,
)
import asyncio
import threading
import queue
from .log import logger
from .deepgram_wrapper import AsyncDeepgramWrapper, DeepgramConfig

# Property names for configuration
PROPERTY_API_KEY = "api_key"
PROPERTY_SAMPLE_RATE = "sample_rate"
PROPERTY_LANGUAGE = "language"
PROPERTY_MODEL = "model"
PROPERTY_USER_AUDIO_SAMPLE_RATE = "user_audio_sample_rate"
PROPERTY_USER_AUDIO_CHANNELS = "user_audio_channels"
PROPERTY_USER_STREAM_ID = "user_stream_id"

# Property names expected by downstream extensions
DATA_OUT_TEXT_DATA_PROPERTY_TEXT = "text"
DATA_OUT_TEXT_DATA_PROPERTY_IS_FINAL = "is_final"
DATA_OUT_TEXT_DATA_PROPERTY_STREAM_ID = "stream_id"
DATA_OUT_TEXT_DATA_PROPERTY_END_OF_SEGMENT = "end_of_segment"


class DeepgramASRExtension(Extension):
    def __init__(self, name: str):
        super().__init__(name)
        self.stopped = False
        self.queue = asyncio.Queue(maxsize=3000)
        self.deepgram = None
        self.user_audio_sample_rate = None
        self.user_audio_channels = None
        self.ten = None  # Store the TenEnv instance
        self.transcription_queue = queue.Queue()
        self.user_stream_id = 0  # Default value if not set
        self.stream_id = 0  # Will be set based on audio source

        # Start the event loop in a separate thread for Deepgram
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.run_event_loop)
        self.thread.start()

    def run_event_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def on_start(self, ten: TenEnv) -> None:
        logger.info("DeepgramASRExtension on_start")
        self.ten = ten  # Store the TenEnv instance

        deepgram_config = DeepgramConfig.default_config()

        # Get API key (required)
        deepgram_config.api_key = ten.get_property_string(PROPERTY_API_KEY)
        logger.info(f"Using Deepgram API key: {deepgram_config.api_key[:5]}...")

        # Get optional parameters
        for optional_param in [PROPERTY_SAMPLE_RATE, PROPERTY_LANGUAGE, PROPERTY_MODEL]:
            try:
                value = ten.get_property_string(optional_param).strip()
                if value:
                    setattr(deepgram_config, optional_param, value)
                logger.info(f"Deepgram config {optional_param}: {getattr(deepgram_config, optional_param)}")
            except Exception as err:
                logger.warning(
                    f"GetProperty optional {optional_param} failed, err: {err}. Using default value: {getattr(deepgram_config, optional_param)}"
                )

        # Get user audio properties
        try:
            self.user_audio_sample_rate = ten.get_property_int(PROPERTY_USER_AUDIO_SAMPLE_RATE)
            self.user_audio_channels = ten.get_property_int(PROPERTY_USER_AUDIO_CHANNELS)
            logger.info(f"User audio properties set to: sample_rate={self.user_audio_sample_rate}, channels={self.user_audio_channels}")
        except Exception as err:
            logger.warning(f"Failed to get user audio properties: {err}. All audio will be processed as user audio.")

        # Get user stream ID
        try:
            self.user_stream_id = ten.get_property_int(PROPERTY_USER_STREAM_ID)
            logger.info(f"User stream ID set to: {self.user_stream_id}")
        except Exception as err:
            logger.warning(f"Failed to get user stream ID: {err}. Using default value 0.")
            self.user_stream_id = 0  # Default to 0 if not set

        # Additional Deepgram configuration for endpointing
        deepgram_config.additional_config = {
            'endpointing': True,
            'vad_turnoff': 500,       # Amount of silence (in ms) before considering speech ended
            'time_before_idle': 500   # Time (in ms) before Deepgram sends final transcription
        }

        self.deepgram = AsyncDeepgramWrapper(
            deepgram_config, self.queue, self
        )

        logger.info("Starting AsyncDeepgramWrapper")
        asyncio.run_coroutine_threadsafe(self.deepgram.transcribe_loop(), self.loop)

        ten.on_start_done()

    def is_user_audio(self, frame: AudioFrame) -> bool:
        if self.user_audio_sample_rate is None or self.user_audio_channels is None:
            return True  # Assume all audio is user audio

        return (frame.get_sample_rate() == self.user_audio_sample_rate and
                frame.get_number_of_channels() == self.user_audio_channels)

    def put_pcm_frame(self, pcm_frame: AudioFrame, is_user_audio: bool) -> None:
        try:
            asyncio.run_coroutine_threadsafe(
                self.queue.put((pcm_frame, is_user_audio)), self.loop
            ).result(timeout=0.1)
        except asyncio.QueueFull:
            logger.exception("Queue is full, dropping frame")
        except Exception as e:
            logger.exception(f"Error putting frame in queue: {e}")

    def on_audio_frame(self, ten: TenEnv, frame: AudioFrame) -> None:
        is_user_audio = self.is_user_audio(frame)
        frame_buf = frame.get_buf()

        if frame_buf is None or len(frame_buf) == 0:
            logger.warning("Received empty audio frame buffer")
            return

        self.put_pcm_frame(pcm_frame=frame, is_user_audio=is_user_audio)

        # Set stream_id based on is_user_audio
        if is_user_audio:
            self.stream_id = self.user_stream_id  # Use the user_stream_id
        else:
            self.stream_id = 0  # Agent or other

        # Process the transcription queue in the main thread
        self.process_transcription_queue()

    def on_data(self, ten: TenEnv, data: Data) -> None:
        # Handle incoming data as needed (if applicable)
        ten.on_data_done()

    def on_stop(self, ten: TenEnv) -> None:
        logger.info("DeepgramASRExtension on_stop")

        # Stop the Deepgram wrapper
        self.deepgram.stopped = True

        # Stop the event loop
        self.loop.call_soon_threadsafe(self.loop.stop)
        self.thread.join()

        ten.on_stop_done()

    def on_cmd(self, ten: TenEnv, cmd: Cmd) -> None:
        logger.info("DeepgramASRExtension on_cmd")
        cmd_json = cmd.to_json()
        logger.info("DeepgramASRExtension on_cmd json: " + cmd_json)

        cmd_name = cmd.get_name()
        logger.info(f"Received cmd {cmd_name}")

        # Return command result
        cmd_result = CmdResult.create(StatusCode.OK)
        cmd_result.set_property_string("detail", "success")
        ten.return_result(cmd_result, cmd)

    def send_transcription_data(self, text: str, is_final: bool, is_user: bool):
        # Queue the transcription data to be processed
        self.transcription_queue.put((text, is_final, is_user))

    def process_transcription_queue(self):
        while not self.transcription_queue.empty():
            text, is_final, is_user = self.transcription_queue.get()
            if self.ten:
                # Skip sending data if text is empty
                if not text.strip():
                    logger.warning("Attempted to send data with empty text. Skipping.")
                    continue

                # Determine end_of_segment based on is_final
                end_of_segment = is_final  # True if final, False otherwise

                # Create data with the correct type expected by downstream extensions
                data = Data.create("text_data")
                data.set_property_string(DATA_OUT_TEXT_DATA_PROPERTY_TEXT, text)
                data.set_property_bool(DATA_OUT_TEXT_DATA_PROPERTY_IS_FINAL, is_final)
                data.set_property_int(DATA_OUT_TEXT_DATA_PROPERTY_STREAM_ID, self.stream_id)
                data.set_property_bool(DATA_OUT_TEXT_DATA_PROPERTY_END_OF_SEGMENT, end_of_segment)

                # Log the data being sent for debugging
                logger.debug(f"Data being sent: {data.to_json()}")

                try:
                    # Send the data and log the result
                    result = self.ten.send_data(data)
                    if result:
                        logger.info(f"Successfully sent transcription data: is_final={is_final}, stream_id={self.stream_id}, text='{text}'")
                    else:
                        logger.error(f"Failed to send transcription data: is_final={is_final}, stream_id={self.stream_id}, text='{text}'")
                except Exception as e:
                    logger.exception(f"Exception occurred while sending data: {e}")
            else:
                logger.error("TenEnv instance not available. Cannot send transcription data.")
