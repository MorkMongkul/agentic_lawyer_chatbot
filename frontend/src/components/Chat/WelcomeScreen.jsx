const CARDS = [
  { title: 'ច្បាប់ស្តីពីការងារ',          desc: 'ការងារ · ប្រាក់ខែ · ការបណ្តេញ' },
  { title: 'ច្បាប់ស្តីពីសហជីព',           desc: 'ការរៀបចំ · សិទ្ធិ · ករណីយកិច្ច' },
  { title: 'ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម', desc: 'ការធានា · ប្រាក់សោធន · ថែទាំ' },
  { title: 'ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា', desc: 'អប្បបរមា · ការពិភាក្សា · ក្រុមប្រឹក្សា' },
]

export default function WelcomeScreen({ onSuggestion, isDark }) {
  const cardBase = isDark ? '#1C1C1C' : '#fff'
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : '#E4E4E4'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 28, padding: '0 24px', width: '100%',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25, marginBottom: 4 }}>
          ជំនួយការច្បាប់ការងារ
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25, marginBottom: 14, opacity: 0.7 }}>
          តើខ្ញុំអាចជួយអ្នកដោយរបៀបណា?
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          ជ្រើសរើសសំណួរខាងក្រោម ឬសរសេរសំណួររបស់អ្នកផ្ទាល់ ដើម្បីចាប់ផ្តើម
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10, width: '100%', maxWidth: 720,
      }}>
        {CARDS.map(c => (
          <button
            key={c.title}
            onClick={() => onSuggestion(c.title)}
            style={{
              padding: '14px 16px',
              background: cardBase,
              border: `1px solid ${cardBorder}`,
              borderRadius: 12, cursor: 'pointer',
              transition: 'all .15s', textAlign: 'left', fontFamily: 'inherit',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#BAEC17'
              e.currentTarget.style.background = 'rgba(186,236,23,0.08)'
              e.currentTarget.style.boxShadow = '0 2px 16px rgba(186,236,23,0.14)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = cardBorder
              e.currentTarget.style.background = cardBase
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5, marginBottom: 5 }}>
              {c.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {c.desc}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
