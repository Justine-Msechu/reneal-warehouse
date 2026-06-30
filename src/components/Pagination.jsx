export default function Pagination({ page, total, perPage, onChange }) {
  const pages = Math.ceil(total / perPage)
  if (pages <= 1) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  // Show at most 5 page numbers around current page
  const nums = []
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, page + 2)
  for (let i = start; i <= end; i++) nums.push(i)

  const btn = 'px-2.5 py-1 rounded text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed'
  const active = 'bg-blue-700 text-white'
  const inactive = 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-sm text-gray-500">
      <span className="text-xs">{from}–{to} of {total}</span>
      <div className="flex gap-1">
        <button className={`${btn} ${inactive}`} disabled={page === 1} onClick={() => onChange(page - 1)}>
          ← Prev
        </button>
        {start > 1 && <span className="px-1 py-1 text-xs text-gray-400">…</span>}
        {nums.map((n) => (
          <button key={n} className={`${btn} ${n === page ? active : inactive}`} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
        {end < pages && <span className="px-1 py-1 text-xs text-gray-400">…</span>}
        <button className={`${btn} ${inactive}`} disabled={page === pages} onClick={() => onChange(page + 1)}>
          Next →
        </button>
      </div>
    </div>
  )
}
