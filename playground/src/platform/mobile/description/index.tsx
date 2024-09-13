import { setAgentConnected } from "@/store/reducers/global"
import {
  DESCRIPTION, useAppDispatch, useAppSelector, apiPing, genUUID,
  apiStartService, apiStopService
} from "@/common"
import { message } from "antd"
import { useEffect, useState } from "react"
import { LoadingOutlined, } from "@ant-design/icons"
import styles from "./index.module.scss"

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
      await apiStopService(channel)
      dispatch(setAgentConnected(false))
      message.success("Amie disconnected")
      stopPing()
    } else {
      const res = await apiStartService({
        channel,
        userId,
        graphName,
        language,
        voiceType
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

  return <div className={styles.description}>
    <span className={styles.title}>Aime 2024</span>
    <span 
      onClick={onClickConnect}
      className={`${styles.btnConnect} ${agentConnected ? styles.disconnect : ''} ${!isAvatarLoaded ? styles.disabled : ''}`}  
      >
      <span className={`${styles.btnText} ${agentConnected ? styles.disconnect : ''}`}>
        {!agentConnected ? "Connect" : "Disconnect"}
        {loading ? <LoadingOutlined className={styles.loading}></LoadingOutlined> : null}
      </span>
    </span>
  </div>
}


export default Description
