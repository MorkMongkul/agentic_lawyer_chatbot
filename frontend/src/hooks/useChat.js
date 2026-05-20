import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '../services/api'

export function useChat() {
  const [sessionId,   setSessionId]   = useState(null)
  const [messages,    setMessages]    = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [status,      setStatus]      = useState('')
  const cancelRef = useRef(null)

  useEffect(() => {
    api.createSession().then((data) => setSessionId(data.session_id))
  }, [])

  const sendMessage = useCallback((text) => {
    if (!text.trim() || isStreaming || !sessionId) return
    const userMsg = { id: Date.now(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)
    setStatus('កំពុងស្វែងរក...')
    const aiId  = Date.now() + 1
    const aiMsg = { id: aiId, role: 'assistant', content: '', citations: [], streaming: true }
    setMessages((prev) => [...prev, aiMsg])
    cancelRef.current = api.streamChat(text, sessionId, (event) => {
      switch (event.type) {
        case 'status':
          setStatus(event.message)
          break
        case 'token':
          setMessages((prev) => prev.map((m) =>
            m.id === aiId ? { ...m, content: m.content + event.content } : m
          ))
          break
        case 'citations':
          setMessages((prev) => prev.map((m) =>
            m.id === aiId ? { ...m, citations: event.data } : m
          ))
          break
        case 'done':
          setMessages((prev) => prev.map((m) =>
            m.id === aiId ? { ...m, streaming: false } : m
          ))
          setIsStreaming(false)
          setStatus('')
          break
        case 'error':
          setMessages((prev) => prev.map((m) =>
            m.id === aiId
              ? { ...m, content: 'មានបញ្ហា។ សូមព្យាយាមម្តងទៀត។', streaming: false }
              : m
          ))
          setIsStreaming(false)
          setStatus('')
          break
      }
    })
  }, [sessionId, isStreaming])

  const newSession = useCallback(() => {
    if (cancelRef.current) cancelRef.current()
    setMessages([])
    setIsStreaming(false)
    setStatus('')
    api.createSession().then((data) => setSessionId(data.session_id))
  }, [])

  return { messages, isStreaming, status, sessionId, sendMessage, newSession }
}
