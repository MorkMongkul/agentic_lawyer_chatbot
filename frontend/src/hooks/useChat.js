import { useState, useCallback, useRef, useEffect } from 'react'
import { api } from '../services/api'

const noToken = async () => null
const noop    = () => {}

export function useChat(getToken = noToken, onRequireSignIn = noop) {
  const [sessionId,   setSessionId]   = useState(null)
  const [messages,    setMessages]    = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [status,      setStatus]      = useState('')
  const cancelRef = useRef(null)

  // Keep the latest getToken in a ref so callbacks always use the current one.
  const tokenRef = useRef(getToken || noToken)
  useEffect(() => { tokenRef.current = getToken || noToken }, [getToken])

  const signInRef = useRef(onRequireSignIn || noop)
  useEffect(() => { signInRef.current = onRequireSignIn || noop }, [onRequireSignIn])

  useEffect(() => {
    tokenRef.current().then((t) =>
      api.createSession(t).then((data) => setSessionId(data.session_id))
    )
  }, [])

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isStreaming || !sessionId) return
    const token = await tokenRef.current()
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
        case 'limit':
          setMessages((prev) => prev.map((m) =>
            m.id === aiId
              ? {
                  ...m,
                  content: 'សូមចូលគណនីដើម្បីបន្តសួរសំណួរបន្ថែម។',
                  streaming: false,
                  requireSignIn: true,
                }
              : m
          ))
          setIsStreaming(false)
          setStatus('')
          signInRef.current()   // open the Clerk sign-in modal
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
    }, token)
  }, [sessionId, isStreaming])

  const newSession = useCallback(async () => {
    if (cancelRef.current) cancelRef.current()
    setMessages([])
    setIsStreaming(false)
    setStatus('')
    const token = await tokenRef.current()
    const data  = await api.createSession(token)
    setSessionId(data.session_id)
  }, [])

  // Load an existing session's history into the chat (sidebar click).
  const loadSession = useCallback(async (id) => {
    if (cancelRef.current) cancelRef.current()
    setIsStreaming(false)
    setStatus('')
    const token = await tokenRef.current()
    const data  = await api.getHistory(id, token)
    if (!data) { setMessages([]); setSessionId(id); return }
    setMessages(data.messages.map((m, i) => ({
      id:        `${id}-${i}`,
      role:      m.role,
      content:   m.content,
      citations: m.citations || [],
      streaming: false,
    })))
    setSessionId(id)
  }, [])

  return { messages, isStreaming, status, sessionId, sendMessage, newSession, loadSession }
}
