export type Status = 'Ordered' | 'Ready' | 'Delivered'
export type Method = 'Cash' | 'UPI' | 'Card'
export type PayState = 'Paid' | 'Partial' | 'Unpaid'

export type Customer = { id: string; name: string; village: string; mobile: string }
export type Payment = { id?: string; date: string; amount: number; method: Method; note: string }
export type Order = {
  id: string
  number: string
  customerId: string
  frame: string
  lens: string
  framePrice: number
  lensPrice: number
  extras: number
  power: { od: string[]; os: string[] }
  status: Status
  createdAt: string
  createdTime: string
  note?: string
  deliveredAt?: string
  deliveredTime?: string
  delivery: string
  payments: Payment[]
}
export type Frame = { id: string; name: string }
export type Lens = { id: string; name: string }
export type Settings = { shopName: string; ownerName: string; phone: string; gstin: string; deliveryDays: string; whatsapp: boolean }

export const STATUSES: Status[] = ['Ordered', 'Ready', 'Delivered']
export const METHODS: Method[] = ['Cash', 'UPI', 'Card']

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
export const initials = (name: string) => name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase()
export const formatMobile = (m: string) => { const d = m.replace(/\D/g, '').slice(-10); return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : m }
export const shortDate = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
export const formatTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
export const nowTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000)

export const orderTotal = (o: Order) => o.framePrice + o.lensPrice + o.extras
export const orderPaid = (o: Order) => o.payments.reduce((s, p) => s + p.amount, 0)
export const orderBalance = (o: Order) => Math.max(0, orderTotal(o) - orderPaid(o))
export const payState = (o: Order): PayState => (orderBalance(o) === 0 ? 'Paid' : orderPaid(o) > 0 ? 'Partial' : 'Unpaid')
export const isOverdue = (o: Order, today: string) => o.status !== 'Delivered' && o.delivery < today
export const payClass = (p: PayState) => (p === 'Paid' ? 'status-paid' : p === 'Partial' ? 'status-partial' : 'status-unpaid')

export const deliveredPatch = (status: Status, now: Date) => (status === 'Delivered' ? { status, deliveredAt: iso(now), deliveredTime: nowTime(now) } : { status, deliveredAt: undefined, deliveredTime: undefined })
export const emptyPower = () => ({ od: ['', '', ''], os: ['', '', ''] })

export const seedSettings: Settings = { shopName: 'Chasma Ghar', ownerName: '', phone: '', gstin: '', deliveryDays: '3', whatsapp: true }
