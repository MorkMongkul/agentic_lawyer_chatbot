import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatWindow from './components/Chat/ChatWindow'
import PDFViewer from './components/PDFViewer/PDFViewer'
import { useChat } from './hooks/useChat'
import { usePDFViewer } from './hooks/usePDFViewer'

export default function App() {
  const chat      = useChat()
  const pdfViewer = usePDFViewer()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDark, setIsDark]           = useState(false)
  const [sessions, setSessions] = useState([
    { id: 'demo-1', title: 'ការបណ្តេញបុគ្គលិកដោយ...', time: 'ថ្ងៃនេះ' },
    { id: 'demo-2', title: 'ប្រាក់ឈ្នួលអប្បបរមា', time: 'ម្សិលមិញ' },
  ])
  const [activeSession, setActiveSession] = useState('demo-1')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const handleNewSession = () => {
    const id = `session-${Date.now()}`
    setSessions(prev => [{ id, title: 'ការសន្ទនាថ្មី', time: 'ឥឡូវ' }, ...prev])
    setActiveSession(id)
    chat.newSession()
  }

  const handleSend = (text) => {
    chat.sendMessage(text)
    setSessions(prev => prev.map(s =>
      s.id === activeSession && s.title === 'ការសន្ទនាថ្មី'
        ? { ...s, title: text.length > 24 ? text.slice(0, 24) + '...' : text }
        : s
    ))
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={(id) => { setActiveSession(id); chat.newSession() }}
        onNewSession={handleNewSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        isDark={isDark}
        onToggleTheme={() => setIsDark(d => !d)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minWidth: 0 }}>
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
