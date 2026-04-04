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
    <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span
          className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--line)' }}
        >
          Article {article.article}
        </span>
        <span className="flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>{article.title}</span>
        <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--dim)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="whitespace-pre-line px-4 pb-4 pt-1 text-[13px] leading-6" style={{ color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
          {article.text}
        </div>
      )}
    </div>
  )
}
