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
  var lastChatTime = 0;
  var dance=0;
  var bg=0;
  var music=0;

  // Maintain a ref to the Trulience Avatar component to call methods on it.
  const trulienceAvatarRef = useRef<TrulienceAvatar | null>(null);

  // Keep track of the media stream created from the audio track
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Keep track of the agent connection status.
  const agentConnected = useAppSelector(state => state.global.agentConnected)
  const options = useAppSelector(state => state.global.options)
  const { userId } = options

  const animStrings = [
    "<trl-anim immediate='true' type='core' id='BubblePop_Dance' />",
    "<trl-anim immediate='true' type='core' id='OnTheFloor_Dance' />",
    "<trl-anim immediate='true' type='core' id='Routine_07' />",
    "<trl-anim immediate='true' type='core' id='Shuffle_CrossLimbs_F' />"
  ];

  const bgStrings = [
    "<trl-load-environment immediate='true' gltf-model='https://digitalhuman.uk/assets/environments/GraffitiWarehouse.glb' position='0 0 0' rotation='0 0 0' scale='1 1 1' />",
    "<trl-load-environment immediate='true' gltf-model='https://digitalhuman.uk/assets/environments/ColorfulSunsetBeach.glb' position='0 0 0' rotation='0 0 0' scale='1 1 1' />",
    "<trl-load-environment immediate='true' gltf-model='https://digitalhuman.uk/assets/environments/NorthernLightsForest.glb' position='0 0 0' rotation='0 0 0' scale='1 1 1' />",
    "<trl-load-environment immediate='true' gltf-model='https://digitalhuman.uk/assets/environments/PsychedelicMountains.glb' position='0 0 0' rotation='0 0 0' scale='1 1 1' />"
  ];

  const musicString = [
    "<trl-play-background-audio immediate='true' volume='0.1' audio='https://digitalhuman.uk/assets/audio/music/LoFiMusic.mp3' />",
    "<trl-play-background-audio immediate='true' volume='0.1' audio='https://digitalhuman.uk/assets/audio/music/DanceMusic.mp3' />",
    "<trl-play-background-audio immediate='true' volume='0.1' audio='https://digitalhuman.uk/assets/audio/music/LoFiMusic.mp3' />",
    "<trl-play-background-audio immediate='true' volume='0.1' audio='https://digitalhuman.uk/assets/audio/music/LoFiMusic.mp3' />"
  ];

  function getDance() {
    let ret=animStrings[dance++]
    if (dance>animStrings.length-1){
      dance=0;
    }
    return ret;
  }

  function getMusic() {
    let ret=musicString[music++]
    if (music>musicString.length-1){
      music=0;
    }
    return ret;
  }

  function getBG() {
    let ret=bgStrings[bg++]
    if (bg>bgStrings.length-1){
      dance=0;
    }
    return ret;
  }

  // Forward the received messages to avatar.
  //console.error(' time to  add listener?', trulienceAvatarRef.current);
  if (trulienceAvatarRef.current == null) {
    console.error('adding listener', trulienceAvatarRef);
    rtcManager.on("textChanged", (textItem: ITextItem) => {
      if (textItem.isFinal && textItem.dataType == "transcribe" && textItem.time != lastChatTime) {
        const isAgent = Number(textItem.uid) != Number(userId);
        if (isAgent) {
          let trulienceObj = trulienceAvatarRef.current?.getTrulienceObject();
          //console.error("Received message for avatar - ", lastChatTime, textItem.time);
          lastChatTime = textItem.time;
          let ssml = "";
          if (textItem.text.includes('SSML_DANCE')) {
            ssml = getDance();
          } else if (textItem.text.includes('SSML_KISS')) {
            ssml = "<trl-anim immediate='true' type='aux' id='kiss' audio='https://digitalhuman.uk/assets/audio/female/kiss.mp3' />";
          } else if (textItem.text.includes('SSML_CHANGE_BG')) {
            ssml = getBG();
          } else if (textItem.text.includes('SSML_CHANGE_MUSIC')) {
            ssml = getMusic();
          } else if (textItem.text.includes('SSML_MUSIC_STOP')) {
            ssml = "<trl-stop-background-audio immediate='true' />";
          }

          if (ssml.length > 0) {
            console.error("Play ssml " + ssml);
            trulienceObj?.sendMessageToAvatar(ssml);
          }
        }
      }
    });
  }

  // Provide the media stream to the TrulienceAvatar component.
  useEffect(() => {
    // Check if the ref is set and call a method on it
    if (trulienceAvatarRef.current) {
      console.error("Setting MediaStream on TrulienceAvatar 1", mediaStream);
      // Set the media stream to make avatar speak the text.
      trulienceAvatarRef.current?.setMediaStream(null);
      trulienceAvatarRef.current?.setMediaStream(mediaStream);
    } else {
      console.error("Not Calling setMediaStream");
    }
  }, [mediaStream])

  useEffect(() => {
    // Make sure we create media stream only if not available.
    console.error('audioTrack',audioTrack);
    if (audioTrack && !mediaStream && agentConnected) {
      //audioTrack.setVolume(0);
      // Create and set the media stream object.
      const stream = new MediaStream([audioTrack.getMediaStreamTrack()]);
      setMediaStream(stream);
      console.error("Created MediaStream = ", stream, audioTrack);
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
    console.log("In callback authSuccessHandler resp = ", resp);
  }

  const websocketConnectHandler = (resp: string) => {
    //TrlDebug.webgl._trulienceObj.sendMessageToAvatar("<trl-anim type='core' id='BubblePop_Dance' />");

    console.error("In callback websocketConnectHandler resp = ", resp);
    if (trulienceAvatarRef.current) {
      trulienceAvatarRef.current?.getTrulienceObject()?.sendMessageToAvatar("<trl-load animations='https://digitalhuman.uk/assets/characters/Amie_Rigged_cmp/Amie_Dances.glb' />");
      console.error("anims loaded in auth");
    }
  }

  interface RespType {
    percent?: number; // or `percent: number` if you know it will always be there
  }

  const loadProgress = (resp: RespType) => {
    //TrlDebug.webgl._trulienceObj.sendMessageToAvatar("<trl-anim type='core' id='BubblePop_Dance' />"); 
    if (trulienceAvatarRef.current && resp && resp.percent && resp.percent == 1) {
      console.error("In callback loadProgress resp = ", resp);
      trulienceAvatarRef.current?.getTrulienceObject()?.sendMessageToAvatar("<trl-load animations='https://digitalhuman.uk/assets/characters/Amie_Rigged_cmp/Amie_Dances.glb' />");
      console.error("anims loaded in auth");
    }
  }

  const eventCallbacks = [
    //{"auth-success" : authSuccessHandler},
    //{"websocket-connect" : websocketConnectHandler}
    { "load-progress": loadProgress }
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