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
  var animsLoaded=false;

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
        console.error("Received message for avatar - " + textItem.text); 
        let ssml="";
        if (textItem.text.includes('SSML_DANCE')) {
          ssml="<trl-anim type='core' id='BubblePop_Dance' />";
        } else if (textItem.text.includes('SSML_KISS')) {
          ssml="<trl-anim type='aux' id='kiss' audio='https://digitalhuman.uk/assets/audio/female/kiss.mp3' />";
        } else if (textItem.text.includes('SSML_CHANGE_BG')) {
          ssml="<trl-load-environment gltf-model='https://digitalhuman.uk/assets/environments/PsychedelicMountains.glb' position='0 0 0' rotation='0 0 0' scale='1 1 1' />";
        } else if (textItem.text.includes('SSML_CHANGE_MUSIC')) {
          ssml="<trl-play-background-audio audio='https://digitalhuman.uk/assets/audio/music/LoFiMusic.mp3' /> ";
        }
        if (ssml.length>0) {
          console.error("Play ssml " + ssml); 
          trulienceObj?.sendMessageToAvatar("<trl-load animations='https://digitalhuman.uk/assets/characters/Amie_Rigged_cmp/Amie_Dances.glb' />");
        }        
      }
    }
  });

  // Provide the media stream to the TrulienceAvatar component.
  useEffect(() => {
    // Check if the ref is set and call a method on it
    if (trulienceAvatarRef.current) {
      //window.tru=trulienceAvatarRef.current;
      //console.error("set window.tru=",trulienceAvatarRef.current);
    }
    if (trulienceAvatarRef.current) {
      console.error("Setting MediaStream on TrulienceAvatar",mediaStream );
      // Set the media stream to make avatar speak the text.
      trulienceAvatarRef.current?.setMediaStream(mediaStream);  
    } else {
      console.error("Not Calling setMediaStream");
    }
  }, [mediaStream])

  useEffect(() => {
    // Make sure we create media stream only if not available.
    if (audioTrack && !mediaStream && agentConnected) {
      audioTrack.setVolume(0);

      // Create and set the media stream object.
      const stream = new MediaStream([audioTrack.getMediaStreamTrack()]);
      setMediaStream(stream);
      console.error("Created MediaStream = ", stream);
    } else {
      console.error("Setting mediaStream null");
      setMediaStream(null);
    }
    return () => {
      console.error("Cleanup - setting mediastream null");
      setMediaStream(null);
    };
  }, [audioTrack, agentConnected]);

  
  // Sample for listening to truilence notifications.
  // Refer https://trulience.com/docs#/client-sdk/sdk?id=trulience-events for a list of all the events fired by Trulience SDK.
  const authSuccessHandler = (resp: string) => {
    console.error("In Agent authSuccessHandler resp = ", resp);
  }

  const websocketConnectHandler = (resp: string) => {
    //TrlDebug.webgl._trulienceObj.sendMessageToAvatar("<trl-anim type='core' id='BubblePop_Dance' />");

    console.error("In Agent websocketConnectHandler resp = ", resp);
    if (trulienceAvatarRef.current) {
      trulienceAvatarRef.current?.getTrulienceObject()?.sendMessageToAvatar("<trl-load animations='https://digitalhuman.uk/assets/characters/Amie_Rigged_cmp/Amie_Dances.glb' />");
      console.error("anims loaded in auth");
    }
  }

  const eventCallbacks = [
    //{"auth-success" : authSuccessHandler},
    {"websocket-connect" : websocketConnectHandler}
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