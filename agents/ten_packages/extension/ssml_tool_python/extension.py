#
#
# Agora Real Time Engagement
# Created by Wei Hu in 2024-08.
# Copyright (c) 2024 Agora IO. All rights reserved.
#
#

import json
import requests

from typing import Any

from ten import (
    AudioFrame,
    VideoFrame,
    Extension,
    TenEnv,
    Cmd,
    StatusCode,
    CmdResult,
    Data,
)
from .log import logger

CMD_TOOL_REGISTER = "tool_register"
CMD_TOOL_CALL = "tool_call"
CMD_PROPERTY_NAME = "name"
CMD_PROPERTY_ARGS = "args"

TOOL_REGISTER_PROPERTY_NAME = "name"
TOOL_REGISTER_PROPERTY_DESCRIPTON = "description"
TOOL_REGISTER_PROPERTY_PARAMETERS = "parameters"

TOOL_NAME = "set_ssml"
TOOL_DESCRIPTION = "Determine ssml to run in client"
TOOL_PARAMETERS = {
        "type": "object",
        "properties": {
            "ssml": {
                "type": "string",
                "description": "e.g. BACKGROUND, DANCE, MUSIC "
            }
        },
        "required": ["ssml"],
    }

PROPERTY_API_KEY = "api_key"  # Required

class SSMLToolExtension(Extension):
    api_key: str = ""
    ten_env: Any = None

    def on_init(self, ten_env: TenEnv) -> None:
        self.ten_env = ten_env
        logger.info("SSMLToolExtension on_init")
        ten_env.on_init_done()

    def on_start(self, ten_env: TenEnv) -> None:
        logger.info("SSMLToolExtension on_start")

        try:
            api_key = ten_env.get_property_string(PROPERTY_API_KEY)
            self.api_key = api_key
        except Exception as err:
            logger.info(
                f"GetProperty required {PROPERTY_API_KEY} failed, err: {err}")
            return

        # Register func
        c = Cmd.create(CMD_TOOL_REGISTER)
        c.set_property_string(TOOL_REGISTER_PROPERTY_NAME, TOOL_NAME)
        c.set_property_string(TOOL_REGISTER_PROPERTY_DESCRIPTON, TOOL_DESCRIPTION)
        c.set_property_string(TOOL_REGISTER_PROPERTY_PARAMETERS, json.dumps(TOOL_PARAMETERS))
        ten_env.send_cmd(c, lambda ten, result: logger.info(f"register done, {result}"))

        ten_env.on_start_done()

    def on_stop(self, ten_env: TenEnv) -> None:
        logger.info("SSMLToolExtension on_stop")

        ten_env.on_stop_done()

    def on_deinit(self, ten_env: TenEnv) -> None:
        logger.info("SSMLToolExtension on_deinit")
        ten_env.on_deinit_done()

    def on_cmd(self, ten_env: TenEnv, cmd: Cmd) -> None:
        cmd_name = cmd.get_name()
        logger.info(f"on_cmd name {cmd_name} {cmd.to_json()}")

        try:
            name = cmd.get_property_string(CMD_PROPERTY_NAME)
            if name == TOOL_NAME:
                try:
                    args = cmd.get_property_string(CMD_PROPERTY_ARGS)
                    arg_dict = json.loads(args)
                    if "ssml" in arg_dict:
                        logger.info(f"before get current ssml {name}")
                        resp = self._set_ssml(arg_dict["ssml"])
                        logger.info(f"after get current ssml {resp}")
                        cmd_result = CmdResult.create(StatusCode.OK)
                        cmd_result.set_property_string("response", json.dumps(resp))
                        ten_env.return_result(cmd_result, cmd)
                        return
                    else:
                        logger.error(f"no ssml in args {args}")
                        cmd_result = CmdResult.create(StatusCode.ERROR)
                        ten_env.return_result(cmd_result, cmd)
                        return
                except:
                    logger.exception("Failed to get ssml")
                    cmd_result = CmdResult.create(StatusCode.ERROR)
                    ten_env.return_result(cmd_result, cmd)
                    return
            else:
                logger.error(f"unknown tool name {name}")
        except:
            logger.exception("Failed to get tool name")
            cmd_result = CmdResult.create(StatusCode.ERROR)
            ten_env.return_result(cmd_result, cmd)
            return
            
        cmd_result = CmdResult.create(StatusCode.OK)
        ten_env.return_result(cmd_result, cmd)

    def on_data(self, ten_env: TenEnv, data: Data) -> None:
        pass

    def on_audio_frame(self, ten_env: TenEnv, audio_frame: AudioFrame) -> None:
        pass

    def on_video_frame(self, ten_env: TenEnv, video_frame: VideoFrame) -> None:
        pass

    def _set_ssml(self, ssml:str) -> Any:
        logger.error(f"BenSet SSML {ssml}")
        try:
            d = Data.create("text_data")
            d.set_property_string("text", f"SSML_{ssml}")
            d.set_property_bool("end_of_segment", True)
            stream_id = 0
            d.set_property_int("stream_id", stream_id)
            d.set_property_bool("is_final", True)
            logger.debug(
                f"send SSML text {ssml}")
            self.ten_env.send_data(d)
        except:
            logger.exception(
                f"Error send SSML")

        return "OK"
