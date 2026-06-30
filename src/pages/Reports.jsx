import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { getRepairs, getSpareLaptops, getInventory, getSchools, getWithdrawals, getDeployments } from '../services/api'

const COLORS = ['#1d4ed8', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d']
const STATUS_COLORS = {
  'Received':     '#d97706',
  'Under Repair': '#2563eb',
  'Fixed':        '#16a34a',
  'Returned':     '#6b7280',
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [section, setSection] = useState('all') // 'all' | 'repairs' | 'warehouse' | 'laptops'

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)
    try {
      const [repairs, laptops, inventory, schools, withdrawals, deployments] = await Promise.all([
        getRepairs(), getSpareLaptops(), getInventory(), getSchools(), getWithdrawals(), getDeployments(),
      ])
      setData({
        repairs:     repairs.repairs     || [],
        laptops:     laptops.laptops     || [],
        inventory:   inventory.items     || [],
        schools:     schools.schools     || [],
        withdrawals: withdrawals.withdrawals || [],
        deployments: deployments.deployments || [],
      })
    } catch {
      setError('Could not load report data.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="text-center py-16 text-gray-500">Loading report...</div>
  if (error)   return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>

  const { repairs, laptops, inventory, schools, withdrawals, deployments } = data

  // ── Repair stats ──
  const repairByStatus = Object.entries(
    repairs.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {})
  ).map(([name, value]) => ({ name, value }))

  const repairByYear = Object.entries(
    repairs.reduce((acc, r) => {
      const y = r.dateReceived?.slice(0, 4) || 'Unknown'
      acc[y] = (acc[y] || 0) + 1; return acc
    }, {})
  ).map(([year, count]) => ({ year, count })).sort((a, b) => a.year.localeCompare(b.year))

  const repairBySchool = Object.entries(
    repairs.reduce((acc, r) => { acc[r.schoolName] = (acc[r.schoolName] || 0) + 1; return acc }, {})
  ).map(([school, count]) => ({ school: school.replace(' Secondary', '').replace(' SS', ''), count }))
    .sort((a, b) => b.count - a.count).slice(0, 10)

  const repairByTech = Object.entries(
    repairs.filter((r) => r.technician).reduce((acc, r) => {
      acc[r.technician] = (acc[r.technician] || 0) + 1; return acc
    }, {})
  ).map(([tech, count]) => ({ tech, count })).sort((a, b) => b.count - a.count)

  // ── Warehouse stats ──
  const lowStock = inventory.filter((i) => Number(i.quantity) > 0 && Number(i.quantity) <= 5)
  const outOfStock = inventory.filter((i) => Number(i.quantity) === 0)
  const stockByBox = Object.entries(
    inventory.reduce((acc, i) => { acc[i.boxName] = (acc[i.boxName] || 0) + 1; return acc }, {})
  ).map(([box, count]) => ({ box: box.replace('BOX ', ''), count })).sort((a, b) => b.count - a.count)

  // ── Laptop stats ──
  const isInWarehouse = (l) => !l.location || l.location.toLowerCase().includes('spare') ||
    l.location.toLowerCase().includes('warehouse') || l.location.toLowerCase().includes('box')
  const laptopStatus = [
    { name: 'In Warehouse', value: laptops.filter(isInWarehouse).length },
    { name: 'Deployed', value: laptops.filter((l) => !isInWarehouse(l)).length },
  ]

  const laptopByModel = Object.entries(
    laptops.reduce((acc, l) => { acc[l.model] = (acc[l.model] || 0) + 1; return acc }, {})
  ).map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count).slice(0, 8)

  // ── KPIs ──
  const kpis = [
    { label: 'Total Repairs', value: repairs.length, sub: `${repairs.filter(r => r.status === 'Under Repair').length} in progress`, color: 'blue' },
    { label: 'Active Schools', value: schools.filter(s => s.status === 'Active').length, sub: `${schools.filter(s => s.status === 'Deactivated').length} deactivated`, color: 'green' },
    { label: 'Spare Laptops', value: laptops.length, sub: `${laptopStatus[1].value} deployed`, color: 'purple' },
    { label: 'Warehouse Items', value: inventory.length, sub: `${lowStock.length + outOfStock.length} need attention`, color: 'amber' },
    { label: 'Withdrawals', value: withdrawals.length, sub: 'total logged', color: 'cyan' },
    { label: 'Deployments', value: deployments.length, sub: 'laptop movements', color: 'indigo' },
  ]

  const kpiColors = { blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50',
    purple: 'border-purple-200 bg-purple-50', amber: 'border-amber-200 bg-amber-50',
    cyan: 'border-cyan-200 bg-cyan-50', indigo: 'border-indigo-200 bg-indigo-50' }
  const kpiText = { blue: 'text-blue-700', green: 'text-green-700', purple: 'text-purple-700',
    amber: 'text-amber-700', cyan: 'text-cyan-700', indigo: 'text-indigo-700' }

  const sections = [
    { key: 'all',      label: 'All' },
    { key: 'repairs',  label: 'Repairs' },
    { key: 'warehouse',label: 'Warehouse' },
    { key: 'laptops',  label: 'Spare Laptops' },
  ]

  const show = (key) => section === 'all' || section === key

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h1 className="text-xl font-bold text-gray-800">Reports</h1>
        <div className="flex gap-2">
          <div className="flex gap-1">
            {sections.map((s) => (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  section === s.key ? 'bg-blue-700 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-400'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => window.print()}
            className="px-3 py-1.5 rounded text-xs font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 print:hidden">
            🖨 Print
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-lg border p-3 ${kpiColors[k.color]}`}>
            <div className={`text-2xl font-bold ${kpiText[k.color]}`}>{k.value}</div>
            <div className="text-xs font-medium text-gray-700 mt-0.5">{k.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── REPAIRS SECTION ── */}
      {show('repairs') && (
        <Section title="Repairs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Status donut */}
            <Card title="Repair Status Breakdown">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={repairByStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}>
                    {repairByStatus.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {repairByStatus.map((s) => (
                  <div key={s.name} className="flex items-center gap-1 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLORS[s.name] || '#9ca3af' }} />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </Card>

            {/* Repairs by year */}
            <Card title="Repairs by Year">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={repairByYear} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Repairs" fill="#1d4ed8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Repairs by school */}
            <Card title="Top Schools by Repairs" className="md:col-span-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={repairBySchool} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="school" type="category" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" name="Repairs" fill="#7c3aed" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* By technician */}
            {repairByTech.length > 0 && (
              <Card title="Repairs by Technician" className="md:col-span-2">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={repairByTech} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="tech" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Repairs" fill="#0891b2" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}
          </div>
        </Section>
      )}

      {/* ── WAREHOUSE SECTION ── */}
      {show('warehouse') && (
        <Section title="Warehouse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Items per box */}
            <Card title="Items per Box">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stockByBox} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="box" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Item types" fill="#d97706" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Low / out of stock */}
            <Card title="Stock Alerts">
              {outOfStock.length === 0 && lowStock.length === 0 ? (
                <div className="text-center py-8 text-green-600 text-sm">✓ All items in stock</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {outOfStock.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center px-3 py-2 bg-red-50 border border-red-200 rounded text-sm">
                      <span className="font-medium text-red-700 truncate">{i.boxName} — {i.item}</span>
                      <span className="text-red-600 font-bold ml-2 shrink-0">OUT</span>
                    </div>
                  ))}
                  {lowStock.map((i, idx) => (
                    <div key={idx} className="flex justify-between items-center px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm">
                      <span className="text-amber-700 truncate">{i.boxName} — {i.item}</span>
                      <span className="text-amber-600 font-bold ml-2 shrink-0">{i.quantity} left</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Recent withdrawals */}
            {withdrawals.length > 0 && (
              <Card title="Recent Withdrawals" className="md:col-span-2">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Date', 'Item', 'Qty', 'Taken By', 'Destination'].map((h) => (
                          <th key={h} className="pb-2 text-left text-gray-500 font-medium pr-4 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {withdrawals.slice(0, 8).map((w, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-4 text-gray-400 whitespace-nowrap">{w.date}</td>
                          <td className="py-1.5 pr-4">{w.item}</td>
                          <td className="py-1.5 pr-4 font-semibold text-amber-700">-{w.quantityTaken}</td>
                          <td className="py-1.5 pr-4">{w.takenBy}</td>
                          <td className="py-1.5 text-gray-500">{w.destination || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </Section>
      )}

      {/* ── SPARE LAPTOPS SECTION ── */}
      {show('laptops') && (
        <Section title="Spare Laptops">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* In warehouse vs deployed */}
            <Card title="Laptop Status">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={laptopStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                    dataKey="value" nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    <Cell fill="#16a34a" />
                    <Cell fill="#1d4ed8" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {laptopStatus.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: i === 0 ? '#16a34a' : '#1d4ed8' }} />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </Card>

            {/* By model */}
            <Card title="Laptops by Model">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={laptopByModel} layout="vertical" margin={{ top: 5, right: 20, left: 50, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="model" type="category" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" name="Count" fill="#7c3aed" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Recent deployments */}
            {deployments.length > 0 && (
              <Card title="Recent Deployments" className="md:col-span-2">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Date', 'Laptop ID', 'Action', 'School', 'Handled By'].map((h) => (
                          <th key={h} className="pb-2 text-left text-gray-500 font-medium pr-4 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {deployments.slice(0, 8).map((d, i) => (
                        <tr key={i}>
                          <td className="py-1.5 pr-4 text-gray-400 whitespace-nowrap">{d.date}</td>
                          <td className="py-1.5 pr-4 font-mono text-blue-700 font-semibold">{d.idNumber}</td>
                          <td className="py-1.5 pr-4">
                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                              d.action === 'Returned' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>{d.action}</span>
                          </td>
                          <td className="py-1.5 pr-4">{d.school || '—'}</td>
                          <td className="py-1.5">{d.takenBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </Section>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body { font-size: 12px; }
          .print\\:hidden { display: none !important; }
          nav, footer, header { display: none !important; }
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-700 mb-4 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </div>
  )
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
      {children}
    </div>
  )
}
