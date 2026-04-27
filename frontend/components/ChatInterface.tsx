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
  status: 'pending' | 'done' | 'error'
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
  const [pendingCount, setPendingCount] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingCount])

  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = '0px'
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`
  }, [input])

  async function search(query: string) {
    const q = query.trim()
    if (!q) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setInput('')
    setMessages(prev => [...prev, {
      id,
      question: q,
      answer: null,
      articles: [],
      status: 'pending',
    }])
    setPendingCount(count => count + 1)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setMessages(prev => prev.map(msg => (
        msg.id === id
          ? {
              ...msg,
              answer: data.answer ?? null,
              articles: data.articles ?? [],
              status: 'done',
            }
          : msg
      )))
    } catch {
      setMessages(prev => prev.map(msg => (
        msg.id === id
          ? {
              ...msg,
              status: 'error',
              error: 'Could not reach the server. Please try again.',
            }
          : msg
      )))
    } finally {
      setPendingCount(count => Math.max(0, count - 1))
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
      <aside
        className="hidden h-screen w-[268px] flex-shrink-0 flex-col border-r lg:flex"
        style={{ borderColor: 'var(--line)', background: 'var(--shell)' }}
      >
        <div className="flex h-full flex-col px-4 py-4">
          <button onClick={clearSession} className="mb-4 flex items-center gap-2.5 rounded-lg px-1 py-1 text-left transition-colors hover:bg-[var(--soft-bg-hover)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--panel-strong)', color: 'var(--green)' }}>
              <BrandIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold tracking-[-0.01em]" style={{ color: 'var(--text)', fontFamily: 'var(--font-lora), Georgia, serif' }}>Katiba</span>
          </button>

          <button
            onClick={clearSession}
            className="mb-4 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition-colors hover:bg-[var(--soft-bg-hover)]"
            style={{ borderColor: 'var(--line)', background: 'var(--panel-strong)', color: 'var(--text)' }}
          >
            <span>New Chat</span>
            <span className="text-[14px]" style={{ color: 'var(--green)' }}>+</span>
          </button>

          <div className="min-h-0 flex-1 border-t pt-4" style={{ borderColor: 'var(--line)' }}>
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--dim)' }}>
              Chapters
            </p>
            <div className="space-y-0.5">
              {CHAPTERS.map(ch => (
                <button
                  key={ch.label}
                  onClick={() => search(ch.query)}
                  className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] leading-5 text-[var(--muted)] transition-colors hover:bg-[var(--soft-bg-hover)] hover:text-[var(--text)]"
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex-shrink-0 border-b px-4 py-3 lg:px-6" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border lg:hidden" style={{ borderColor: 'var(--line)', background: 'var(--panel-strong)', color: 'var(--green)' }}>
                <BrandIcon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium" style={{ color: 'var(--text)' }}>General / Constitution of Kenya, 2010</p>
                {pendingCount > 0 && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--dim)' }} aria-live="polite">
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--green)' }} />
                    Thinking
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {messages.length > 0 && (
                <button onClick={clearSession} className="rounded-md px-2 py-1 text-[11px] transition-colors hover:bg-[var(--soft-bg-hover)]" style={{ color: 'var(--dim)' }}>
                  Clear
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:px-6 lg:py-8">
            {messages.length === 0 && (
              <div className="mx-auto max-w-2xl pt-8 sm:pt-14">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--line)', background: 'var(--panel-strong)', color: 'var(--green)', boxShadow: 'var(--shadow-soft)' }}>
                  <BrandIcon className="h-4 w-4" />
                </div>
                <h1 className="mb-1 text-[20px] font-semibold tracking-[-0.01em]" style={{ fontFamily: 'var(--font-lora), Georgia, serif', color: 'var(--text)' }}>
                  Ask Katiba
                </h1>
                <p className="mb-6 max-w-lg text-[13px] leading-6" style={{ color: 'var(--muted)' }}>
                  Rights, public offices, elections, devolution, amendments, and implementation laws.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {COMMON_QUESTIONS.map(q => (
                    <button
                      key={q}
                      onClick={() => search(q)}
                      className="rounded-lg border px-3.5 py-2.5 text-left text-[12px] leading-5 transition-colors hover:border-[var(--green)] hover:bg-[var(--soft-bg)]"
                      style={{ borderColor: 'var(--line)', color: 'var(--muted)', background: 'var(--panel-strong)' }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className="space-y-2.5">
                <div className="flex justify-end">
                  <div
                    className="max-w-[82%] rounded-lg px-3.5 py-2.5 text-[13px] leading-6 sm:max-w-md"
                    style={{ background: 'var(--user-bg)', color: 'var(--text)' }}
                  >
                    {msg.question}
                  </div>
                </div>

                {msg.error && (
                  <div className="rounded-lg px-3.5 py-3 text-[13px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                    {msg.error}
                  </div>
                )}

                {msg.answer && (
                  <div className="flex justify-start">
                    <div
                      className="max-w-[92%] rounded-lg px-4 py-3.5 text-[13px] leading-7"
                      style={{ background: 'var(--answer-bg)', border: '1px solid var(--line)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
                    >
                      {msg.answer}
                    </div>
                  </div>
                )}

                {msg.status === 'pending' && (
                  <div className="flex justify-start">
                    <div
                      className="flex items-center gap-1.5 rounded-lg px-3.5 py-3"
                      style={{ background: 'var(--answer-bg)', border: '1px solid var(--line)' }}
                    >
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-bounce rounded-full"
                          style={{ background: 'var(--green)', animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {msg.articles.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--dim)' }}>Sources</p>
                      <p className="text-[10px]" style={{ color: 'var(--dim)' }}>{Math.min(msg.articles.length, 6)} shown</p>
                    </div>
                    {msg.articles.slice(0, 6).map((art, i) => (
                      <ArticleCard key={`${art.source_type ?? 'constitution'}-${art.article ?? art.source_title}-${i}`} article={art} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="flex-shrink-0 border-t px-4 py-3" style={{ borderColor: 'var(--line)', background: 'var(--footer-bg)' }}>
          <form
            onSubmit={submit}
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border p-1.5"
            style={{ borderColor: 'var(--line)', background: 'var(--input-bg)', boxShadow: 'var(--shadow-soft)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); search(input) } }}
              placeholder="Ask about rights, offices, elections, or the Constitution..."
              rows={1}
              className="min-h-9 flex-1 resize-none bg-transparent px-3 py-2 text-[13px] leading-6 outline-none"
              style={{ color: 'var(--text)', maxHeight: '140px' }}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="min-h-9 flex-shrink-0 rounded-md px-3.5 py-2 text-[12px] font-semibold transition-opacity disabled:opacity-30"
              style={{ background: 'var(--green)', color: 'var(--button-text)' }}
            >
              Send
            </button>
          </form>
          <p className="mt-2 text-center text-[10px]" style={{ color: 'var(--dim)' }}>
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
