import ChatInterface from '@/components/ChatInterface'

export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Katiba</h1>
            <p className="text-xs text-gray-500">Ask the Constitution of Kenya</p>
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </main>
  )
}
