import ReactMarkdown from 'react-markdown'
import CitationChip from './CitationChip'

export default function MessageBubble({ message, onCitationClick }) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      display: 'flex', gap: 10,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start'
    }}>

      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: isUser ? '#eeedfe' : '#e1f5ee',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 600,
        color: isUser ? '#534AB7' : '#0d7a57'
      }}>
        {isUser ? 'អ' : '⚖'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '74%', minWidth: 0 }}>
        <div style={{
          padding: isUser ? '10px 16px' : '12px 18px',
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          background: isUser ? '#1D9E75' : '#fff',
          border: isUser ? 'none' : '1px solid #eeeee8',
          fontSize: 14, lineHeight: 1.8,
          color: isUser ? '#fff' : '#1a1a1a',
          wordBreak: 'break-word'
        }}>
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <div className="markdown-body">
              <ReactMarkdown
                components={{
                  p: ({children}) => (
                    <p style={{ margin: '0 0 10px', lineHeight: 1.8 }}>{children}</p>
                  ),
                  strong: ({children}) => (
                    <strong style={{ fontWeight: 600, color: '#0d7a57' }}>{children}</strong>
                  ),
                  ul: ({children}) => (
                    <ul style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ul>
                  ),
                  ol: ({children}) => (
                    <ol style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ol>
                  ),
                  li: ({children}) => (
                    <li style={{ marginBottom: 4, lineHeight: 1.7 }}>{children}</li>
                  ),
                  h1: ({children}) => (
                    <h1 style={{ fontSize: 16, fontWeight: 600, margin: '12px 0 6px', color: '#0d7a57' }}>{children}</h1>
                  ),
                  h2: ({children}) => (
                    <h2 style={{ fontSize: 15, fontWeight: 600, margin: '12px 0 6px', color: '#0d7a57' }}>{children}</h2>
                  ),
                  h3: ({children}) => (
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: '10px 0 4px', color: '#1a1a1a' }}>{children}</h3>
                  ),
                  code: ({children}) => (
                    <code style={{
                      background: '#f0fdf8', padding: '2px 6px',
                      borderRadius: 4, fontSize: 13, color: '#0d7a57',
                      fontFamily: 'monospace'
                    }}>{children}</code>
                  ),
                  blockquote: ({children}) => (
                    <blockquote style={{
                      borderLeft: '3px solid #1D9E75',
                      paddingLeft: 12, margin: '8px 0',
                      color: '#555', fontStyle: 'italic'
                    }}>{children}</blockquote>
                  ),
                  hr: () => (
                    <hr style={{ border: 'none', borderTop: '1px solid #eeeee8', margin: '12px 0' }} />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.streaming && message.content && (
                <span style={{
                  display: 'inline-block', width: 2, height: 14,
                  background: '#1D9E75', marginLeft: 2,
                  animation: 'blink .7s infinite', verticalAlign: 'text-bottom'
                }}></span>
              )}
            </div>
          )}
        </div>

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && !message.streaming && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {message.citations.map((cit, i) => (
              <CitationChip key={i} citation={cit} onClick={() => onCitationClick(cit)} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .markdown-body p:last-child { margin-bottom: 0; }
      `}</style>
    </div>
  )
}