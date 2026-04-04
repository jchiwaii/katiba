'use client'

import { useState, useRef, useEffect } from 'react'
import ArticleCard, { Article } from './ArticleCard'
import ExplainPanel from './ExplainPanel'

interface SearchResult {
  question: string
  articles: Article[]
}

interface Message {
  id: string
  type: 'question' | 'result' | 'error'
  content: string | SearchResult
}

const EXAMPLE_QUESTIONS = [
  'Do I have the right to protest?',
  'Can the president fire a governor?',
  'What are my rights if arrested?',
  'Freedom of expression',
  'Right to education and healthcare',
  'How is the president elected?',
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function search(question: string) {
    if (!question.trim() || loading) return

    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'question', content: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data: SearchResult = await res.json()
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), type: 'result', content: data }])
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'error',
        content: 'Could not reach the server. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    search(input)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <p className="text-center text-gray-400 text-sm mb-5">
              Search the Constitution — results are instant and free.
              <br />
              <span className="text-xs">AI explanation is optional, only when you need it.</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => search(q)}
                  className="text-left text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-green-400 hover:bg-green-50 transition-colors text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map(msg => (
            <div key={msg.id}>
              {/* User question bubble */}
              {msg.type === 'question' && (
                <div className="flex justify-end">
                  <div className="bg-green-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-sm text-sm">
                    {msg.content as string}
                  </div>
                </div>
              )}

              {/* Search results (no AI) */}
              {msg.type === 'result' && (() => {
                const result = msg.content as SearchResult
                return (
                  <div>
                    {result.articles.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">
                        No matching articles found. Try rephrasing your question.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400 mb-2">
                          {result.articles.length} article{result.articles.length !== 1 ? 's' : ''} found
                        </p>
                        {result.articles.slice(0, 4).map((art, i) => (
                          <ArticleCard key={art.article} article={art} rank={i} />
                        ))}
                        {/* AI explain is opt-in */}
                        <ExplainPanel question={result.question} />
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Error */}
              {msg.type === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                  {msg.content as string}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              Searching the Constitution…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  search(input)
                }
              }}
              placeholder="Search the Constitution…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex items-center mt-2">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
