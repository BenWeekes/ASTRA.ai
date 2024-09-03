import { setAgentConnected } from "@/store/reducers/global"
import {
  DESCRIPTION, useAppDispatch, useAppSelector, VOICE_OPTIONS,apiPing, genUUID,
  apiStartService, apiStopService,
  getGraphProperties,
  LANGUAGE_OPTIONS,
  GRAPH_OPTIONS,
  isRagGraph,
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

let intervalId: any

const Description = () => {
  const dispatch = useAppDispatch()
  const agentConnected = useAppSelector(state => state.global.agentConnected)
  const channel = useAppSelector(state => state.global.options.channel)
  const userId = useAppSelector(state => state.global.options.userId)
  const language = useAppSelector(state => state.global.language)
  const voiceType = useAppSelector(state => state.global.voiceType)
  const graphName = useAppSelector(state => state.global.graphName)
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
      await apiStopService(channel)
      dispatch(setAgentConnected(false))
      message.success("Amie disconnected")
      stopPing()
    } else {
      const res = await apiStartService({
        channel,
        userId,
        graphName,
        properties: getGraphProperties(graphName, language, 'female')
      })
      const { code, msg } = res || {}
      if (code != 0) {
        if (code == "10001") {
          message.error("The number of users experiencing the program simultaneously has exceeded the limit. Please try again later.")
        } else {
          message.error(`code:${code},msg:${msg}`)
        }
        setLoading(false)
        throw new Error(msg)
      }
      dispatch(setAgentConnected(true))
      message.success("Amie connected")
      startPing()
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


  return <div className={styles.description}>
  
    <span className={styles.text}>Amie is an intelligent companion powered by TEN</span>
      {/*
    <CustomSelect className={styles.voiceSelect}
        disabled={agentConnected}
        value={voiceType}
        prefixIcon={<VoiceIcon></VoiceIcon>}
        options={VOICE_OPTIONS} onChange={onVoiceChange}></CustomSelect>
   */}
    <span className={styles.left}>
      </span>
      <span className={styles.right}>
        <Select className={styles.graphName}
          disabled={agentConnected} options={GRAPH_OPTIONS}
          value={graphName} onChange={onGraphNameChange}></Select>
      
        <Select className={styles.languageSelect}
          disabled={agentConnected} options={LANGUAGE_OPTIONS}
          value={language} onChange={onLanguageChange}></Select>
       
        {isRagGraph(graphName) ? <PdfSelect></PdfSelect> : null}
      </span>


    <span className={`${styles.btnConnect} ${agentConnected ? styles.disconnect : ''}`} onClick={onClickConnect}>
      <span className={`${styles.btnText} ${agentConnected ? styles.disconnect : ''}`}>
        {!agentConnected ? "Connect" : "Disconnect"}
        {loading ? <LoadingOutlined className={styles.loading}></LoadingOutlined> : null}
      </span>
    </span>
  </div>
}


export default Description
