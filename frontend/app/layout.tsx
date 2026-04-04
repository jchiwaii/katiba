import type { Metadata } from 'next'
import { Lora, IBM_Plex_Sans } from 'next/font/google'
import './globals.css'

const lora = Lora({
  variable: '--font-lora',
  subsets: ['latin'],
  display: 'swap',
})

const ibm = IBM_Plex_Sans({
  variable: '--font-ibm',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Katiba — Kenya Constitution',
  description: 'Search the Constitution of Kenya. Grounded article citations, no hallucination.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${ibm.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
