'use client'

import { useEffect, useRef, useState } from 'react'
import ArticleCard, { Article } from './ArticleCard'
import ExplainPanel from './ExplainPanel'

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

const SUGGESTED = [
  'Do I have the right to protest?',
  'Can the president fire a governor?',
  'What are my rights if arrested?',
  'Freedom of expression',
  'Right to healthcare and education',
  'How is the president elected?',
]

const EXPLORE_ITEMS = [
  ['Explore Katiba', 'what rights are protected in the constitution'],
  ['The Executive', 'powers of the president'],
  ['Mission Hub', 'county government powers'],
] as const

const LIBRARY_ITEMS = [
  'Freedom of expression',
  'How is the president elected?',
  'What are my rights if arrested?',
  'Right to healthcare and education',
]

export default function ChatInterface() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const suggestionIndexRef = useRef(0)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = '0px'
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`
  }, [input])

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

  function cycleSuggestion() {
    const next = SUGGESTED[suggestionIndexRef.current % SUGGESTED.length]
    suggestionIndexRef.current += 1
    setInput(next)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function clearSession() {
    setMessages([])
    setInput('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const sessionQuestions = Array.from(new Set(messages.map(message => message.question).reverse()))
  const sidebarRecent = sessionQuestions.length > 0 ? sessionQuestions.slice(0, 6) : SUGGESTED.slice(0, 6)
  const homeCards = sidebarRecent.slice(0, 3)

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <aside
        className="hidden w-[248px] flex-shrink-0 flex-col border-r px-4 py-5 lg:flex"
        style={{ borderColor: 'var(--line)', background: 'rgba(8,8,8,0.72)' }}
      >
        <button onClick={clearSession} className="flex items-center gap-3 text-left">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl border"
            style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.02)', color: 'var(--green)' }}
          >
            <BrandIcon className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            Katiba
          </span>
        </button>

        <button
          onClick={() => {
            clearSession()
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          className="mt-6 flex items-center justify-between rounded-xl border px-3 py-3 text-sm transition-colors hover:bg-white/[0.03]"
          style={{ borderColor: 'var(--line)', background: 'var(--card)', color: 'var(--text)' }}
        >
          <span className="flex items-center gap-2">
            <PlusIcon className="h-3.5 w-3.5" />
            New Chat
          </span>
          <span className="rounded-md px-1.5 py-0.5 text-[10px]" style={{ background: '#232323', color: 'var(--dim)' }}>
            N
          </span>
        </button>

        <div className="mt-5 space-y-1">
          {EXPLORE_ITEMS.map(([label, question]) => (
            <button
              key={label}
              onClick={() => search(question)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.03]"
              style={{ color: 'var(--muted)' }}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md border" style={{ borderColor: 'var(--line)' }}>
                <DotIcon className="h-3 w-3" />
              </span>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-8">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--dim)' }}>
            This Session
          </p>
          <div className="space-y-1">
            {sidebarRecent.map(item => (
              <button
                key={item}
                onClick={() => search(item)}
                className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.03]"
                style={{ color: 'var(--muted)' }}
                title={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--dim)' }}>
            Library
          </p>
          <div className="space-y-1">
            {LIBRARY_ITEMS.map(item => (
              <button
                key={item}
                onClick={() => search(item)}
                className="block w-full truncate rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-white/[0.03]"
                style={{ color: 'var(--muted)' }}
                title={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto rounded-2xl border px-4 py-4" style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.02)' }}>
          <p className="mb-1 text-sm font-medium" style={{ color: 'var(--text)' }}>Grounded search</p>
          <p className="text-xs leading-5" style={{ color: 'var(--dim)' }}>
            Search is instant. AI explanation only appears when you ask for it.
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b px-4 py-4 lg:px-6" style={{ borderColor: 'var(--line)', background: 'rgba(10,10,10,0.82)' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs" style={{ color: 'var(--dim)' }}>
                General <span style={{ color: 'var(--muted)' }}>/</span> <span style={{ color: 'var(--text)' }}>Katiba</span>
              </p>
            </div>
            {messages.length > 0 && (
              <button onClick={clearSession} className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'var(--dim)' }}>
                Clear
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-[900px] flex-col items-center px-4 pb-16 pt-18 text-center lg:px-6 lg:pt-24">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl border"
                style={{ borderColor: 'var(--line)', background: 'rgba(255,255,255,0.03)', color: 'var(--green)' }}
              >
                <BrandIcon className="h-6 w-6" />
              </div>

              <p className="mt-6 text-sm" style={{ color: 'var(--muted)' }}>Good to See You!</p>
              <h1
                className="mt-2 max-w-[520px] text-[28px] font-medium leading-[1.25] tracking-tight sm:text-[34px]"
                style={{ color: 'var(--text)' }}
              >
                How can Katiba assist?
              </h1>

              <div className="mt-8 w-full max-w-[700px]">
                <Composer
                  input={input}
                  loading={loading}
                  onChange={setInput}
                  onSubmit={event => {
                    event.preventDefault()
                    search(input)
                  }}
                  onCycleSuggestion={cycleSuggestion}
                  onSearch={search}
                  inputRef={inputRef}
                />
              </div>

              <div className="mt-4 flex w-full max-w-[700px] flex-wrap gap-2">
                {SUGGESTED.slice(0, 5).map(item => (
                  <button
                    key={item}
                    onClick={() => search(item)}
                    className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-white/[0.03]"
                    style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="mt-8 w-full max-w-[700px] text-left">
                <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text)' }}>Recent searches</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {homeCards.map(item => (
                    <button
                      key={item}
                      onClick={() => search(item)}
                      className="rounded-2xl border px-4 py-4 text-left transition-colors hover:bg-white/[0.03]"
                      style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
                    >
                      <p className="text-sm font-medium leading-6" style={{ color: 'var(--text)' }}>
                        {item}
                      </p>
                      <p className="mt-3 text-xs" style={{ color: 'var(--dim)' }}>
                        Search constitutional articles
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[760px] px-4 py-8 lg:px-6">
              <div className="space-y-7">
                {messages.map(msg => (
                  <div key={msg.id} className="space-y-3">
                    <div className="flex justify-end">
                      <div
                        className="max-w-[460px] rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-7"
                        style={{ background: 'var(--user-bg)', color: 'var(--text)' }}
                      >
                        {msg.question}
                      </div>
                    </div>

                    {msg.type === 'error' && (
                      <p className="rounded-xl px-4 py-3 text-sm" style={{ background: '#1f0e0e', color: '#f87171' }}>
                        {msg.content as string}
                      </p>
                    )}

                    {msg.type === 'result' && (() => {
                      const result = msg.content as SearchResult
                      return result.articles.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--dim)' }}>
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
                              style={{ borderColor: 'var(--line)', color: 'var(--dim)', background: 'rgba(255,255,255,0.02)' }}
                            >
                              Grounded
                            </span>
                          </div>
                          {result.articles.slice(0, 5).map((art, index) => (
                            <ArticleCard key={`${art.article}-${index}`} article={art} rank={index} />
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
          <div className="border-t px-4 py-4 lg:px-6" style={{ borderColor: 'var(--line)', background: 'rgba(10,10,10,0.88)' }}>
            <div className="mx-auto max-w-[760px]">
              <Composer
                input={input}
                loading={loading}
                onChange={setInput}
                onSubmit={event => {
                  event.preventDefault()
                  search(input)
                }}
                onCycleSuggestion={cycleSuggestion}
                onSearch={search}
                inputRef={inputRef}
                compact
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
  loading,
  onChange,
  onSubmit,
  onCycleSuggestion,
  onSearch,
  inputRef,
}: {
  compact?: boolean
  input: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onCycleSuggestion: () => void
  onSearch: (query: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
      <div className="mb-3 flex items-center justify-between gap-3 border-b pb-3 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--dim)' }}>
        <span>Grounded article search only</span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--green)' }} />
          AI explanation optional
        </span>
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <button
          type="button"
          onClick={onCycleSuggestion}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border transition-colors hover:bg-white/[0.03]"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          aria-label="Insert suggested prompt"
        >
          <PlusIcon className="h-4 w-4" />
        </button>

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
          className={`flex-1 resize-none bg-transparent outline-none placeholder:text-[var(--dim)] ${compact ? 'py-2 text-sm' : 'py-2.5 text-sm'}`}
          style={{ color: 'var(--text)', maxHeight: '120px' }}
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-10 flex-shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-opacity disabled:opacity-30"
          style={{ background: 'var(--green)', color: '#07150f' }}
        >
          <SearchIcon className="h-4 w-4" />
          Search
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

function PlusIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

function DotIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}
