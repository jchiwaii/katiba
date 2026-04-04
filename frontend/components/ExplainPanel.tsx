'use client'

import { useState } from 'react'

export interface ExplainData {
  answer: string
  references: string[]
  exact_text: string
  explanation: string
}

export default function ExplainPanel({ question }: { question: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [data, setData] = useState<ExplainData | null>(null)
  const [eli5, setEli5] = useState(false)

  async function load(simple: boolean) {
    setState('loading')
    setEli5(simple)
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, eli5: simple }),
      })
      if (!res.ok) throw new Error()
      setData(await res.json())
      setState('done')
    } catch {
      setState('error')
    }
  }

  if (state === 'idle') return (
    <div className="flex gap-2 mt-3">
      <button onClick={() => load(false)}
        className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-[var(--green)] hover:text-[var(--green)]"
        style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}>
        Explain with AI
      </button>
      <button onClick={() => load(true)}
        className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:border-[var(--green)] hover:text-[var(--green)]"
        style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}>
        Explain Simply
      </button>
    </div>
  )

  if (state === 'loading') return (
    <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--dim)' }}>
      <span className="w-3 h-3 rounded-full border-2 border-t-transparent border-[var(--green)] animate-spin inline-block" />
      Thinking…
    </div>
  )

  if (state === 'error') return (
    <p className="mt-3 text-xs" style={{ color: 'var(--dim)' }}>
      AI unavailable.{' '}
      <button onClick={() => setState('idle')} className="underline" style={{ color: 'var(--green)' }}>Retry</button>
    </p>
  )

  if (!data) return null

  return (
    <div className="mt-3 rounded-xl p-4 space-y-3" style={{ background: 'var(--green-bg)', border: '1px solid #1e3d2a' }}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--green)' }}>
          AI · {eli5 ? 'Simple' : 'Standard'}
        </span>
        <button onClick={() => { setState('idle'); setData(null) }} className="text-xs hover:opacity-70" style={{ color: 'var(--dim)' }}>✕</button>
      </div>

      {data.answer && <p className="text-sm leading-7" style={{ color: 'var(--text)' }}>{data.answer}</p>}

      {data.exact_text && (
        <blockquote className="text-sm italic leading-7 border-l-2 pl-3" style={{ borderColor: 'var(--green)', color: 'var(--muted)' }}>
          &ldquo;{data.exact_text}&rdquo;
        </blockquote>
      )}

      {data.explanation && (
        <p className="text-sm leading-7" style={{ color: 'var(--muted)' }}>{data.explanation}</p>
      )}

      {data.references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {data.references.map(r => (
            <span key={r} className="text-xs px-2.5 py-0.5 rounded-full" style={{ background: '#142a1e', color: 'var(--green)', border: '1px solid #1e3d2a' }}>
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="pt-1 flex gap-3 text-xs" style={{ color: 'var(--green)' }}>
        {!eli5
          ? <button onClick={() => load(true)} className="underline underline-offset-2">Simplify</button>
          : <button onClick={() => load(false)} className="underline underline-offset-2">Standard</button>
        }
      </div>
    </div>
  )
}
