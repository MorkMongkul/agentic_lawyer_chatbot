import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatWindow from './components/Chat/ChatWindow'
import PDFViewer from './components/PDFViewer/PDFViewer'
import { useChat } from './hooks/useChat'
import { usePDFViewer } from './hooks/usePDFViewer'
import { api } from './services/api'

export default function App({ getToken = null, isSignedIn = false, onRequireSignIn = null, AuthControls = null }) {
  const chat      = useChat(getToken, onRequireSignIn)
  const pdfViewer = usePDFViewer()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDark, setIsDark]           = useState(false)
  const [sessions, setSessions]       = useState([])
  const [activeSession, setActiveSession] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Load the signed-in user's saved sessions for the sidebar.
  const refreshSessions = useCallback(async () => {
    if (!isSignedIn || !getToken) { setSessions([]); return }
    const token = await getToken()
    const data  = await api.listSessions(token)
    setSessions(data.sessions || [])
  }, [isSignedIn, getToken])

  useEffect(() => { refreshSessions() }, [refreshSessions])

  // Track the active session as the chat hook creates/loads one.
  useEffect(() => {
    if (chat.sessionId) setActiveSession(chat.sessionId)
  }, [chat.sessionId])

  const handleNewSession = async () => {
    await chat.newSession()
    refreshSessions()
  }

  const handleSelectSession = (id) => {
    setActiveSession(id)
    chat.loadSession(id)
  }

  const handleSend = (text) => {
    chat.sendMessage(text)
    // Give the backend a moment to persist, then refresh the sidebar list.
    if (isSignedIn) setTimeout(refreshSessions, 1500)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => !d)}
        AuthControls={AuthControls}
        isSignedIn={isSignedIn}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minWidth: 0 }}>
        {/* Auth controls float top-right when Clerk is configured */}
        {AuthControls && (
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 20 }}>
            <AuthControls />
          </div>
        )}
        <ChatWindow
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          status={chat.status}
          onSend={handleSend}
          onCitationClick={pdfViewer.openCitation}
          pdfOpen={pdfViewer.isOpen}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          isDark={isDark}
        />
        <PDFViewer
          isOpen={pdfViewer.isOpen}
          citation={pdfViewer.citation}
          pdfUrl={pdfViewer.pdfUrl}
          onClose={pdfViewer.close}
        />
      </div>
    </div>
  )
}
