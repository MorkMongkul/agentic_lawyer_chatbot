import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import WelcomeScreen from './WelcomeScreen'

export default function ChatWindow({
  messages, isStreaming, status, onSend,
  onCitationClick, pdfOpen,
  sidebarOpen, onToggleSidebar
}) {
  const [input, setInput] = useState('')
  const bottomRef         = useRef(null)
  const textareaRef       = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleInput = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'
  }

  const SUGGESTIONS = [
    'ការបណ្តេញបុគ្គលិកដោយគ្មានហេតុផល',
    'ប្រាក់ឈ្នួលអប្បបរមា',
    'ការធ្វើកូដកម្ម',
    'ច្បាប់ការងារ មាត្រា ១',
    'ច្បាប់ការលាឈប់',
  ]

  const showTyping = isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1]?.streaming &&
    messages[messages.length - 1]?.content === ''

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

      {/* Header */}
      <div style={{
        height: 56, background: '#fff', borderBottom: '1px solid #eeeee8',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        gap: 12, flexShrink: 0
      }}>

        {/* Sidebar toggle button */}
        {!sidebarOpen && (
          <button
            onClick={onToggleSidebar}
            title="បើក sidebar"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid #eee', background: 'transparent',
              cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#888', fontSize: 16, flexShrink: 0
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f5f5f2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >☰</button>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ជំនួយការច្បាប់ការងារកម្ពុជា
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>Cambodian Labour Law AI Assistant</div>
        </div>

        {/* Status indicator */}
        {status ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', background: '#f0fdf8',
            border: '1px solid #bbf0dc', borderRadius: 20,
            fontSize: 12, color: '#0d7a57', flexShrink: 0
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#1D9E75',
              animation: 'pulse 1s infinite'
            }}></div>
            {status}
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', background: '#f0fdf8',
            border: '1px solid #bbf0dc', borderRadius: 20, flexShrink: 0
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D9E75' }}></div>
            <span style={{ fontSize: 11, color: '#0d7a57' }}>ប្រព័ន្ធដំណើរការ</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '24px 28px',
        display: 'flex', flexDirection: 'column', gap: 20
      }}>
        {messages.length === 0 ? (
          <WelcomeScreen onSuggestion={onSend} suggestions={SUGGESTIONS} />
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onCitationClick={onCitationClick}
            />
          ))
        )}
        {showTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 28px 20px',
        background: '#fff', borderTop: '1px solid #eeeee8', flexShrink: 0
      }}>
        <div style={{
          background: '#f8f8f6', border: '1.5px solid #e0e0d8',
          borderRadius: 14, display: 'flex',
          alignItems: 'flex-end', gap: 10, padding: '10px 14px',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder="សរសេរសំណួររបស់លោកអ្នកទាក់ទងនឹងច្បាប់ការងារ..."
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              resize: 'none', outline: 'none', fontSize: 14,
              fontFamily: 'inherit', color: '#1a1a1a',
              lineHeight: 1.6, maxHeight: 140, minHeight: 24
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            style={{
              width: 36, height: 36, borderRadius: 9,
              background: input.trim() && !isStreaming ? '#1D9E75' : '#d0d0c8',
              border: 'none',
              cursor: input.trim() && !isStreaming ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background .15s'
            }}
            onMouseEnter={e => { if (input.trim() && !isStreaming) e.currentTarget.style.background = '#0F6E56' }}
            onMouseLeave={e => { if (input.trim() && !isStreaming) e.currentTarget.style.background = '#1D9E75' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#c0c0b8', textAlign: 'center', marginTop: 8 }}>
          ចម្លើយផ្អែកលើច្បាប់ជាធរមាននៅព្រះរាជាណាចក្រកម្ពុជា · Enter ដើម្បីផ្ញើ · Shift+Enter សម្រាប់បន្ទាត់ថ្មី
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}