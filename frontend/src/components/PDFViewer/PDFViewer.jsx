import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

export default function PDFViewer({ isOpen, citation, pdfUrl, onClose }) {
  const canvasRef  = useRef(null)
  const pdfRef     = useRef(null)
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  // Load PDF when url changes
  useEffect(() => {
    if (!pdfUrl || !isOpen) return
    setLoading(true)
    setError(null)

    pdfjsLib.getDocument(pdfUrl).promise
      .then(pdf => {
        pdfRef.current = pdf
        setTotal(pdf.numPages)
        const targetPage = citation?.page_number || 1
        setPage(targetPage)
        renderPage(pdf, targetPage)
      })
      .catch(err => {
        console.error('PDF load error:', err)
        setError('មិនអាចបើក PDF បានទេ')
        setLoading(false)
      })
  }, [pdfUrl, isOpen])

  // Jump to new page when citation changes
  useEffect(() => {
    if (!pdfRef.current || !citation?.page_number) return
    const p = citation.page_number
    setPage(p)
    renderPage(pdfRef.current, p)
  }, [citation])

  const renderPage = async (pdf, pageNum) => {
    setLoading(true)
    try {
      const pg       = await pdf.getPage(pageNum)
      const viewport = pg.getViewport({ scale: 1.3 })
      const canvas   = canvasRef.current
      if (!canvas) return
      canvas.height  = viewport.height
      canvas.width   = viewport.width
      await pg.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    } catch (e) {
      setError('មិនអាចបង្ហាញទំព័រនេះបានទេ')
    } finally {
      setLoading(false)
    }
  }

  const goTo = (n) => {
    if (!pdfRef.current || n < 1 || n > total) return
    setPage(n)
    renderPage(pdfRef.current, n)
  }

  const lawShort = {
    'Labor Law':          'ច្បាប់ស្តីពីការងារ',
    'Trade Union Law':    'ច្បាប់ស្តីពីសហជីព',
    'Social Security Law':'ច្បាប់ស្តីពីរបបសន្តិសុខសង្គម',
    'Minimum Wage Law':   'ច្បាប់ស្តីពីប្រាក់ឈ្នួលអប្បបរមា',
  }

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: 420, height: '100%',
      background: '#fff', borderLeft: '1px solid #eeeee8',
      display: 'flex', flexDirection: 'column',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform .25s ease',
      zIndex: 50, boxShadow: isOpen ? '-4px 0 20px rgba(0,0,0,.06)' : 'none'
    }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid #eeeee8',
        display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>
            {citation ? `${lawShort[citation.law_name_en] || citation.law_name} — មាត្រា ${citation.article_number}` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>cambodian_labor_laws.pdf</div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 28, height: 28, borderRadius: 7,
            border: '1px solid #eee', background: 'transparent',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#888', flexShrink: 0, fontSize: 16
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f5f5f2'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >✕</button>
      </div>

      {/* Meta */}
      {citation && (
        <div style={{
          padding: '10px 16px', background: '#f8fdf9',
          borderBottom: '1px solid #eeeee8', flexShrink: 0,
          display: 'flex', gap: 16
        }}>
          {[
            ['ច្បាប់', lawShort[citation.law_name_en] || citation.law_name_en],
            ['មាត្រា', citation.article_number],
            ['ទំព័រ', citation.page_number],
          ].map(([label, val]) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div style={{
        flex: 1, overflow: 'auto', background: '#f0f0ec',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 16
      }}>
        {loading && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 12, color: '#888'
          }}>
            <div style={{
              width: 32, height: 32, border: '3px solid #e0e0d8',
              borderTop: '3px solid #1D9E75', borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <span style={{ fontSize: 13 }}>កំពុងបើក PDF...</span>
          </div>
        )}
        {error && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 8, color: '#888', textAlign: 'center'
          }}>
            <span style={{ fontSize: 32 }}>📄</span>
            <span style={{ fontSize: 13 }}>{error}</span>
            <span style={{ fontSize: 11, color: '#bbb' }}>ត្រូវប្រាកដថា PDF មាននៅ backend</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            display: loading || error ? 'none' : 'block',
            boxShadow: '0 2px 12px rgba(0,0,0,.12)',
            borderRadius: 4, maxWidth: '100%'
          }}
        />
      </div>

      {/* Footer nav */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid #eeeee8',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0
      }}>
        <button
          onClick={() => goTo(page - 1)} disabled={page <= 1}
          style={{
            width: 30, height: 30, borderRadius: 7,
            border: '1px solid #eee', background: 'transparent',
            cursor: page > 1 ? 'pointer' : 'not-allowed',
            color: page > 1 ? '#555' : '#ccc', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >‹</button>

        <span style={{ fontSize: 12, color: '#888', flex: 1, textAlign: 'center' }}>
          ទំព័រ {page} / {total || '—'}
        </span>

        <button
          onClick={() => goTo(page + 1)} disabled={page >= total}
          style={{
            width: 30, height: 30, borderRadius: 7,
            border: '1px solid #eee', background: 'transparent',
            cursor: page < total ? 'pointer' : 'not-allowed',
            color: page < total ? '#555' : '#ccc', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >›</button>

        <a
          href={pdfUrl} target="_blank" rel="noopener noreferrer"
          style={{
            marginLeft: 8, fontSize: 12, color: '#0d7a57',
            display: 'flex', alignItems: 'center', gap: 4,
            textDecoration: 'none'
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          បើក PDF
        </a>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
