export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', padding: '6px 0', alignItems: 'center', gap: 5 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#9ca3af',
          animation: `bounce .9s ${i * .15}s infinite`
        }}></div>
      ))}
      <style>{`
        @keyframes bounce {
          0%,60%,100%{transform:translateY(0)}
          30%{transform:translateY(-6px)}
        }
      `}</style>
    </div>
  )
}
