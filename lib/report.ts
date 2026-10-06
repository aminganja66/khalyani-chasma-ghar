import { addDays, iso } from './data'

export type Period = 'Today' | 'This week' | 'Last week' | 'This month' | 'Last month' | 'This year' | 'Last year' | 'Custom range'
export const PERIODS: Period[] = ['Today', 'This week', 'Last week', 'This month', 'Last month', 'This year', 'Last year', 'Custom range']

export type Range = { from: string; to: string; label: string; buckets: { label: string; from: string; to: string }[] }

const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', o)
const full: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
const p2 = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${p2(m + 1)}-${p2(d)}`
const dayBuckets = (from: string, to: string) => {
  const out: Range['buckets'] = []
  for (let d = new Date(`${from}T00:00:00`); iso(d) <= to; d = addDays(d, 1)) { const k = iso(d); out.push({ label: fmt(k, { weekday: 'short', day: '2-digit' }), from: k, to: k }) }
  return out
}
const monthBuckets = (from: string, to: string) => {
  const out: Range['buckets'] = []
  let y = Number(from.slice(0, 4)); let m = Number(from.slice(5, 7)) - 1
  while (ymd(y, m, 1) <= to) {
    const f = ymd(y, m, 1); const l = ymd(y, m, new Date(y, m + 1, 0).getDate())
    out.push({ label: new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }), from: f < from ? from : f, to: l > to ? to : l })
    if (++m > 11) { m = 0; y++ }
  }
  return out
}
const weekBuckets = (y: number, m: number) => {
  const last = new Date(y, m + 1, 0).getDate()
  return ([[1, 7], [8, 14], [15, 21], [22, last]] as [number, number][]).map(([a, b]) => ({ label: `${a}–${b}`, from: ymd(y, m, a), to: ymd(y, m, b) }))
}
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

export function reportRange(period: Period, now: Date, custom?: { from: string; to: string }): Range {
  const today = iso(now); const y = now.getFullYear(); const m = now.getMonth()
  const span = (from: string, to: string, label: string, buckets: Range['buckets']): Range => ({ from, to, label, buckets })
  switch (period) {
    case 'Today': return span(today, today, fmt(today, full), [])
    case 'This week': case 'Last week': {
      const start = addDays(mondayOf(now), period === 'This week' ? 0 : -7); const from = iso(start); const to = iso(addDays(start, 6))
      return span(from, to, `${fmt(from, { day: '2-digit', month: 'short' })} – ${fmt(to, full)}`, dayBuckets(from, to))
    }
    case 'This month': case 'Last month': {
      const d = new Date(y, period === 'This month' ? m : m - 1, 1)
      return span(ymd(d.getFullYear(), d.getMonth(), 1), ymd(d.getFullYear(), d.getMonth(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()), d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), weekBuckets(d.getFullYear(), d.getMonth()))
    }
    case 'This year': case 'Last year': {
      const yy = period === 'This year' ? y : y - 1
      return span(`${yy}-01-01`, `${yy}-12-31`, String(yy), monthBuckets(`${yy}-01-01`, `${yy}-12-31`))
    }
    default: {
      let from = custom?.from || today; let to = custom?.to || today
      if (from > to) [from, to] = [to, from]
      const days = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1
      return span(from, to, from === to ? fmt(from, full) : `${fmt(from, full)} – ${fmt(to, full)}`, days === 1 ? [] : days <= 31 ? dayBuckets(from, to) : monthBuckets(from, to))
    }
  }
}
export const inRange = (date: string | undefined, r: { from: string; to: string }) => !!date && date >= r.from && date <= r.to

export type ReportPdf = {
  shopName: string
  period: Period
  rangeLabel: string
  summary: [string, string][]
  methods: [string, number][]
  buckets: [string, number][]
  orders: { number: string; date: string; customer: string; status: string; total: number; paid: number; balance: number }[]
}

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN')}`

export async function downloadReport(r: ReportPdf) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const L = 18; const R = 192; let y = 22
  const ensure = (h: number) => { if (y + h > 280) { doc.addPage(); y = 20 } }
  const heading = (t: string) => { ensure(14); y += 10; doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0).text(t, L, y); doc.setDrawColor(220).line(L, y + 2, R, y + 2); y += 4 }

  doc.setFont('helvetica', 'bold').setFontSize(18).text(r.shopName, L, y)
  doc.setFontSize(13).text(`${r.period} report`, R, y, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(100)
  doc.text(`Period: ${r.rangeLabel}`, L, (y += 7))
  doc.text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`, R, y, { align: 'right' })

  heading('Summary')
  doc.setFontSize(10)
  r.summary.forEach(([k, v]) => { ensure(7); y += 7; doc.setTextColor(100).setFont('helvetica', 'normal').text(k, L, y); doc.setTextColor(0).setFont('helvetica', 'bold').text(v, R, y, { align: 'right' }) })

  heading('Collections by method')
  r.methods.forEach(([k, v]) => { ensure(7); y += 7; doc.setTextColor(0).setFont('helvetica', 'normal').text(k, L, y); doc.text(rs(v), R, y, { align: 'right' }) })

  if (r.buckets.length) {
    heading(`Collections over time`)
    r.buckets.forEach(([k, v]) => { ensure(7); y += 7; doc.setTextColor(0).setFont('helvetica', 'normal').text(k, L, y); doc.text(rs(v), R, y, { align: 'right' }) })
  }

  heading(`Orders (${r.orders.length})`)
  if (!r.orders.length) { y += 7; doc.setTextColor(100).setFont('helvetica', 'normal').text('No orders in this period.', L, y) }
  else {
    const cols = { no: L, date: L + 26, cust: L + 46, status: L + 98 }
    const head = () => { y += 7; doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(100); doc.text('Order', cols.no, y); doc.text('Date', cols.date, y); doc.text('Customer', cols.cust, y); doc.text('Status', cols.status, y); doc.text('Total', L + 130, y, { align: 'right' }); doc.text('Paid', L + 152, y, { align: 'right' }); doc.text('Due', R, y, { align: 'right' }) }
    head()
    r.orders.forEach(o => {
      if (y + 7 > 280) { doc.addPage(); y = 20; head() }
      y += 7; doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(0)
      doc.text(o.number, cols.no, y); doc.text(o.date, cols.date, y); doc.text(o.customer.slice(0, 26), cols.cust, y); doc.text(o.status, cols.status, y)
      doc.text(rs(o.total), L + 130, y, { align: 'right' }); doc.text(rs(o.paid), L + 152, y, { align: 'right' }); doc.text(rs(o.balance), R, y, { align: 'right' })
    })
  }
  doc.save(`${r.period.toLowerCase().replaceAll(' ', '-')}-report-${new Date().toISOString().slice(0, 10)}.pdf`)
}
