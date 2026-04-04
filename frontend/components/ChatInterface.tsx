'use client'

import { useEffect, useRef, useState } from 'react'
import ArticleCard, { Article } from './ArticleCard'
import ExplainPanel from './ExplainPanel'

interface SearchResult { question: string; articles: Article[] }
interface Message {
  id: string
  type: 'result' | 'error'
  question: string
  content: SearchResult | string
}

const SUGGESTED = [
  'Do I have the right to protest?',
  'Can the president fire a governor?',
  'Rights if arrested',
  'Freedom of expression',
  'Right to healthcare and education',
  'How is the president elected?',
]

export default function ChatInterface() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function search(q: string) {
    const trimmed = q.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      })
      if (!res.ok) throw new Error()
      const data: SearchResult = await res.json()
      setMessages(p => [...p, { id: `${Date.now()}`, type: 'result', question: trimmed, content: data }])
    } catch {
      setMessages(p => [...p, { id: `${Date.now()}`, type: 'error', question: trimmed, content: 'Server error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>

      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r py-5 px-4" style={{ borderColor: 'var(--line)' }}>
        <button onClick={() => setMessages([])} className="flex items-center gap-2 mb-6">
          <span className="text-base font-bold tracking-tight" style={{ color: 'var(--green)', fontFamily: 'var(--font-lora), Georgia, serif' }}>Katiba</span>
        </button>

        <button
          onClick={() => { setMessages([]); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="w-full text-left text-sm px-3 py-2.5 rounded-lg mb-4 border transition-colors hover:border-[var(--green)]"
          style={{ border: '1px solid var(--line)', color: 'var(--muted)' }}
        >
          + New search
        </button>

        <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--dim)' }}>Explore</p>
        {[
          ['Bill of Rights', 'what is the bill of rights'],
          ['The Executive', 'powers of the president'],
          ['Judiciary', 'functions of the judiciary'],
          ['Devolution', 'county government powers'],
          ['Elections', 'how is the president elected'],
        ].map(([label, q]) => (
          <button key={label} onClick={() => search(q)}
            className="text-left text-sm px-3 py-2 rounded-lg hover:bg-white/5 transition-colors w-full"
            style={{ color: 'var(--muted)' }}>
            {label}
          </button>
        ))}

        <div className="mt-auto">
          <p className="text-[11px] leading-5" style={{ color: 'var(--dim)' }}>
            Search is free. AI explanations are optional.
          </p>
        </div>
      </aside>

      {/* Chat main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <span className="font-bold" style={{ color: 'var(--green)', fontFamily: 'var(--font-lora), Georgia, serif' }}>Katiba</span>
          {messages.length > 0 && (
            <button onClick={() => setMessages([])} className="text-xs" style={{ color: 'var(--dim)' }}>Clear</button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="pt-8">
                <h1 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-lora), Georgia, serif', color: 'var(--text)' }}>
                  Ask the Constitution
                </h1>
                <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
                  Constitution of Kenya, 2010 · Grounded article citations
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTED.map(s => (
                    <button key={s} onClick={() => search(s)}
                      className="text-left text-sm px-4 py-3 rounded-xl border hover:border-[var(--green)] hover:text-[var(--text)] transition-colors"
                      style={{ border: '1px solid var(--line)', color: 'var(--muted)', background: 'var(--card)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message thread */}
            {messages.map(msg => (
              <div key={msg.id} className="space-y-3">

                {/* User question bubble */}
                <div className="flex justify-end">
                  <div className="text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-sm" style={{ background: 'var(--user-bg)', color: 'var(--text)' }}>
                    {msg.question}
                  </div>
                </div>

                {/* Error */}
                {msg.type === 'error' && (
                  <p className="text-sm px-4 py-3 rounded-xl" style={{ background: '#1f0e0e', color: '#f87171' }}>
                    {msg.content as string}
                  </p>
                )}

                {/* Results */}
                {msg.type === 'result' && (() => {
                  const result = msg.content as SearchResult
                  return result.articles.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--dim)' }}>No matching articles found. Try rephrasing.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs" style={{ color: 'var(--dim)' }}>
                        {result.articles.length} article{result.articles.length !== 1 ? 's' : ''} found
                      </p>
                      {result.articles.slice(0, 5).map((art, i) => (
                        <ArticleCard key={`${art.article}-${i}`} article={art} rank={i} />
                      ))}
                      <ExplainPanel question={result.question} />
                    </div>
                  )
                })()}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex justify-end">
                <div className="px-4 py-2.5 rounded-2xl rounded-tr-sm flex items-center gap-2" style={{ background: 'var(--user-bg)' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--green)', animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--line)' }}>
          <form
            onSubmit={e => { e.preventDefault(); search(input) }}
            className="max-w-2xl mx-auto flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); search(input) } }}
              placeholder="Ask about the Constitution…"
              rows={1}
              className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none placeholder:text-[var(--dim)] transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text)', maxHeight: '120px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-30"
              style={{ background: 'var(--green)', color: '#000' }}
            >
              Send
            </button>
          </form>
          <p className="text-center text-[11px] mt-2" style={{ color: 'var(--dim)' }}>
            Constitution of Kenya, 2010 · Results cite exact articles
          </p>
        </div>

      </div>
    </div>
  )
}
