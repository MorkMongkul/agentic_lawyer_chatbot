const BASE_URL = '/api'

export const api = {
  createSession: async () => {
    const res = await fetch(`${BASE_URL}/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return res.json()
  },

  getHistory: async (sessionId) => {
    const res = await fetch(`${BASE_URL}/chat/${sessionId}/history`)
    if (!res.ok) return null
    return res.json()
  },

  getPDFUrl: (filename) => `${BASE_URL}/documents/${filename}`,

  streamChat: (message, sessionId, onEvent) => {
    const controller = new AbortController()
    fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer    = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (!data) continue
              try { onEvent(JSON.parse(data)) }
              catch (e) { console.warn('SSE parse error:', e) }
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError')
          onEvent({ type: 'error', message: err.message })
      })
    return () => controller.abort()
  },
}
