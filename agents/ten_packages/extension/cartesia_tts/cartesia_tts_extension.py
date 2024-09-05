# cartesia_tts_extension.py

import queue
import threading
from datetime import datetime
import asyncio
from ten import (
    Extension,
    TenEnv,
    Cmd,
    AudioFrameDataFmt,
    AudioFrame,
    Data,
    StatusCode,
    CmdResult,
)
from .cartesia_wrapper import CartesiaWrapper, CartesiaConfig
from .log import logger

class CartesiaCallback:
    # Handles audio processing and interrupt checks
    def __init__(self, ten: TenEnv, sample_rate: int, need_interrupt_callback):
        self.ten = ten
        self.sample_rate = sample_rate
        self.need_interrupt_callback = need_interrupt_callback
        self.ts = datetime.now()

    def set_input_ts(self, ts: datetime):
        # Updates timestamp for the current input
        self.ts = ts

    def need_interrupt(self) -> bool:
        # Checks if current task should be interrupted
        return self.need_interrupt_callback(self.ts)

    def create_audio_frame(self, audio_data):
        # Creates an AudioFrame from raw audio data
        frame = AudioFrame.create("pcm_frame")
        frame.set_sample_rate(self.sample_rate)
        frame.set_bytes_per_sample(2)  # s16le is 2 bytes per sample
        frame.set_number_of_channels(1)
        frame.set_data_fmt(AudioFrameDataFmt.INTERLEAVE)
        frame.set_samples_per_channel(len(audio_data) // 2)
        frame.alloc_buf(len(audio_data))
        buff = frame.lock_buf()
        buff[:] = audio_data
        frame.unlock_buf(buff)
        return frame

    def process_audio(self, audio_data):
        # Processes audio data if not interrupted
        if self.need_interrupt():
            return
        audio_frame = self.create_audio_frame(audio_data)
        self.ten.send_audio_frame(audio_frame)

class CartesiaTTSExtension(Extension):
    def __init__(self, name: str):
        super().__init__(name)
        self.cartesia = None
        self.loop = None
        self.queue = queue.Queue()
        self.outdate_ts = datetime.now()
        self.stopped = False
        self.thread = None
        self.callback = None

    def on_start(self, ten: TenEnv) -> None:
        try:
            # Initialize Cartesia config and wrapper
            cartesia_config = CartesiaConfig(
                api_key=ten.get_property_string("api_key"),
                model_id=ten.get_property_string("model_id"),
                voice_id=ten.get_property_string("voice_id"),
                sample_rate=int(ten.get_property_string("sample_rate")),
                cartesia_version=ten.get_property_string("cartesia_version")
            )
            self.cartesia = CartesiaWrapper(cartesia_config)
            self.callback = CartesiaCallback(ten, cartesia_config.sample_rate, self.need_interrupt)

            # Set up asyncio event loop
            self.loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self.loop)

            # Connect to Cartesia API
            self.loop.run_until_complete(self.cartesia.connect())
            logger.info("Successfully connected to Cartesia API")

            # Start async handling thread
            self.thread = threading.Thread(target=self.async_handle, args=[ten])
            self.thread.start()

            ten.on_start_done()
        except Exception as e:
            logger.error(f"Failed to start CartesiaTTSExtension: {e}")
            ten.on_start_done(success=False)

    def on_stop(self, ten: TenEnv) -> None:
        # Clean up resources and stop thread
        self.stopped = True
        self.flush()
        self.queue.put(None)
        if self.thread is not None:
            self.thread.join()
            self.thread = None

        if self.cartesia:
            self.loop.run_until_complete(self.cartesia.close())
        if self.loop:
            self.loop.close()
        ten.on_stop_done()

    def need_interrupt(self, ts: datetime) -> bool:
        # Check if task is outdated
        return self.outdate_ts > ts

    def async_handle(self, ten: TenEnv):
        # Process queue items asynchronously
        while not self.stopped:
            try:
                value = self.queue.get()
                if value is None:
                    break
                input_text, ts = value

                self.callback.set_input_ts(ts)

                if self.callback.need_interrupt():
                    logger.info("Drop outdated input")
                    continue

                logger.info(f"Processing input: {input_text}")

                audio_data = self.loop.run_until_complete(self.cartesia.synthesize(input_text))
                self.callback.process_audio(audio_data)

            except Exception as e:
                logger.exception(f"Error in async_handle: {e}")

    def on_data(self, ten: TenEnv, data: Data) -> None:
        # Queue incoming text for processing
        input_text = data.get_property_string("text")
        if not input_text:
            return
        self.queue.put((input_text, datetime.now()))

    def on_cmd(self, ten: TenEnv, cmd: Cmd) -> None:
        # Handle incoming commands
        cmd_name = cmd.get_name()

        if cmd_name == "flush":
            self.outdate_ts = datetime.now()
            self.flush()
            cmd_result = CmdResult.create(StatusCode.OK)
            cmd_result.set_property_string("detail", "Flush command executed")
        else:
            logger.warning(f"Unknown command received: {cmd_name}")
            cmd_result = CmdResult.create(StatusCode.ERROR)
            cmd_result.set_property_string("detail", f"Unknown command: {cmd_name}")

        ten.return_result(cmd_result, cmd)

    def flush(self):
        # Clear the queue
        while not self.queue.empty():
            self.queue.get()
