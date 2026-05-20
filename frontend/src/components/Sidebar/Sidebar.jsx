import { useState } from 'react'

const LAWS = [
  { label: 'ច្បាប់ការងារ',       short: 'ការងារ' },
  { label: 'ច្បាប់សហជីព',        short: 'សហជីព' },
  { label: 'ច្បាប់សន្តិសុខសង្គម', short: 'សន្តិសុខ' },
  { label: 'ច្បាប់ប្រាក់ឈ្នួល',   short: 'ប្រាក់ឈ្នួល' },
]

export default function Sidebar({
  sessions, activeSession,
  onSelectSession, onNewSession,
  isOpen, onToggle
}) {
  const [showHistory, setShowHistory] = useState(true)

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onToggle}
          style={{
            display: 'none',
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.3)', zIndex: 40,
            '@media(maxWidth:768px)': { display: 'block' }
          }}
        />
      )}

      <div style={{
        width: isOpen ? 260 : 0,
        flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #eeeee8',
        display: 'flex', flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        transition: 'width .22s ease',
      }}>
        <div style={{ width: 260, display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Logo + collapse btn */}
          <div style={{
            padding: '16px 14px', borderBottom: '1px solid #eeeee8',
            display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: '#1D9E75', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 18
            }}>⚖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap' }}>
                ច្បាប់ការងារ
              </div>
              <div style={{ fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
                Cambodia Legal AI
              </div>
            </div>
            <button
              onClick={onToggle}
              title="បិទ sidebar"
              style={{
                width: 28, height: 28, borderRadius: 7,
                border: '1px solid #eee', background: 'transparent',
                cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#888', fontSize: 15
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f5f5f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ←
            </button>
          </div>

          {/* New chat */}
          <div style={{ padding: '12px 12px 8px' }}>
            <button onClick={onNewSession} style={{
              width: '100%', padding: '9px 14px',
              background: '#f0fdf8', border: '1px solid #bbf0dc',
              borderRadius: 8, fontSize: 13, color: '#0d7a57',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: 8, fontFamily: 'inherit', fontWeight: 500,
              transition: 'all .15s', whiteSpace: 'nowrap'
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#dcfbee'}
              onMouseLeave={e => e.currentTarget.style.background = '#f0fdf8'}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              ការសន្ទនាថ្មី
            </button>
          </div>

          {/* Law filter chips */}
          <div style={{ padding: '4px 12px 10px', borderBottom: '1px solid #eeeee8' }}>
            <div style={{ fontSize: 10, color: '#bbb', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>
              ច្បាប់
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {LAWS.map(l => (
                <div key={l.label} style={{
                  padding: '3px 8px', background: '#f5f5f2',
                  borderRadius: 20, fontSize: 11, color: '#666',
                  cursor: 'pointer', border: '1px solid #eee',
                  transition: 'all .15s', whiteSpace: 'nowrap'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#e8faf3'; e.currentTarget.style.color = '#0d7a57'; e.currentTarget.style.borderColor = '#9fe1cb' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#f5f5f2'; e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#eee' }}
                >
                  {l.short}
                </div>
              ))}
            </div>
          </div>

          {/* History section with toggle */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button
              onClick={() => setShowHistory(h => !h)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', background: 'transparent', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', width: '100%',
                borderBottom: showHistory ? '1px solid #f0f0ec' : 'none'
              }}
            >
              <span style={{ fontSize: 11, color: '#aaa', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 500 }}>
                ប្រវត្តិការសន្ទនា
              </span>
              <span style={{
                fontSize: 12, color: '#bbb',
                transform: showHistory ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform .2s', display: 'inline-block'
              }}>▾</span>
            </button>

            {showHistory && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
                {sessions.length === 0 ? (
                  <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: '#ccc' }}>
                    មិនទាន់មានប្រវត្តិ
                  </div>
                ) : (
                  sessions.map(s => (
                    <div
                      key={s.id}
                      onClick={() => onSelectSession(s.id)}
                      style={{
                        padding: '9px 10px', borderRadius: 8,
                        cursor: 'pointer', marginBottom: 2,
                        background: activeSession === s.id ? '#f0fdf8' : 'transparent',
                        border: activeSession === s.id ? '1px solid #bbf0dc' : '1px solid transparent',
                        transition: 'all .15s'
                      }}
                      onMouseEnter={e => { if (activeSession !== s.id) e.currentTarget.style.background = '#f8f8f5' }}
                      onMouseLeave={e => { if (activeSession !== s.id) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{
                        fontSize: 13, color: '#1a1a1a',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>{s.title}</div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{s.time}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 16px', borderTop: '1px solid #eeeee8',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#e8faf3', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: '#0d7a57', fontWeight: 600
            }}>អ</div>
            <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>អ្នកប្រើប្រាស់</div>
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#1D9E75' }} />
          </div>

        </div>
      </div>
    </>
  )
}