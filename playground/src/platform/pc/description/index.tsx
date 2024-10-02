import { setAgentConnected } from "@/store/reducers/global"
import {

  DESCRIPTION, useAppDispatch, useAppSelector, VOICE_OPTIONS,apiPing, genUUID,
  apiStartService, apiStopService,
  LANGUAGE_OPTIONS,
  GRAPH_OPTIONS,
  isRagGraph

} from "@/common"
import { Select, Button, message, Upload } from "antd"
import { useEffect, useState, MouseEventHandler } from "react"
import { LoadingOutlined, UploadOutlined } from "@ant-design/icons"
import styles from "./index.module.scss"
import CustomSelect from "@/components/customSelect"
import { VoiceIcon } from "@/components/icons"
import { setVoiceType } from "@/store/reducers/global"
import { setGraphName, setLanguage } from "@/store/reducers/global"
import PdfSelect from "@/components/pdfSelect"
import { NextRequest, NextResponse } from 'next/server';
const { AGENT_SERVER_URL } = process.env;
// Check if environment variables are available
//if (!AGENT_SERVER_URL) {
//  throw "Environment variables AGENT_SERVER_URL are not available";
//}

console.error('fff', process.env);

let intervalId: any

const Description = () => {
  const dispatch = useAppDispatch()
  const agentConnected = useAppSelector(state => state.global.agentConnected)
  const channel = useAppSelector(state => state.global.options.channel)
  const userId = useAppSelector(state => state.global.options.userId)
  const language = useAppSelector(state => state.global.language)
  const voiceType = useAppSelector(state => state.global.voiceType)
  const graphName = useAppSelector(state => state.global.graphName)
  const isAvatarLoaded = useAppSelector(state => state.global.isAvatarLoaded)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (channel) {
      checkAgentConnected()
    }
  }, [channel])


  const checkAgentConnected = async () => {
    const res: any = await apiPing(channel)
    if (res?.code == 0) {
      dispatch(setAgentConnected(true))
    }
  }

  const onClickConnect = async () => {
    if (loading) {
      return
    }
    setLoading(true)
    if (agentConnected) {
      const url = `${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/stop_agent`
      const data = {
        channel_name: channel,
        uid: userId
      }
      let resp: any = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
      resp = (await resp.json()) || {}
      const { code, msg } = resp || {}
      if (code != 0) {
        console.error(`code:${code},msg:${msg}`);
      }
      dispatch(setAgentConnected(false))
      message.success("Amie disconnected")
    } else {
      //const url = `https://oai.agora.io/start_agent`
      const url = `${process.env.NEXT_PUBLIC_AGENT_SERVER_URL}/start_agent`
    console.error('AGENT_SERVER_URL',url);
      const data = {
        channel_name: channel,
        uid: userId
      }
      let resp: any = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
      resp = (await resp.json()) || {}
      const { code, msg } = resp || {}
      if (code != 0) {
        console.error(`code:${code},msg:${msg}`);
      }
      dispatch(setAgentConnected(true))
      message.success("Amie connected")
    }
    setLoading(false)
  }

  const startPing = () => {
    if (intervalId) {
      stopPing()
    }
    intervalId = setInterval(() => {
      apiPing(channel)
    }, 3000)
  }

  const stopPing = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
  const onVoiceChange = (value: any) => {
    dispatch(setVoiceType(value))
  }

  const onGraphNameChange = (val: any) => {
    dispatch(setGraphName(val))
  }

  const onLanguageChange = (val: any) => {
    dispatch(setLanguage(val))
  }


  // Show a loading indicator while connecting or loading the avatar.
  const showLoading = loading || !isAvatarLoaded

  return <div className={styles.description}>
  
    <span className={styles.text}>Amie is an intelligent companion. Ask her to dance, play music or change the background</span>
      {/*
    <CustomSelect className={styles.voiceSelect}
        disabled={agentConnected}
        value={voiceType}
        prefixIcon={<VoiceIcon></VoiceIcon>}
        options={VOICE_OPTIONS} onChange={onVoiceChange}></CustomSelect>
   */}
    <span className={styles.left}>
      </span>
       {/*
      <span className={styles.right}>
        <Select className={styles.graphName}
          disabled={agentConnected} options={GRAPH_OPTIONS}
          value={graphName} onChange={onGraphNameChange}></Select>
      
          
        <Select className={styles.languageSelect}
          disabled={agentConnected} options={LANGUAGE_OPTIONS}
          value={language} onChange={onLanguageChange}></Select>
       
        {isRagGraph(graphName) ? <PdfSelect></PdfSelect> : null}
      </span>
  */}

    <span className={`${styles.btnConnect} ${agentConnected ? styles.disconnect : ''} ${!isAvatarLoaded ? styles.disabled : ''}`} onClick={onClickConnect}>
      <span className={`${styles.btnText} ${agentConnected ? styles.disconnect : ''}`}>
        {!isAvatarLoaded ? "Loading " : !agentConnected ? "Connect" : "Disconnect"}
        {showLoading ? <LoadingOutlined className={styles.loading}></LoadingOutlined> : null}
      </span>
    </span>
  </div>
}


export default Description
