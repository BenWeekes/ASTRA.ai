"use client"

import { useAppSelector, useMultibandTrackVolume } from "@/common"
import { TrulienceAvatar } from 'trulience-sdk';
import { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import styles from "./index.module.scss";
import { useRef, useState, useEffect } from "react";
import { rtcManager } from "@/manager";
import { ITextItem } from "@/types";

interface AgentProps {
  audioTrack?: IMicrophoneAudioTrack
}

const Agent = (props: AgentProps) => {
  // Get the received audio track from parent component
  const { audioTrack } = props;

  // Maintain a ref to the Trulience Avatar component to call methods on it.
  const trulienceAvatarRef = useRef<TrulienceAvatar | null>(null);

  // Keep track of the media stream created from the audio track
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Keep track of the agent connection status.
  const agentConnected = useAppSelector(state => state.global.agentConnected)
  const options = useAppSelector(state => state.global.options)
  const { userId } = options

  // Forward the received messages to avatar.
  rtcManager.on("textChanged", (textItem: ITextItem) => {
    if (textItem.isFinal && textItem.dataType == "transcribe") {
      const isAgent = Number(textItem.uid) != Number(userId);
      if (isAgent) {
        let trulienceObj = trulienceAvatarRef.current?.getTrulienceObject();
        console.log("Sending message to avatar - " + textItem.text);
        trulienceObj?.sendMessage(textItem.text);
      }
    }
  });

  // Provide the media stream to the TrulienceAvatar component.
  useEffect(() => {
    // Check if the ref is set and call a method on it
    if (trulienceAvatarRef.current) {
      console.log("Setting MediaStream on TrulienceAvatar");

      // Set the media stream to make avatar speak the text.
      trulienceAvatarRef.current?.setMediaStream(mediaStream);
    } else {
      console.log("Not Calling setMediaStream");
    }
  }, [mediaStream])

  useEffect(() => {
    // Make sure we create media stream only if not available.
    if (audioTrack && !mediaStream && agentConnected) {
      audioTrack.setVolume(0);

      // Create and set the media stream object.
      const stream = new MediaStream([audioTrack.getMediaStreamTrack()]);
      setMediaStream(stream);
      console.log("Created MediaStream = ", stream);
    } else {
      console.log("Setting mediaStream null");
      setMediaStream(null);
    }
    return () => {
      console.log("Cleanup - setting mediastream null");
      setMediaStream(null);
    };
  }, [audioTrack, agentConnected]);

  // Sample for listening to truilence notifications.
  // Refer https://trulience.com/docs#/client-sdk/sdk?id=trulience-events for a list of all the events fired by Trulience SDK.
  const authSuccessHandler = (resp: string) => {
    console.log("In Agent authSuccessHandler resp = ", resp);
  }

  // Event Callbacks list
  const eventCallbacks = [
    { "auth-success": authSuccessHandler }
  ]

  return (
    <div className={styles.agent}>
      <TrulienceAvatar
        url={process.env.NEXT_PUBLIC_trulienceSDK}
        ref={trulienceAvatarRef}
        avatarId={process.env.NEXT_PUBLIC_avatarId ? process.env.NEXT_PUBLIC_avatarId : ""}
        token={process.env.NEXT_PUBLIC_avatarToken}
        eventCallbacks={eventCallbacks}
        width="100%"
        height="100%"
        sttSource=""
        ttsEnabled={false}
      >
      </TrulienceAvatar>
    </div>
  )
}
export default Agent;