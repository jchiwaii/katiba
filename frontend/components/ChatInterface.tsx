'use client'

import { useState, useRef, useEffect } from 'react'
import AnswerCard, { AnswerData } from './AnswerCard'

interface Message {
  id: string
  type: 'question' | 'answer' | 'error'
  content: string | AnswerData
}

const EXAMPLE_QUESTIONS = [
  'Do I have the right to protest in Kenya?',
  'Can the president fire a governor?',
  'What are my rights if I am arrested?',
  'How is the President elected?',
  'What is the Bill of Rights?',
]

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [eli5, setEli5] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function ask(question: string) {
    if (!question.trim() || loading) return

    const questionMsg: Message = {
      id: Date.now().toString(),
      type: 'question',
      content: question,
    }
    setMessages((prev) => [...prev, questionMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, eli5 }),
      })

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`)
      }

      const data: AnswerData = await res.json()
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), type: 'answer', content: data },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'error',
          content: 'Something went wrong. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto">
            <p className="text-center text-gray-500 mb-6 text-sm">
              Ask any question about the Constitution of Kenya
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="text-left text-sm bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-green-400 hover:bg-green-50 transition-colors text-gray-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id}>
              {msg.type === 'question' && (
                <div className="flex justify-end">
                  <div className="bg-green-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-sm text-sm">
                    {msg.content as string}
                  </div>
                </div>
              )}
              {msg.type === 'answer' && (
                <AnswerCard data={msg.content as AnswerData} />
              )}
              {msg.type === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                  {msg.content as string}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-gray-400 text-sm">
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
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    ask(input)
                  }
                }}
                placeholder="Ask about the Constitution…"
                rows={1}
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl px-5 py-3 text-sm font-medium transition-colors"
            >
              Ask
            </button>
          </form>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setEli5(!eli5)}
              className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                eli5
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span>{eli5 ? '✓' : '○'}</span>
              Explain Simply (ELI12)
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
              >
                Clear chat
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
