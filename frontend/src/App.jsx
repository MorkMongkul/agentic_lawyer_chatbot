import { useState } from 'react'
import Sidebar from './components/Sidebar/Sidebar'
import ChatWindow from './components/Chat/ChatWindow'
import PDFViewer from './components/PDFViewer/PDFViewer'
import { useChat } from './hooks/useChat'
import { usePDFViewer } from './hooks/usePDFViewer'

export default function App() {
  const chat        = useChat()
  const pdfViewer   = usePDFViewer()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sessions, setSessions] = useState([
    { id: 'demo-1', title: 'ការបណ្តេញបុគ្គលិកដោយ...', time: 'ថ្ងៃនេះ' },
    { id: 'demo-2', title: 'ប្រាក់ឈ្នួលអប្បបរមា', time: 'ម្សិលមិញ' },
  ])
  const [activeSession, setActiveSession] = useState('demo-1')

  const handleNewSession = () => {
    const id    = `session-${Date.now()}`
    const title = 'ការសន្ទនាថ្មី'
    setSessions(prev => [{ id, title, time: 'ឥឡូវ' }, ...prev])
    setActiveSession(id)
    chat.newSession()
  }

  // Update session title from first message
  const handleSend = (text) => {
    chat.sendMessage(text)
    setSessions(prev => prev.map(s =>
      s.id === activeSession && s.title === 'ការសន្ទនាថ្មី'
        ? { ...s, title: text.length > 24 ? text.slice(0, 24) + '...' : text }
        : s
    ))
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8f8f6' }}>

      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={(id) => { setActiveSession(id); chat.newSession() }}
        onNewSession={handleNewSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
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