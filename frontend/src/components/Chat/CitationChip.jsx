export default function CitationChip({ citation, onClick }) {
  const lawShort = {
    'Labor Law':          'ច្បាប់ការងារ',
    'Trade Union Law':    'ច្បាប់សហជីព',
    'Social Security Law':'ច្បាប់សន្តិសុខ',
    'Minimum Wage Law':   'ច្បាប់ប្រាក់ឈ្នួល',
  }
  const label = lawShort[citation.law_name_en] || citation.law_name_en

  return (
    <button
      onClick={onClick}
      title={`${citation.law_name_en} — Article ${citation.article_number}, Page ${citation.page_number}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px',
        background: '#f0fdf8', border: '1px solid #9fe1cb',
        borderRadius: 20, fontSize: 12, color: '#0d7a57',
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all .15s', whiteSpace: 'nowrap'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#dcfbee'
        e.currentTarget.style.borderColor = '#1D9E75'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#f0fdf8'
        e.currentTarget.style.borderColor = '#9fe1cb'
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      [{citation.ref_num}] មាត្រា {citation.article_number} · {label} · ទំ.{citation.page_number}
    </button>
  )
}
