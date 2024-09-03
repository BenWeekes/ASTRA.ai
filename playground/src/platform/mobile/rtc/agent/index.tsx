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
    // Check if the ref is set and call a method on it
    if (trulienceAvatarRef.current) {
      console.log("Calling setMediaStream");
      
      // Set the media stream to make avatar speak the text.
      trulienceAvatarRef.current.setMediaStream(mediaStream);
    } else {
      console.log("Not Calling setMediaStream");
    }
  }, [mediaStream])

  useEffect(() => {
    // Process media stream only if Agent connected.
    if (agentConnected) {

      // Make sure we create media stream only if not available.
      if (audioTrack && !mediaStream) {
        console.log("Audiotrack not null");

        // Set volume 0 to avoid echo.
        // TODO : check if can be done internally.
        audioTrack.setVolume(0);

        // Create and set the media stream object.
        const stream = new MediaStream([audioTrack.getMediaStreamTrack()]);
        setMediaStream(stream)

;
        console.log("In useEffect setMediaStream = ", stream);
      } else {
        console.log("In else setting mediaStream null");
        setMediaStream(null);
      }
      return () => {
        console.log("In useEffect.audioTrack - return setting mediastream null");
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
        url="https://digitalhuman.uk/home/assets/trulience.sdk.js"
        ref={trulienceAvatarRef}
        avatarId="5192392938239836645"
        token="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJUb2tlbiBmcm9tIGN1c3RvbSBzdHJpbmciLCJleHAiOjQ4NzU0MDAzNTV9.YAD8AtI915qA2HZC21U2Arlpoi4wmJ91g5leb0Ez77irxQqogU-eHEBZJE40HtL777R33gchTfWxA8UhL4M_Eg"
        evenCallbacks={eventCallbacks}
        width="100%"
        height="100%"
      >
      </TrulienceAvatar>
    </div>
  )
}


export default Agent;
