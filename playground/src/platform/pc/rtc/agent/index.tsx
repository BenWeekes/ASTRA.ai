"use client"

import { useAppSelector, useMultibandTrackVolume } from "@/common"
import { TrulienceAvatar } from "trulience-sdk";
import { IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import styles from "./index.module.scss";
import { useRef, useState, useEffect } from "react";

interface AgentProps {
  audioTrack?: IMicrophoneAudioTrack
}

const Agent = (props: AgentProps) => {
  const { audioTrack } = props
  const trulienceAvatarRef = useRef(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const agentConnected = useAppSelector(state => state.global.agentConnected)

  useEffect(() => {
    if (trulienceAvatarRef.current) {
      trulienceAvatarRef.current.setMediaStream(mediaStream);
    } else {
      console.log("Not Calling setMediaStream");
    }
  }, [mediaStream])

  useEffect(() => {
    // Process media stream only if Agent connected.
    if (agentConnected) {
      if (audioTrack && !mediaStream) {
        audioTrack.setVolume(0);
        const stream = new MediaStream([audioTrack.getMediaStreamTrack()]);
        setMediaStream(stream);        
      } else {
        setMediaStream(null);
      }
      return () => {
        setMediaStream(null);
      };
    }
  }, [audioTrack, agentConnected]);

  // Sample for listening to truilence notifications.
  // Refer https://trulience.com/docs#/client-sdk/sdk?id=trulience-events for a list of all the events fired by Trulience SDK.
  const authSuccessHandler = (resp: string) => {
    console.log("In Agent authSuccessHandler2 resp = ", resp);
  }
  const eventCallbacks = [
    {"auth-success" : authSuccessHandler}
  ]

  return (
    <div className={styles.agent}>
      <TrulienceAvatar
        url={process.env.NEXT_PUBLIC_trulienceSDK}
        ref={trulienceAvatarRef}
        avatarId={process.env.NEXT_PUBLIC_avatarId}
        token={process.env.NEXT_PUBLIC_avatarToken} 
        evenCallbacks={eventCallbacks}
        width="100%"
        height="100%"
        sttSource=""
      >
      </TrulienceAvatar>
    </div>
  )
}
export default Agent;