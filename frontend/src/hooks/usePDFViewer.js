import { useState } from 'react'
import { api } from '../services/api'

export function usePDFViewer() {
  const [isOpen,   setIsOpen]   = useState(false)
  const [citation, setCitation] = useState(null)

  const openCitation = (cit) => { setCitation(cit); setIsOpen(true) }
  const close = () => { setIsOpen(false); setCitation(null) }

  return {
    isOpen,
    citation,
    pdfUrl: citation ? api.getPDFUrl(citation.pdf_filename) : null,
    openCitation,
    close,
  }
}
