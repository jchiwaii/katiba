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
  const [expanded, setExpanded] = useState(rank === 0) // first result open by default

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-green-100 text-green-800 text-xs font-bold flex items-center justify-center">
          {article.article}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 text-sm">{article.title}</p>
          {article.chapter && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{article.chapter}</p>
          )}
        </div>
        <span className="text-gray-400 text-sm flex-shrink-0 mt-0.5">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {article.text}
          </p>
        </div>
      )}
    </div>
  )
}
