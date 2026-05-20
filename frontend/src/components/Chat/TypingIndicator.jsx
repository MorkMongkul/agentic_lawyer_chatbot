export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: '#e1f5ee', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 14
      }}>⚖</div>
      <div style={{
        padding: '14px 18px', background: '#fff',
        border: '1px solid #eeeee8',
        borderRadius: '4px 18px 18px 18px',
        display: 'flex', gap: 5, alignItems: 'center'
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#9fe1cb',
            animation: `bounce .9s ${i * .15}s infinite`
          }}></div>
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          0%,60%,100%{transform:translateY(0)}
          30%{transform:translateY(-6px)}
        }
      `}</style>
    </div>
  )
}
