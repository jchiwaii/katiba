'use client'

import { useState } from 'react'

export interface AnswerData {
  answer: string
  references: string[]
  exact_text: string
  explanation: string
  chunks_used?: { article: number; title: string; text: string }[]
}

function Section({
  title,
  children,
  accent,
}: {
  title: string
  children: React.ReactNode
  accent?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className={`border-l-4 ${accent || 'border-gray-300'} pl-4 py-1`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1 hover:text-gray-700"
      >
        <span>{title}</span>
        <span className="ml-auto text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="text-gray-900 text-base leading-relaxed">{children}</div>}
    </div>
  )
}

export default function AnswerCard({ data }: { data: AnswerData }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
      <Section title="Answer" accent="border-green-500">
        <p>{data.answer}</p>
      </Section>

      {data.references.length > 0 && (
        <Section title="References" accent="border-blue-500">
          <ul className="space-y-1">
            {data.references.map((ref, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-blue-400" />
                <span>{ref}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.exact_text && (
        <Section title="Exact Constitutional Text" accent="border-amber-500">
          <blockquote className="italic text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            &ldquo;{data.exact_text}&rdquo;
          </blockquote>
        </Section>
      )}

      <Section title="Simple Explanation" accent="border-purple-500">
        <p className="text-gray-700">{data.explanation}</p>
      </Section>
    </div>
  )
}
