const QUICK_ACTIONS = [
  { icon: '📋', title: 'ច្បាប់ការងារ', desc: 'ការងារ · ប្រាក់ខែ · ការបណ្តេញ' },
  { icon: '🤝', title: 'ច្បាប់សហជីព', desc: 'ការរៀបចំ · សិទ្ធិ · ករណីយកិច្ច' },
  { icon: '🛡️', title: 'ច្បាប់សន្តិសុខសង្គម', desc: 'ការធានា · ប្រាក់សោធន · ថែទាំ' },
  { icon: '💰', title: 'ច្បាប់ប្រាក់ឈ្នួលអប្បបរមា', desc: 'អប្បបរមា · ការពិភាក្សា · ក្រុមប្រឹក្សា' },
]

export default function WelcomeScreen({ onSuggestion, suggestions }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px', gap: 32
    }}>
      {/* Hero */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: '#1D9E75', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 16px'
        }}>⚖</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
          ជំនួយការច្បាប់ការងារកម្ពុជា
        </h1>
        <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.6 }}>
          សួរសំណួរទាក់ទងនឹងច្បាប់ការងារ ហើយទទួលចម្លើយពីអ្នកជំនាញ<br/>
          ជាមួយការដកស្រង់ច្បាស់លាស់ពីច្បាប់ពាក់ព័ន្ធ
        </p>
      </div>

      {/* Law cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 10, width: '100%', maxWidth: 520
      }}>
        {QUICK_ACTIONS.map(a => (
          <div
            key={a.title}
            onClick={() => onSuggestion(a.title)}
            style={{
              padding: '14px 16px', background: '#fff',
              border: '1px solid #eeeee8', borderRadius: 12,
              cursor: 'pointer', transition: 'all .15s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#1D9E75'
              e.currentTarget.style.background = '#f0fdf8'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#eeeee8'
              e.currentTarget.style.background = '#fff'
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 3 }}>
              {a.title}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>{a.desc}</div>
          </div>
        ))}
      </div>

      {/* Suggestion chips */}
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, textAlign: 'center' }}>
          សំណួរគំរូ
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              style={{
                padding: '7px 14px', background: '#fff',
                border: '1px solid #e0e0d8', borderRadius: 20,
                fontSize: 12, color: '#555', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all .15s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#1D9E75'
                e.currentTarget.style.color = '#0d7a57'
                e.currentTarget.style.background = '#f0fdf8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e0e0d8'
                e.currentTarget.style.color = '#555'
                e.currentTarget.style.background = '#fff'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
