import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatWindow from './components/Chat/ChatWindow'
import PDFViewer from './components/PDFViewer/PDFViewer'
import { useChat } from './hooks/useChat'
import { usePDFViewer } from './hooks/usePDFViewer'
import { useWindowWidth } from './hooks/useWindowWidth'
import { api } from './services/api'

export default function App({ getToken = null, isSignedIn = false, onRequireSignIn = null, AuthControls = null }) {
  const chat      = useChat(getToken, onRequireSignIn)
  const pdfViewer = usePDFViewer()
  const width     = useWindowWidth()
  const isMobile  = width < 640
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
    if (isMobile) setSidebarOpen(false)
  }

  const handleSelectSession = (id) => {
    setActiveSession(id)
    chat.loadSession(id)
    if (isMobile) setSidebarOpen(false)
  }

  const handleDeleteSession = async (id) => {
    if (!isSignedIn || !getToken) return
    const token = await getToken()
    try {
      await api.deleteSession(id, token)
    } catch (err) {
      // Don't hide the failure: removing it from the UI anyway makes the row
      // look deleted while it survives in the database and returns on reload.
      console.error('Failed to delete session:', err)
      return
    }
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeSession === id) {
      await chat.newSession()
    }
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
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => !d)}
        AuthControls={AuthControls}
        isSignedIn={isSignedIn}
        isMobile={isMobile}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minWidth: 0 }}>
        {/* Backdrop — closes the sidebar overlay on any screen size */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 150,
            }}
          />
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
          AuthControls={AuthControls}
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
