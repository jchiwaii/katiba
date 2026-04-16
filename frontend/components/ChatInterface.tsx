'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ArticleCard, { Article } from './ArticleCard'
import ThemeToggle from './ThemeToggle'

interface Message {
  id: string
  question: string
  answer: string | null
  articles: Article[]
  error?: string
}

const COMMON_QUESTIONS = [
  'Do I have the right to protest?',
  'What are my rights if arrested?',
  'Can the president fire a governor?',
  'How is the president elected?',
  'Freedom of expression',
  'Right to healthcare and education',
]

const CHAPTERS = [
  { label: 'Chapter 1 – Sovereignty',           query: 'sovereignty of the people' },
  { label: 'Chapter 2 – The Republic',           query: 'chapter two the republic' },
  { label: 'Chapter 3 – Citizenship',            query: 'citizenship and nationality' },
  { label: 'Chapter 4 – Bill of Rights',         query: 'bill of rights fundamental freedoms' },
  { label: 'Chapter 5 – Land & Environment',     query: 'land ownership environment' },
  { label: 'Chapter 6 – Leadership & Integrity', query: 'leadership and integrity state officers' },
  { label: 'Chapter 7 – Representation',         query: 'representation of the people elections' },
  { label: 'Chapter 8 – The Legislature',        query: 'parliament national assembly senate' },
  { label: 'Chapter 9 – The Executive',          query: 'executive president cabinet' },
  { label: 'Chapter 10 – Judiciary',             query: 'judiciary courts judges' },
  { label: 'Chapter 11 – Devolution',            query: 'county government devolution' },
  { label: 'Chapter 12 – Public Finance',        query: 'public finance budget taxation' },
  { label: 'Chapter 13 – Public Service',        query: 'public service commission' },
  { label: 'Chapter 14 – National Security',     query: 'national security defence police' },
  { label: 'Chapter 15 – Commissions',           query: 'independent commissions offices' },
  { label: 'Chapter 16 – Amendments',            query: 'amendment of the constitution' },
  { label: 'Chapter 17 – General',               query: 'general provisions' },
  { label: 'Chapter 18 – Transitional',          query: 'transitional provisions' },
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

  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = '0px'
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`
  }, [input])

  async function search(query: string) {
    const q = query.trim()
    if (!q || loading) return
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: `${Date.now()}`,
        question: q,
        answer: data.answer ?? null,
        articles: data.articles ?? [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: `${Date.now()}`,
        question: q,
        answer: null,
        articles: [],
        error: 'Could not reach the server. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    search(input)
  }

  function clearSession() {
    setMessages([])
    setInput('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside
        className="hidden h-screen w-[252px] flex-shrink-0 flex-col border-r lg:flex"
        style={{ borderColor: 'var(--line)', background: 'var(--shell)' }}
      >
        <div className="flex h-full flex-col px-4 py-5">

          {/* Wordmark */}
          <button onClick={clearSession} className="flex items-center gap-2.5 text-left mb-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--soft-bg)', color: 'var(--green)' }}>
              <BrandIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
              Katiba
            </span>
          </button>

          {/* New Chat */}
          <button
            onClick={clearSession}
            className="w-full rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-[var(--soft-bg-hover)] mb-5"
            style={{ borderColor: 'var(--line)', background: 'var(--card)', color: 'var(--text)' }}
          >
            + New Chat
          </button>

          {/* Chapters — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--dim)' }}>
              Chapters
            </p>
            <div className="space-y-0.5">
              {CHAPTERS.map(ch => (
                <button
                  key={ch.label}
                  onClick={() => search(ch.query)}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-[var(--soft-bg-hover)]"
                  style={{ color: 'var(--muted)' }}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="border-b px-4 py-3 lg:px-6 flex-shrink-0" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border lg:hidden" style={{ borderColor: 'var(--line)', background: 'var(--soft-bg)', color: 'var(--green)' }}>
                <BrandIcon className="h-3.5 w-3.5" />
              </span>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>Constitution of Kenya, 2010</p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {messages.length > 0 && (
                <button onClick={clearSession} className="text-[11px]" style={{ color: 'var(--dim)' }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div className="pt-4">
                <h1 className="text-[22px] font-semibold mb-1" style={{ fontFamily: 'var(--font-lora), Georgia, serif', color: 'var(--text)' }}>
                  Ask the Constitution
                </h1>
                <p className="text-[13px] mb-7" style={{ color: 'var(--muted)' }}>
                  Ask anything in plain language — get a direct answer grounded in the Constitution.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {COMMON_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => search(q)}
                      className="text-left text-[13px] px-4 py-3 rounded-xl border transition-colors hover:border-[var(--green)] hover:bg-[var(--soft-bg)]"
                      style={{ border: '1px solid var(--line)', color: 'var(--muted)', background: 'var(--card)' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message thread */}
            {messages.map(msg => (
              <div key={msg.id} className="space-y-3">

                {/* User bubble */}
                <div className="flex justify-end">
                  <div
                    className="max-w-sm rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] leading-6"
                    style={{ background: 'var(--user-bg)', color: 'var(--text)' }}
                  >
                    {msg.question}
                  </div>
                </div>

                {/* Error */}
                {msg.error && (
                  <div className="rounded-2xl px-4 py-3 text-[13px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                    {msg.error}
                  </div>
                )}

                {/* AI answer */}
                {msg.answer && (
                  <div
                    className="rounded-2xl px-4 py-3.5 text-[13px] leading-7"
                    style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text)' }}
                  >
                    {msg.answer}
                  </div>
                )}

                {/* Reference articles */}
                {msg.articles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] px-1" style={{ color: 'var(--dim)' }}>
                      Sources
                    </p>
                    {msg.articles.slice(0, 6).map((art, i) => (
                      <ArticleCard key={`${art.source_type ?? 'constitution'}-${art.article ?? art.source_title}-${i}`} article={art} rank={i} />
                    ))}
                  </div>
                )}

              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-1.5" style={{ background: 'var(--user-bg)' }}>
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: 'var(--green)', animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--footer-bg)' }}>
          <form onSubmit={submit} className="mx-auto max-w-2xl flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); search(input) } }}
              placeholder="Ask anything about the Constitution…"
              rows={1}
              className="flex-1 resize-none rounded-xl px-4 py-2.5 text-[13px] outline-none transition-colors"
              style={{ background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--text)', maxHeight: '140px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex-shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-opacity disabled:opacity-30"
              style={{ background: 'var(--green)', color: 'var(--button-text)' }}
            >
              Send
            </button>
          </form>
          <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--dim)' }}>
            Answers cite exact articles and related implementation laws
          </p>
        </div>

      </div>
    </div>
  )
}

function BrandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".9" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".9" />
    </svg>
  )
}
