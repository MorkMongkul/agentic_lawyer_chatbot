const BASE_URL = '/api'

// Build headers, attaching the Clerk bearer token when signed in.
function authHeaders(token, extra = {}) {
  const h = { ...extra }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

export const api = {
  createSession: async (token) => {
    const res = await fetch(`${BASE_URL}/chat/session`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
    })
    return res.json()
  },

  getHistory: async (sessionId, token) => {
    const res = await fetch(`${BASE_URL}/chat/${sessionId}/history`, {
      headers: authHeaders(token),
    })
    if (!res.ok) return null
    return res.json()
  },

  listSessions: async (token) => {
    const res = await fetch(`${BASE_URL}/chat/sessions`, {
      headers: authHeaders(token),
    })
    if (!res.ok) return { sessions: [] }
    return res.json()
  },

  getPDFUrl: (filename) => `${BASE_URL}/documents/${filename}`,

  streamChat: (message, sessionId, onEvent, token) => {
    const controller = new AbortController()
    fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ message, session_id: sessionId }),
      credentials: 'same-origin',   // send/receive the anon-quota cookie
      signal: controller.signal,
    })
      .then(async (res) => {
        // Anonymous free-tier quota exhausted → prompt sign-in
        if (res.status === 403) {
          let data = {}
          try { data = await res.json() } catch { /* ignore */ }
          if (data.error === 'anonymous_limit_reached') {
            onEvent({ type: 'limit', limit: data.limit })
            return
          }
        }
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
