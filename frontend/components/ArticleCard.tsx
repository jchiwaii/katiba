'use client'

import { useState } from 'react'

export interface Article {
  article?: number | null
  title: string
  chapter: string
  part: string
  text: string
  source_type?: string
  source_title?: string | null
  citation?: string | null
  source_url?: string | null
  section_title?: string | null
  status?: string | null
}

export default function ArticleCard({ article, rank }: { article: Article; rank: number }) {
  const [open, setOpen] = useState(rank === 0)
  const isImplementationLaw = article.source_type === 'implementation_law'
  const badge = isImplementationLaw ? 'Implementation Law' : `Article ${article.article}`
  const title = isImplementationLaw ? (article.source_title || article.title) : article.title
  const subtitle = isImplementationLaw
    ? [article.citation, article.section_title].filter(Boolean).join(' · ')
    : [article.chapter, article.part].filter(Boolean).join(' · ')

  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--soft-bg-hover)]"
      >
        <span
          className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium"
          style={{ background: 'var(--soft-bg-strong)', color: 'var(--muted)', border: '1px solid var(--line)' }}
        >
          {badge}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium" style={{ color: 'var(--text)' }}>
            {title}
          </span>
          {subtitle && (
            <span className="mt-0.5 block truncate text-[11px]" style={{ color: 'var(--dim)' }}>
              {subtitle}
            </span>
          )}
        </span>
        <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--dim)' }}>
          {open ? '▾' : '▸'}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          {isImplementationLaw && article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noreferrer"
              className="mb-2 inline-block text-[11px] underline-offset-4 hover:underline"
              style={{ color: 'var(--muted)' }}
            >
              View source on Kenya Law
            </a>
          )}
          <div className="whitespace-pre-line text-[13px] leading-6" style={{ color: 'var(--muted)' }}>
            {article.text}
          </div>
        </div>
      )}
    </div>
  )
}
