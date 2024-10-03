import { setAgentConnected } from "@/store/reducers/global"
import {
  DESCRIPTION, useAppDispatch, useAppSelector, apiPing, genUUID,
  apiStartService, apiStopService
} from "@/common"
import { message } from "antd"
import { useEffect, useState } from "react"
import { LoadingOutlined, } from "@ant-design/icons"
import styles from "./index.module.scss"
import { rtcManager } from "@/manager"
const { AGENT_SERVER_URL } = process.env;

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
    /*
    if (channel) {
      checkAgentConnected()
    }*/
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
      await rtcManager.destroy()
      const url = `https://oai.agora.io/stop_agent`
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

      await rtcManager.connect({ channel, userId })

      const url = `${AGENT_SERVER_URL}/start_agent`
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

  // Show a loading indicator while connecting or loading the avatar.
  const showLoading = loading || !isAvatarLoaded

  return <div className={styles.description}>
    <span className={styles.title}>Aime 2024</span>
    <span 
      onClick={onClickConnect}
      className={`${styles.btnConnect} ${agentConnected ? styles.disconnect : ''} ${!isAvatarLoaded ? styles.disabled : ''}`}  
      >
      <span className={`${styles.btnText} ${agentConnected ? styles.disconnect : ''}`}>
        {!isAvatarLoaded ? "Loading " : !agentConnected ? "Connect" : "Disconnect"}
        { showLoading ? <LoadingOutlined className={styles.loading}></LoadingOutlined> : null}
      </span>
    </span>
  </div>
}


export default Description
