'use client'

import { useState } from 'react'

export interface ExplainData {
  answer: string
  references: string[]
  exact_text: string
  explanation: string
}

interface ExplainPanelProps {
  question: string
}

export default function ExplainPanel({ question }: ExplainPanelProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [data, setData] = useState<ExplainData | null>(null)
  const [eli5, setEli5] = useState(false)

  async function fetchExplanation(useEli5: boolean) {
    setState('loading')
    setEli5(useEli5)
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, eli5: useEli5 }),
      })
      if (!res.ok) throw new Error('Failed')
      const json: ExplainData = await res.json()
      setData(json)
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <div className="mt-3 flex gap-2 flex-wrap">
        <button
          onClick={() => fetchExplanation(false)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
        >
          <span>✦</span> Explain with AI
        </button>
        <button
          onClick={() => fetchExplanation(true)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
        >
          <span>✦</span> Explain Simply (ELI12)
        </button>
      </div>
    )
  }

  if (state === 'loading') {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        AI is reading the Constitution…
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="mt-3 text-xs text-red-600">
        AI unavailable. The constitutional text above still shows the relevant articles.
        <button onClick={() => setState('idle')} className="ml-2 underline">Try again</button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider flex items-center gap-1">
          <span>✦</span> AI Explanation {eli5 && '(Simple)'}
        </span>
        <button
          onClick={() => { setState('idle'); setData(null) }}
          className="text-xs text-blue-400 hover:text-blue-600"
        >
          ✕ Close
        </button>
      </div>

      {/* Answer */}
      {data.answer && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Answer</p>
          <p className="text-sm text-gray-800 leading-relaxed">{data.answer}</p>
        </div>
      )}

      {/* Exact text */}
      {data.exact_text && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Exact Constitutional Text</p>
          <blockquote className="text-sm text-gray-700 italic border-l-2 border-blue-400 pl-3">
            &ldquo;{data.exact_text}&rdquo;
          </blockquote>
        </div>
      )}

      {/* Simple explanation */}
      {data.explanation && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            {eli5 ? 'Simple Explanation' : 'In Plain English'}
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{data.explanation}</p>
        </div>
      )}

      {/* Re-explain buttons */}
      <div className="pt-1 flex gap-2 flex-wrap">
        {!eli5 && (
          <button
            onClick={() => fetchExplanation(true)}
            className="text-xs text-purple-600 hover:text-purple-800 underline"
          >
            Explain more simply
          </button>
        )}
        {eli5 && (
          <button
            onClick={() => fetchExplanation(false)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Show standard explanation
          </button>
        )}
      </div>
    </div>
  )
}
