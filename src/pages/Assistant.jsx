import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { askAI } from '../services/api'

export default function Assistant() {
  const { user } = useAuth()
  const canEdit = user?.role === 'admin' || user?.role === 'technician'

  const [messages, setMessages] = useState([]) // { role: 'user' | 'assistant', content }
  const [input, setInput] = useState('')
  const [allowChanges, setAllowChanges] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setError(null)
    setMessages((m) => [...m, { role: 'user', content: question }])
    setLoading(true)

    try {
      const res = await askAI(question, allowChanges)
      if (res.error) {
        setError(res.error)
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: res.answer }])
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
      setAllowChanges(false) // require re-confirming for every change, not just the first
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-170px)]">
      <h1 className="text-xl font-bold text-gray-800 mb-3">AI Assistant</h1>

      <div className="flex-1 overflow-y-auto bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-10">
            Ask about repairs, schools, spare laptops, inventory, or shipments — e.g.
            "How many laptops are in spare storage?" or "Which schools have repairs under way?"
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && <div className="text-sm text-gray-400">Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {canEdit && (
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={allowChanges} onChange={(e) => setAllowChanges(e.target.checked)} />
            Allow this question to make changes (e.g. update repair status, assign technician)
          </label>
        )}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Ask a question about the warehouse..."
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-40 self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
