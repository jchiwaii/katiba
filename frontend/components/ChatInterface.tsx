'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ArticleCard, { Article } from './ArticleCard'
import ExplainPanel from './ExplainPanel'
import ThemeToggle from './ThemeToggle'

interface SearchResult {
  question: string
  articles: Article[]
}

interface Message {
  id: string
  type: 'result' | 'error'
  question: string
  content: SearchResult | string
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
  { label: 'Chapter 1', title: 'Sovereignty of the People', query: 'chapter one sovereignty of the people and supremacy of this constitution' },
  { label: 'Chapter 2', title: 'The Republic', query: 'chapter two the republic' },
  { label: 'Chapter 3', title: 'Citizenship', query: 'chapter three citizenship' },
  { label: 'Chapter 4', title: 'Bill of Rights', query: 'chapter four bill of rights' },
  { label: 'Chapter 5', title: 'Land and Environment', query: 'chapter five land and environment' },
  { label: 'Chapter 6', title: 'Leadership and Integrity', query: 'chapter six leadership and integrity' },
  { label: 'Chapter 7', title: 'Representation of the People', query: 'chapter seven representation of the people' },
  { label: 'Chapter 8', title: 'The Legislature', query: 'chapter eight the legislature' },
  { label: 'Chapter 9', title: 'The Executive', query: 'chapter nine the executive' },
  { label: 'Chapter 10', title: 'The Judiciary', query: 'chapter ten judiciary' },
  { label: 'Chapter 11', title: 'Devolved Government', query: 'chapter eleven devolved government' },
  { label: 'Chapter 12', title: 'Public Finance', query: 'chapter twelve public finance' },
  { label: 'Chapter 13', title: 'The Public Service', query: 'chapter thirteen public service' },
  { label: 'Chapter 14', title: 'National Security', query: 'chapter fourteen national security' },
  { label: 'Chapter 15', title: 'Commissions and Independent Offices', query: 'chapter fifteen commissions and independent offices' },
  { label: 'Chapter 16', title: 'Amendment of the Constitution', query: 'chapter sixteen amendment of this constitution' },
  { label: 'Chapter 17', title: 'General Provisions', query: 'chapter seventeen general provisions' },
  { label: 'Chapter 18', title: 'Transitional Provisions', query: 'chapter eighteen transitional and consequential provisions' },
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
    const trimmed = query.trim()
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
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}`, type: 'result', question: trimmed, content: data },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { id: `${Date.now()}`, type: 'error', question: trimmed, content: 'Server error. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
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
        className="hidden h-screen w-[280px] flex-shrink-0 border-r lg:block"
        style={{ borderColor: 'var(--line)', background: 'var(--shell)' }}
      >
        <div className="flex h-full flex-col px-4 py-5">
          <button onClick={clearSession} className="flex items-center gap-3 text-left">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl border"
              style={{ borderColor: 'var(--line)', background: 'var(--soft-bg)', color: 'var(--green)' }}
            >
              <BrandIcon className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              Katiba
            </span>
          </button>

          <button
            onClick={clearSession}
            className="mt-6 rounded-xl border px-3 py-3 text-left text-[13px] font-medium transition-colors hover:bg-[var(--soft-bg-hover)]"
            style={{ borderColor: 'var(--line)', background: 'var(--card)', color: 'var(--text)' }}
          >
            New Chat
          </button>

          <div className="mt-6">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--dim)' }}>
              Chapters
            </p>
            <div className="space-y-1">
              {CHAPTERS.map(chapter => (
                <button
                  key={chapter.label}
                  onClick={() => search(chapter.query)}
                  className="block w-full rounded-xl px-3 py-1.5 text-left transition-colors hover:bg-[var(--soft-bg-hover)]"
                >
                  <span className="block text-xs leading-5" style={{ color: 'var(--muted)' }}>
                    {chapter.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b px-4 py-4 lg:px-6" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-xl border lg:hidden"
                style={{ borderColor: 'var(--line)', background: 'var(--soft-bg)', color: 'var(--green)' }}
              >
                <BrandIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--dim)' }}>Ask the Constitution</p>
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Grounded article citations</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {messages.length > 0 && (
                <button
                  onClick={clearSession}
                  className="text-[9px] uppercase tracking-[0.1em]"
                  style={{ color: 'var(--dim)' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-[760px] flex-col px-4 pb-16 pt-18 lg:px-6 lg:pt-20">
              <div className="text-center">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border"
                  style={{ borderColor: 'var(--line)', background: 'var(--soft-bg)', color: 'var(--green)' }}
                >
                  <BrandIcon className="h-6 w-6" />
                </div>
                <h1
                  className="mt-6 text-[22px] font-medium leading-[1.3] tracking-tight sm:text-[24px]"
                  style={{ color: 'var(--text)' }}
                >
                  What would you like to ask?
                </h1>
                <p className="mx-auto mt-2 max-w-[520px] text-[13px] leading-6" style={{ color: 'var(--muted)' }}>
                  Search articles directly, then use AI explanation only if you want extra context.
                </p>
              </div>

              <div className="mt-8">
                <Composer
                  input={input}
                  inputRef={inputRef}
                  loading={loading}
                  onChange={setInput}
                  onSubmit={submit}
                  onSearch={search}
                />
              </div>

              <div className="mt-8">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--dim)' }}>
                  Common Questions
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {COMMON_QUESTIONS.map(question => (
                    <button
                      key={question}
                      onClick={() => search(question)}
                      className="rounded-2xl border px-4 py-4 text-left text-[13px] leading-6 transition-colors hover:bg-[var(--soft-bg-hover)]"
                      style={{ borderColor: 'var(--line)', background: 'var(--card)', color: 'var(--text)' }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[760px] px-4 py-8 lg:px-6">
              <div className="space-y-7">
                {messages.map(message => (
                  <div key={message.id} className="space-y-3">
                    <div className="flex justify-end">
                      <div
                        className="max-w-[460px] rounded-2xl rounded-tr-md px-4 py-3 text-[13px] leading-6"
                        style={{ background: 'var(--user-bg)', color: 'var(--text)' }}
                      >
                        {message.question}
                      </div>
                    </div>

                    {message.type === 'error' && (
                      <p className="rounded-xl px-4 py-3 text-[13px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                        {message.content as string}
                      </p>
                    )}

                    {message.type === 'result' && (() => {
                      const result = message.content as SearchResult
                      return result.articles.length === 0 ? (
                        <p className="text-[13px]" style={{ color: 'var(--dim)' }}>
                          No matching articles found. Try rephrasing.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'var(--dim)' }}>
                              {result.articles.length} article{result.articles.length !== 1 ? 's' : ''} found
                            </p>
                            <span
                              className="rounded-full border px-3 py-1 text-[11px]"
                              style={{ borderColor: 'var(--line)', color: 'var(--dim)', background: 'var(--soft-bg)' }}
                            >
                              Grounded
                            </span>
                          </div>
                          {result.articles.slice(0, 5).map((article, index) => (
                            <ArticleCard key={`${article.article}-${index}`} article={article} rank={index} />
                          ))}
                          <ExplainPanel question={result.question} />
                        </div>
                      )
                    })()}
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-end">
                    <div className="flex items-center gap-2 rounded-2xl rounded-tr-md px-4 py-3" style={{ background: 'var(--user-bg)' }}>
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full animate-bounce"
                          style={{ background: 'var(--green)', animationDelay: `${i * 120}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="border-t px-4 py-4 lg:px-6" style={{ borderColor: 'var(--line)', background: 'var(--footer-bg)' }}>
            <div className="mx-auto max-w-[760px]">
              <Composer
                compact
                input={input}
                inputRef={inputRef}
                loading={loading}
                onChange={setInput}
                onSubmit={submit}
                onSearch={search}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Composer({
  compact = false,
  input,
  inputRef,
  loading,
  onChange,
  onSubmit,
  onSearch,
}: {
  compact?: boolean
  input: string
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  loading: boolean
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onSearch: (query: string) => void
}) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              onSearch(input)
            }
          }}
          placeholder="Ask anything about the Constitution..."
          rows={1}
          className={`flex-1 resize-none bg-transparent outline-none placeholder:text-[var(--dim)] ${compact ? 'py-2 text-[13px]' : 'py-2.5 text-[13px]'}`}
          style={{ color: 'var(--text)', maxHeight: '120px' }}
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 flex-shrink-0 items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-opacity disabled:opacity-30"
          style={{ background: 'var(--green)', color: 'var(--button-text)' }}
        >
          <SendIcon className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  )
}

function BrandIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M8 6.5 6.5 8 8 9.5" />
      <path d="M16 6.5 17.5 8 16 9.5" />
      <path d="M8 17.5 6.5 16 8 14.5" />
      <path d="M16 17.5 17.5 16 16 14.5" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="2" />
    </svg>
  )
}

function SendIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M4 12 20 4l-4 16-4.5-6.5L4 12Z" />
      <path d="M11.5 13.5 20 4" />
    </svg>
  )
}
