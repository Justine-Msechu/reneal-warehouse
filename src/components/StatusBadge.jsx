const colors = {
  'Received':    'bg-yellow-100 text-yellow-800',
  'Under Repair': 'bg-orange-100 text-orange-800',
  'Fixed':       'bg-green-100 text-green-800',
  'Returned':    'bg-gray-100 text-gray-700',
}

export default function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  )
}
