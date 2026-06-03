import { useState, useRef } from 'react'
import Logo from '../../assets/Logo'

const IconEdit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const IconSearch = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const IconPanelOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2.5"/>
    <path d="M9 3v18"/>
    <path d="M13 9l3 3-3 3"/>
  </svg>
)

const IconPanelClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2.5"/>
    <path d="M9 3v18"/>
    <path d="M14 9l-3 3 3 3"/>
  </svg>
)

const IconSun = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

export default function Sidebar({
  sessions, activeSession,
  onSelectSession, onNewSession,
  isOpen, onToggle,
  isDark, onToggleTheme,
}) {
  const [search, setSearch]       = useState('')
  const [logoHover, setLogoHover] = useState(false)
  const searchRef                 = useRef(null)

  const h = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'
  const hs = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'

  const filtered = search.trim()
    ? sessions.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : sessions

  const handleSearchIconClick = () => {
    if (!isOpen) {
      onToggle()
      setTimeout(() => searchRef.current?.focus(), 280)
    } else {
      searchRef.current?.focus()
    }
  }

  const iconBtn = (onClick, title, children) => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <button
        onClick={onClick}
        title={title}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text)', transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = h}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >{children}</button>
    </div>
  )

  return (
    <div style={{
      width: isOpen ? 260 : 64,
      height: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
      transition: 'width .25s cubic-bezier(0.4,0,0.2,1)',
      borderRight: isOpen ? '1px solid var(--border)' : 'none',
    }}>

      {/* Header */}
      <div style={{
        height: 60,
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8, flexShrink: 0,
      }}>
        <button
          onClick={onToggle}
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
          title={isOpen ? '' : 'បើក sidebar'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text)', transition: 'background .15s',
          }}
        >
          {!isOpen && logoHover ? <IconPanelOpen /> : <Logo size={28} />}
        </button>

        {isOpen && (
          <>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', flex: 1 }}>
              Niti
            </span>
            <button
              onClick={onToggle}
              title="បិទ sidebar"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text)', transition: 'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = h}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <IconPanelClose />
            </button>
          </>
        )}
      </div>

      {/* New Chat */}
      <div style={{ padding: '2px 12px 2px', flexShrink: 0 }}>
        {isOpen ? (
          <button
            onClick={onNewSession}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 14px', width: '100%',
              background: 'none', border: 'none', cursor: 'pointer',
              borderRadius: 24, fontFamily: 'inherit',
              fontSize: 14, color: 'var(--text)', fontWeight: 500,
              transition: 'background .15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.background = h}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <IconEdit />
            ការសន្ទនាថ្មី
          </button>
        ) : iconBtn(onNewSession, 'ការសន្ទនាថ្មី', <IconEdit />)}
      </div>

      {/* Search */}
      <div style={{ padding: '2px 12px 10px', flexShrink: 0 }}>
        {isOpen ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 14px', background: h, borderRadius: 24,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ស្វែងរកការសន្ទនា..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 500,
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}
              >✕</button>
            )}
          </div>
        ) : iconBtn(handleSearchIconClick, 'ស្វែងរក',
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%', background: h,
          }}>
            <IconSearch />
          </div>
        )}
      </div>

      {/* History */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isOpen && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: 0.4, padding: '6px 16px 4px' }}>
            ប្រវត្តិ
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '2px 8px' }}>
          {filtered.length === 0 && isOpen ? (
            <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              {search ? 'រកមិនឃើញ' : 'មិនទាន់មានប្រវត្តិ'}
            </div>
          ) : (
            filtered.map(s => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                title={!isOpen ? s.title : undefined}
                style={{
                  padding: isOpen ? '8px 10px' : '10px 0',
                  borderRadius: 8, cursor: 'pointer', marginBottom: 1,
                  display: 'flex', alignItems: 'center',
                  justifyContent: isOpen ? 'flex-start' : 'center',
                  gap: isOpen ? 8 : 0,
                  background: activeSession === s.id ? 'rgba(186,236,23,0.15)' : 'transparent',
                  transition: 'background .15s', overflow: 'hidden',
                }}
                onMouseEnter={e => { if (activeSession !== s.id) e.currentTarget.style.background = h }}
                onMouseLeave={e => { if (activeSession !== s.id) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: activeSession === s.id ? '#A8D414' : 'var(--text-muted)',
                }} />
                {isOpen && (
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{s.time}</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Theme toggle */}
      <div style={{
        flexShrink: 0, padding: '6px 12px',
        display: 'flex', justifyContent: isOpen ? 'flex-end' : 'center',
      }}>
        <button
          onClick={onToggleTheme}
          title={isDark ? 'Light mode' : 'Dark mode'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text)', transition: 'background .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = h}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0,
        padding: '4px 14px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: isOpen ? 'flex-start' : 'center',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#BAEC17', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color: '#111111',
          flexShrink: 0, cursor: 'default',
        }}>អ</div>
        {isOpen && (
          <>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>
              អ្នកប្រើប្រាស់
            </span>
            <div style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#BAEC17', flexShrink: 0 }} />
          </>
        )}
      </div>
    </div>
  )
}
