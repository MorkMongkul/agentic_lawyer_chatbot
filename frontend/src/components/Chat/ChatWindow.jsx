import { useEffect, useRef, useState } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import WelcomeScreen from './WelcomeScreen'

export default function ChatWindow({
  messages, isStreaming, status, onSend,
  onCitationClick, pdfOpen,
  sidebarOpen, onToggleSidebar,
  isDark,
}) {
  const [input, setInput] = useState('')
  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)
  const isWelcome   = messages.length === 0

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

  const showTyping = isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1]?.streaming &&
    messages[messages.length - 1]?.content === ''

  const canSend = input.trim() && !isStreaming
  const sendHoverBg = isDark ? 'rgba(255,255,255,0.85)' : '#333'
  const sendActiveBg = 'var(--send-bg)'

  const inputCard = () => (
    <div>
      <div style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        borderRadius: 9999,
        boxShadow: '0 2px 20px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center',
        padding: '0 8px 0 22px',
        minHeight: 56, gap: 8,
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKey}
          placeholder="សរសេរសំណួររបស់លោកអ្នក..."
          rows={1}
          style={{
            flex: 1, border: 'none', background: 'transparent',
            resize: 'none', outline: 'none',
            fontSize: 15, fontFamily: 'inherit',
            color: 'var(--text)', lineHeight: 1.6,
            padding: '16px 0', maxHeight: 140,
            display: 'block', alignSelf: 'center',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: canSend ? sendActiveBg : 'var(--send-off)',
            border: 'none',
            cursor: canSend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background .15s',
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.background = sendHoverBg }}
          onMouseLeave={e => { if (canSend) e.currentTarget.style.background = sendActiveBg }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={canSend ? 'var(--send-icon)' : 'var(--text-muted)'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
        Enter ផ្ញើ · Shift+Enter បន្ទាត់ថ្មី
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

      {/* Top nav */}
      <nav style={{
        height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        background: 'var(--bg)',
      }}>
        {status && !isWelcome && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', background: 'rgba(186,236,23,0.12)',
            border: '1px solid rgba(186,236,23,0.35)', borderRadius: 20,
            fontSize: 11, color: '#111111',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#BAEC17', animation: 'pulse 1s infinite' }} />
            {status}
          </div>
        )}
      </nav>

      {/* Welcome layout */}
      {isWelcome ? (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            margin: 'auto', width: '100%', maxWidth: 760,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 28, padding: '32px 24px 48px',
          }}>
            <WelcomeScreen onSuggestion={onSend} isDark={isDark} />
            <div style={{ width: '100%' }}>{inputCard()}</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 0' }}>
            <div style={{
              maxWidth: 720, margin: '0 auto',
              padding: '0 24px',
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              {messages
                .filter(msg => !(msg.role !== 'user' && msg.streaming && msg.content === ''))
                .map(msg => (
                  <MessageBubble key={msg.id} message={msg} onCitationClick={onCitationClick} />
                ))}
              {showTyping && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </div>

          <div style={{
            flexShrink: 0,
            padding: '16px 24px 24px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg)',
          }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              {inputCard()}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
