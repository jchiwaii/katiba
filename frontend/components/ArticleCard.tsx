'use client'

import { useState } from 'react'

export interface Article {
  article: number
  title: string
  chapter: string
  part: string
  text: string
}

export default function ArticleCard({ article, rank }: { article: Article; rank: number }) {
  const [open, setOpen] = useState(rank === 0)

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-xs font-mono font-bold flex-shrink-0 px-2 py-0.5 rounded-md" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
          {article.article}
        </span>
        <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
          {article.title}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--dim)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 text-sm leading-7 whitespace-pre-line" style={{ color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
          {article.text}
        </div>
      )}
    </div>
  )
}
