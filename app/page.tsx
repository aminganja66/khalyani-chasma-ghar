'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { ChevronRight, CirclePlus, ClipboardList, Clock3, CreditCard, FileText, IndianRupee, LayoutDashboard, MoreHorizontal, PackageCheck, ReceiptIndianRupee, Search, Settings as SettingsIcon, ShoppingBag, Smartphone, Users, WalletCards, X, Check, MessageCircle, Printer, Pencil, Trash2, LogOut, Plus } from 'lucide-react'
import {
  METHODS, STATUSES, addDays, daysBetween, deliveredPatch, emptyPower, formatMobile, formatTime, nowTime, initials, iso, isOverdue, money, orderBalance, orderPaid, orderTotal, payClass, payState, seedSettings, shortDate,
  type Customer, type Frame, type Lens, type Method, type Order, type Settings, type Status,
} from '@/lib/data'
import { downloadInvoice } from '@/lib/invoice'
import * as db from '@/lib/db'
import { PERIODS, downloadReport, inRange, reportRange, type Period } from '@/lib/report'

type Modal = 'more' | 'confirm' | 'order' | 'customer' | 'customerDetail' | 'orderDetail' | 'settings' | 'catalogItem' | null
type OrderForm = {
  mobile: string; name: string; village: string; delivery: string
  od: string[]; os: string[]
  frameId: string; lensId: string; framePrice: string; lensPrice: string; extras: string
  note: string
  mode: 'Full payment' | 'Part payment' | 'Pay at delivery'; advance: string; method: Method
}

const nav = [{ label: 'Home', icon: LayoutDashboard }, { label: 'Orders', icon: ReceiptIndianRupee }, { label: 'Customers', icon: Users }, { label: 'Frames & lenses', icon: ShoppingBag }, { label: 'Reports', icon: WalletCards }]
const digits = (s: string) => s.replace(/\D/g, '')
const num = (s: string) => Number(digits(s) || 0)
const last10 = (s: string) => digits(s).slice(-10)

export default function Page() {
  const [now] = useState(() => new Date())
  const today = iso(now)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [frames, setFrames] = useState<Frame[]>([])
  const [lenses, setLenses] = useState<Lens[]>([])
  const [settings, setSettings] = useState<Settings>(seedSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [activeNav, setActiveNav] = useState('Home')
  const [modal, setModal] = useState<Modal>(null)
  const [toast, setToast] = useState('')
  const [editingCustomerId, setEditingCustomerId] = useState('')
  const [pendingDelete, setPendingDelete] = useState<{ kind: 'order' | 'customer' | 'frame' | 'lens'; id: string } | null>(null)
  const [editingNo, setEditingNo] = useState('')
  const [period, setPeriod] = useState<Period>('This month')
  const [custom, setCustom] = useState({ from: iso(addDays(now, -29)), to: iso(now) })
  const [deliveryFilter, setDeliveryFilter] = useState('')
  const [suggest, setSuggest] = useState<'' | 'mobile' | 'name'>('')
  const [mobileStatus, setMobileStatus] = useState<Status>('Ordered')
  const [dragNo, setDragNo] = useState('')
  const [dragOver, setDragOver] = useState<Status | ''>('')
  const [catalogTab, setCatalogTab] = useState<'Frames' | 'Lenses'>('Frames')
  const [selectedOrderNo, setSelectedOrderNo] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [draft, setDraft] = useState<OrderForm | null>(null)
  const [form, setForm] = useState<OrderForm | null>(null)
  const [customerForm, setCustomerForm] = useState({ name: '', mobile: '', village: '' })
  const [pay, setPay] = useState<{ amount: string; method: Method }>({ amount: '', method: 'UPI' })
  const [catalogEdit, setCatalogEdit] = useState({ type: 'Frame' as 'Frame' | 'Lens', id: '', name: '' })
  const [settingsDraft, setSettingsDraft] = useState<Settings>(seedSettings)

  useEffect(() => {
    db.loadAll().then(d => {
      setCustomers(d.customers); setOrders(d.orders); setFrames(d.frames); setLenses(d.lenses)
      if (d.settings) { setSettings(d.settings); setSettingsDraft(d.settings) }
    }).catch(e => notify(e instanceof Error ? e.message : 'Could not load your data')).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const run = async (fn: () => Promise<void>) => {
    if (saving) return
    setSaving(true)
    try { await fn() } catch (e) { notify(e instanceof Error ? e.message : 'Something went wrong') } finally { setSaving(false) }
  }
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500) }
  const customerOf = (id: string) => customers.find(c => c.id === id)
  const nameOf = (o: Order) => customerOf(o.customerId)?.name ?? 'Unknown'
  const villageOf = (o: Order) => customerOf(o.customerId)?.village ?? ''
  const dayLabel = (d: string) => (d === today ? 'Today' : d === iso(addDays(now, -1)) ? 'Yesterday' : shortDate(d))
  const customerBalance = (id: string) => orders.filter(o => o.customerId === id).reduce((s, o) => s + orderBalance(o), 0)
  const customerLast = (id: string) => orders.filter(o => o.customerId === id).map(o => o.createdAt).sort().at(-1)

  const sortedOrders = useMemo(() => [...orders].sort((a, b) => b.number.localeCompare(a.number)), [orders])
  const selectedOrder = orders.find(o => o.number === selectedOrderNo)
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)

  const results = useMemo(() => {
    const q = query.toLowerCase().replaceAll(' ', '')
    if (!q) return { customers: [] as Customer[], orders: [] as Order[] }
    const norm = (t: string) => t.toLowerCase().replaceAll(' ', '')
    return {
      customers: customers.filter(c => norm(`${c.name}${c.village}${c.mobile}`).includes(q)),
      orders: sortedOrders.filter(o => norm(`${o.number}${o.note ?? ''}${o.frame}${o.lens}`).includes(q)),
    }
  }, [query, customers, sortedOrders])
  const suggestions = !form || editingNo || !suggest ? [] : customers.filter(c =>
    suggest === 'mobile' ? digits(form.mobile).length >= 2 && c.mobile.includes(digits(form.mobile)) : form.name.trim().length >= 1 && c.name.toLowerCase().includes(form.name.trim().toLowerCase())
  ).filter(c => !(c.mobile === last10(form.mobile) && c.name === form.name)).slice(0, 5)
  const pickCustomer = (c: Customer) => { patchForm({ mobile: c.mobile, name: c.name, village: c.village }); setSuggest('') }
  const suggestList = (field: 'mobile' | 'name') => suggest === field && suggestions.length > 0 && <div className="suggest-list" role="listbox">{suggestions.map(c => <button type="button" role="option" key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => pickCustomer(c)}><span className="result-avatar">{initials(c.name)}</span><span className="result-copy"><strong>{c.name}</strong><small>{c.village} · {formatMobile(c.mobile)}</small></span>{customerBalance(c.id) > 0 && <em className="status-unpaid">{money(customerBalance(c.id))} due</em>}</button>)}</div>
  const noResults = !results.customers.length && !results.orders.length

  const visibleOrders = deliveryFilter ? sortedOrders.filter(o => o.delivery === deliveryFilter) : sortedOrders

  // ---- dashboard numbers, all derived from state
  const allPayments = orders.flatMap(o => o.payments)
  const collectedOn = (d: string) => allPayments.filter(p => p.date === d)
  const sumBy = (list: typeof allPayments, m?: Method) => list.filter(p => !m || p.method === m).reduce((s, p) => s + p.amount, 0)
  const todayPays = collectedOn(today)
  const todayTotal = sumBy(todayPays)
  const yesterday = iso(addDays(now, -1))
  const yesterdayTotal = sumBy(collectedOn(yesterday))
  const todaysOrders = orders.filter(o => o.createdAt === today)
  const yesterdaysOrderCount = orders.filter(o => o.createdAt === yesterday).length
  const dueToday = orders.filter(o => o.delivery === today && o.status !== 'Delivered')
  const readyCount = orders.filter(o => o.status === 'Ready').length
  const overdueCount = orders.filter(o => isOverdue(o, today)).length
  const openCount = orders.filter(o => o.status !== 'Delivered').length
  const pending = orders.filter(o => orderBalance(o) > 0)
  const pendingTotal = pending.reduce((s, o) => s + orderBalance(o), 0)
  const pendingCustomers = new Set(pending.map(o => o.customerId)).size
  const oldestPending = pending.length ? Math.max(...pending.map(o => daysBetween(o.createdAt, today))) : 0
  const range = reportRange(period, now, custom)
  const rangePays = allPayments.filter(p => inRange(p.date, range))
  const monthOrders = orders.filter(o => inRange(o.createdAt, range))
  const deliveredInRange = orders.filter(o => inRange(o.deliveredAt, range)).length
  const rangeBalance = monthOrders.reduce((s, o) => s + orderBalance(o), 0)
  const rangeBuckets = range.buckets.map(b => [b.label, sumBy(rangePays.filter(p => p.date >= b.from && p.date <= b.to))] as [string, number])
  const bucketMax = Math.max(1, ...rangeBuckets.map(b => b[1]))
  const topOf = (keys: string[]) => {
    const counts = new Map<string, number>()
    keys.forEach(k => counts.set(k, (counts.get(k) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  }
  const bestLens = topOf(monthOrders.map(o => o.lens))
  const bestFrame = topOf(monthOrders.map(o => o.frame))
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ---- order form
  const freshForm = (prefill?: Partial<OrderForm>): OrderForm => {
    const f = frames[0]; const l = lenses[0]
    return {
      mobile: '', name: '', village: '', delivery: iso(addDays(now, num(settings.deliveryDays) || 3)),
      ...emptyPower(), frameId: f?.id ?? '', lensId: l?.id ?? '', framePrice: '', lensPrice: '', extras: '0', note: '',
      mode: 'Part payment', advance: '', method: 'UPI', ...prefill,
    }
  }
  const openNewOrder = (prefill?: Partial<OrderForm>) => { setEditingNo(''); setForm(prefill ? freshForm(prefill) : draft ?? freshForm()); setModal('order') }
  const openEditOrder = (o: Order) => {
    const c = customerOf(o.customerId)
    setEditingNo(o.number)
    setForm(freshForm({
      mobile: c?.mobile ?? '', name: c?.name ?? '', village: c?.village ?? '', delivery: o.delivery, od: [...o.power.od], os: [...o.power.os],
      frameId: frames.find(f => f.name === o.frame)?.id ?? frames[0]?.id ?? '', lensId: lenses.find(l => l.name === o.lens)?.id ?? lenses[0]?.id ?? '',
      framePrice: String(o.framePrice), lensPrice: String(o.lensPrice), extras: String(o.extras), note: o.note ?? '',
    }))
    setModal('order')
  }
  const deleteOrder = (o: Order) => run(async () => {
    await db.softDeleteOrder(o.id)
    setOrders(os => os.filter(x => x.id !== o.id)); setModal(null); notify(`Order ${o.number} deleted`)
  })
  const patchForm = (patch: Partial<OrderForm>) => setForm(f => (f ? { ...f, ...patch } : f))
  const setMobile = (value: string) => {
    const existing = customers.find(c => last10(c.mobile) === last10(value) && digits(value).length >= 10)
    patchForm(existing ? { mobile: value, name: existing.name, village: existing.village } : { mobile: value })
  }
  const formTotal = form ? num(form.framePrice) + num(form.lensPrice) + num(form.extras) : 0
  const formPaidNow = !form ? 0 : form.mode === 'Full payment' ? formTotal : form.mode === 'Part payment' ? Math.min(num(form.advance), formTotal) : 0

  const useLastPower = () => {
    if (!form) return
    const c = customers.find(x => last10(x.mobile) === last10(form.mobile))
    const last = c && sortedOrders.find(o => o.customerId === c.id)
    if (!last) return notify('No earlier prescription for this customer')
    patchForm({ od: [...last.power.od], os: [...last.power.os] }); notify('Latest prescription reused')
  }

  const saveOrder = () => run(async () => {
    if (!form) return
    if (digits(form.mobile).length < 10) return notify('Enter a 10-digit mobile number')
    if (!form.name.trim()) return notify('Enter the customer name')
    const frame = frames.find(f => f.id === form.frameId); const lens = lenses.find(l => l.id === form.lensId)
    if (!frame || !lens) return notify('Choose a frame and lens')
    const fields = {
      frame: frame.name, lens: lens.name, framePrice: num(form.framePrice), lensPrice: num(form.lensPrice), extras: num(form.extras),
      note: form.note.trim() || undefined, power: { od: form.od, os: form.os }, delivery: form.delivery,
    }
    const editing = orders.find(o => o.number === editingNo)
    if (editing) {
      const customer = customerOf(editing.customerId)
      await db.updateOrder(editing.id, fields)
      if (customer) await db.updateCustomer(customer.id, { name: form.name.trim(), village: form.village.trim(), mobile: customer.mobile })
      setOrders(os => os.map(o => (o.id === editing.id ? { ...o, ...fields } : o)))
      setCustomers(cs => cs.map(c => (c.id === editing.customerId ? { ...c, name: form.name.trim(), village: form.village.trim() } : c)))
      setEditingNo(''); setModal(null); notify(`Order ${editing.number} updated`); return
    }
    let customer = customers.find(c => last10(c.mobile) === last10(form.mobile))
    if (!customer) {
      customer = await db.createCustomer({ name: form.name.trim(), mobile: last10(form.mobile), village: form.village.trim() })
      setCustomers(cs => [...cs, customer!])
    }
    const order = await db.createOrder({
      ...fields, customerId: customer.id,
      payment: formPaidNow > 0 ? { amount: formPaidNow, method: form.method, note: form.mode === 'Full payment' ? 'Full payment' : 'Advance' } : undefined,
    })
    setOrders(os => [...os, order])
    setDraft(null); setModal(null); notify(`Order ${order.number} saved · Print slip ready`)
  })

  // ---- customers
  const saveCustomer = () => run(async () => {
    if (digits(customerForm.mobile).length < 10) return notify('Enter a 10-digit mobile number')
    if (!customerForm.name.trim()) return notify('Enter the customer name')
    const mobile = last10(customerForm.mobile)
    const fields = { name: customerForm.name.trim(), mobile, village: customerForm.village.trim() }
    if (editingCustomerId) {
      const clash = customers.find(c => c.mobile === mobile && c.id !== editingCustomerId)
      if (clash) return notify(`${clash.name} already uses this mobile number`)
      await db.updateCustomer(editingCustomerId, fields)
      setCustomers(cs => cs.map(c => (c.id === editingCustomerId ? { ...c, ...fields } : c)))
      setEditingCustomerId(''); setModal(null); return notify('Customer updated')
    }
    const existing = customers.find(c => c.mobile === mobile)
    if (existing) { notify(`${existing.name} already exists`); return openNewOrder({ mobile, name: existing.name, village: existing.village }) }
    const created = await db.createCustomer(fields)
    setCustomers(cs => [...cs, created])
    openNewOrder({ mobile, name: fields.name, village: fields.village }); notify('Customer added')
  })
  const openCustomer = (c: Customer) => { setSelectedCustomerId(c.id); setQuery(''); setModal('customerDetail') }
  const openEditCustomer = (c: Customer) => { setEditingCustomerId(c.id); setCustomerForm({ name: c.name, mobile: c.mobile, village: c.village }); setModal('customer') }
  const deleteCustomer = (c: Customer) => run(async () => {
    await db.softDeleteCustomer(c.id)
    setOrders(os => os.filter(o => o.customerId !== c.id)); setCustomers(cs => cs.filter(x => x.id !== c.id)); setModal(null); notify(`${c.name} deleted`)
  })
  const askDelete = (kind: 'order' | 'customer' | 'frame' | 'lens', id: string) => { setPendingDelete({ kind, id }); setModal('confirm') }
  const openAddCustomer = () => { setEditingCustomerId(''); setCustomerForm({ name: /\d/.test(query) ? '' : query, mobile: /\d/.test(query) ? query : '', village: '' }); setQuery(''); setModal('customer') }

  // ---- orders
  const openOrder = (o: Order) => { setSelectedOrderNo(o.number); setPay({ amount: String(orderBalance(o) || ''), method: 'UPI' }); setModal('orderDetail') }
  const setStatus = (o: Order, status: Status) => run(async () => {
    if (o.status === status) return
    await db.setOrderStatus(o.id, status)
    setOrders(os => os.map(x => (x.id === o.id ? { ...x, ...deliveredPatch(status, new Date()) } : x)))
    notify(status === 'Delivered' && orderBalance(o) > 0 ? `${o.number} delivered · ${money(orderBalance(o))} still due` : `${o.number} → ${status}`)
  })
  const dropOn = (status: Status) => { const o = orders.find(x => x.number === dragNo); setDragNo(''); setDragOver(''); if (o) setStatus(o, status) }
  const collect = (o: Order) => run(async () => {
    const amount = Math.min(num(pay.amount), orderBalance(o))
    if (amount <= 0) return
    const payment = await db.addPayment(o.id, { amount, method: pay.method, note: 'Payment' })
    setOrders(os => os.map(x => (x.id === o.id ? { ...x, payments: [...x.payments, payment] } : x)))
    const left = orderBalance(o) - amount
    setPay(p => ({ ...p, amount: String(left || '') }))
    notify(left === 0 ? `${money(amount)} collected · order fully paid` : `${money(amount)} collected · ${money(left)} left`)
  })

  // ---- catalog
  const openCatalogItem = (type: 'Frame' | 'Lens', item?: Frame | Lens) => { setCatalogEdit({ type, id: item?.id ?? '', name: item?.name ?? '' }); setModal('catalogItem') }
  const saveCatalogItem = () => run(async () => {
    const name = catalogEdit.name.trim(); const isFrame = catalogEdit.type === 'Frame'; const list = isFrame ? frames : lenses
    if (!name) return notify(`Enter the ${catalogEdit.type.toLowerCase()} name`)
    if (list.some(x => x.id !== catalogEdit.id && x.name.toLowerCase() === name.toLowerCase())) return notify(`${name} already exists`)
    const table = isFrame ? 'frames' : 'lenses'
    const set = isFrame ? setFrames : setLenses
    if (catalogEdit.id) { await db.renameCatalogItem(table, catalogEdit.id, name); set(xs => xs.map(x => (x.id === catalogEdit.id ? { ...x, name } : x))) }
    else { const item = await db.createCatalogItem(table, name); set(xs => [...xs, item]) }
    setModal(null); notify(`${catalogEdit.type} ${catalogEdit.id ? 'updated' : 'added'}`)
  })
  const deleteCatalogItem = (kind: 'frame' | 'lens', id: string) => run(async () => {
    await db.softDeleteCatalogItem(kind === 'frame' ? 'frames' : 'lenses', id)
    if (kind === 'frame') setFrames(fs => fs.filter(f => f.id !== id)); else setLenses(ls => ls.filter(l => l.id !== id))
    setModal(null); notify(`${kind === 'frame' ? 'Frame' : 'Lens'} deleted`)
  })

  const exportReport = () => downloadReport({
    shopName: settings.shopName, period, rangeLabel: range.label,
    summary: [['Sales collected', money(sumBy(rangePays)).replace('₹', 'Rs. ')], ['Orders created', String(monthOrders.length)], ['Orders delivered', String(deliveredInRange)], ['Amount due (this period\'s orders)', money(rangeBalance).replace('₹', 'Rs. ')], ['Best seller', bestLens ? `${bestLens[0]} (${bestLens[1]})` : '-'], ['Top frame', bestFrame ? `${bestFrame[0]} (${bestFrame[1]})` : '-']],
    methods: METHODS.map(m => [m, sumBy(rangePays, m)] as [string, number]), buckets: rangeBuckets,
    orders: [...monthOrders].sort((a, b) => a.number.localeCompare(b.number)).map(o => ({ number: o.number, date: shortDate(o.createdAt), customer: nameOf(o), status: o.status, total: orderTotal(o), paid: orderPaid(o), balance: orderBalance(o) })),
  }).then(() => notify(`${period} report downloaded`)).catch(() => notify('Could not create report'))

  const logout = async () => { try { await db.signOut() } finally { window.location.assign('/login') } }

  const orderLine = (o: Order) => `${o.frame} · ${o.lens}`
  const payLabel = (o: Order) => `${payState(o)}${orderBalance(o) ? ` · ${money(orderBalance(o))}` : ''}`
  const initialsOf = (c: Customer) => initials(c.name)

  if (loading) return <main className="login-shell"><p className="login-sub">Loading your shop…</p></main>

  return <main className="app-shell">
    <aside className="sidebar">
      <BrandLogo size="md" />
      <div className="shop-status"><span className="status-dot" /> Open today <span className="status-time">9:30 AM – 8:30 PM</span></div>
      <nav className="side-nav" aria-label="Main navigation">{nav.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)}><Icon /> <span>{label}</span>{label === 'Orders' && <b>{openCount}</b>}</button>)}</nav>
      <div className="sidebar-bottom">
        <button className="nav-item" onClick={() => { setSettingsDraft(settings); setModal('settings') }}><SettingsIcon /> <span>Settings</span></button>
        <button className="nav-item" onClick={logout}><LogOut /> <span>Log out</span></button>
        <div className="staff-card"><div className="avatar">{initials(settings.ownerName) || 'OW'}</div><div><strong>{settings.ownerName || 'Owner'}</strong><small>{settings.shopName}</small></div></div>
      </div>
    </aside>

    <section className="content-area">
      <header className="topbar">
        <div className="search-wrap"><Search />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search customers, mobile, order number or note..." aria-label="Search customers, mobile, order number or note" />
          {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X /></button>}
          {query && <div className="search-results">{noResults ? <div className="no-result"><p>No match for <strong>“{query}”</strong></p><Button onClick={openAddCustomer}><CirclePlus data-icon="inline-start" /> Add customer</Button></div> : <>
            {results.customers.length > 0 && <p className="search-group">Customers</p>}
            {results.customers.map(r => {
            const bal = customerBalance(r.id)
            return <button className="search-result" key={r.id} onClick={() => openCustomer(r)}><div className="result-avatar">{initialsOf(r)}</div><div className="result-copy"><strong>{r.name}</strong><span>{r.village} · {formatMobile(r.mobile)}{customerLast(r.id) ? ` · Last visit ${shortDate(customerLast(r.id)!)}` : ''}</span></div><span className={bal ? 'result-balance' : 'result-paid'}>{bal ? `${money(bal)} due` : 'Paid'}</span></button>
          })}
            {results.orders.length > 0 && <p className="search-group">Orders</p>}
            {results.orders.map(o => {
              const q = query.toLowerCase().replaceAll(' ', ''); const noteHit = !!o.note && o.note.toLowerCase().replaceAll(' ', '').includes(q) && !o.number.toLowerCase().includes(q)
              return <button className="search-result" key={o.number} onClick={() => { setQuery(''); openOrder(o) }}><div className="result-avatar">{initials(nameOf(o))}</div><div className="result-copy"><strong>{o.number} · {nameOf(o)}</strong><span>{noteHit ? `Note: ${o.note}` : `${o.frame} · ${o.lens}`}</span></div><span className="status-pill">{o.status}</span></button>
            })}
          </>}</div>}
        </div>
        <Button className="new-order-top" onClick={() => openNewOrder()}><CirclePlus data-icon="inline-start" /> New order</Button>
      </header>

      <div className="page-content">
        <div className="welcome-row"><div>
          <p className="eyebrow" suppressHydrationWarning>{now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
          <h1 suppressHydrationWarning>{activeNav === 'Home' ? `${greeting}${settings.ownerName ? `, ${settings.ownerName.split(' ')[0]}` : ''}` : activeNav}</h1>
          <p className="subline">{activeNav === 'Home' ? "Here's how the shop is doing today." : 'Keep every customer, order, and payment moving.'}</p>
        </div></div>

        {activeNav !== 'Home' && <section className="workspace-panel panel">
          <div className="workspace-toolbar"><div><p className="eyebrow">{settings.shopName}</p><h2>{activeNav === 'Orders' ? 'Orders board' : activeNav === 'Customers' ? 'Customer book' : activeNav === 'Frames & lenses' ? 'Frames & lenses' : 'Shop reports'}</h2></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>{activeNav === 'Orders' && <div className="order-filter"><label>Expected delivery<input type="date" value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)} /></label>
              {deliveryFilter && <><button className="text-link" onClick={() => setDeliveryFilter('')}>Clear</button><span>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'} due {new Date(`${deliveryFilter}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></>}</div>}{activeNav === 'Reports' && <Button variant="outline" onClick={exportReport}><FileText data-icon="inline-start" /> Download PDF</Button>}{activeNav === 'Customers' && <Button variant="outline" onClick={openAddCustomer}><Users data-icon="inline-start" /> Add customer</Button>}</div></div>

          {activeNav === 'Orders' && <>
            <div className="status-tabs" role="tablist">{STATUSES.map(st => <button key={st} role="tab" aria-selected={mobileStatus === st} className={mobileStatus === st ? 'selected' : ''} onClick={() => setMobileStatus(st)}>{st}<b>{visibleOrders.filter(o => o.status === st).length}</b></button>)}</div>
            <div className="board-grid">{STATUSES.map(status => <div className={`board-column ${dragOver === status ? 'drop-target' : ''} ${mobileStatus === status ? 'mobile-active' : ''}`} key={status} onDragOver={e => { if (dragNo) { e.preventDefault(); setDragOver(status) } }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver('') }} onDrop={e => { e.preventDefault(); dropOn(status) }}>
              <div className="board-heading"><strong>{status}</strong><span>{visibleOrders.filter(o => o.status === status).length}</span></div>
              {visibleOrders.filter(o => o.status === status).map(o => <div role="button" tabIndex={0} draggable className={`board-card ${isOverdue(o, today) ? 'overdue-card' : ''} ${dragNo === o.number ? 'dragging' : ''}`} key={o.number} onClick={() => openOrder(o)} onKeyDown={e => { if (e.key === 'Enter') openOrder(o) }} onDragStart={e => { setDragNo(o.number); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', o.number) }} onDragEnd={() => { setDragNo(''); setDragOver('') }}><span className="card-actions"><button aria-label={`Edit ${o.number}`} onClick={e => { e.stopPropagation(); openEditOrder(o) }}><Pencil /></button><button aria-label={`Delete ${o.number}`} className="danger" onClick={e => { e.stopPropagation(); askDelete('order', o.number) }}><Trash2 /></button></span><span className="mono">{o.number}</span><strong>{nameOf(o)}</strong><small>{villageOf(o)} · {dayLabel(o.createdAt)}</small><em className={payClass(payState(o))}>{payLabel(o)}</em></div>)}
              {!visibleOrders.some(o => o.status === status) && <p className="board-empty">No {status.toLowerCase()} orders{deliveryFilter ? ' for this delivery date' : ''}.</p>}
            </div>)}</div>
          </>}

          {activeNav === 'Customers' && <div className="customer-table">{customers.length ? customers.map(c => {
            const bal = customerBalance(c.id); const visits = orders.filter(o => o.customerId === c.id).length
            return <div role="button" tabIndex={0} className="customer-row" key={c.id} onClick={() => openCustomer(c)} onKeyDown={e => { if (e.key === 'Enter') openCustomer(c) }}><span className="result-avatar">{initialsOf(c)}</span><span><strong>{c.name}</strong><small>{c.village} · {formatMobile(c.mobile)} · {visits} visit{visits === 1 ? '' : 's'}</small></span><b className={bal ? 'status-unpaid' : 'status-paid'}>{bal ? `${money(bal)} due` : 'Paid'}</b><span className="row-actions"><button aria-label={`Edit ${c.name}`} onClick={e => { e.stopPropagation(); openEditCustomer(c) }}><Pencil /></button><button aria-label={`Delete ${c.name}`} className="danger" onClick={e => { e.stopPropagation(); askDelete('customer', c.id) }}><Trash2 /></button></span></div>
          }) : <p className="modal-help" style={{ padding: 21 }}>No customers yet. Add one to get started.</p>}</div>}

          {activeNav === 'Frames & lenses' && <>
            <div className="catalog-edit-toolbar"><span>Add the frames and lenses you sell. Prices are entered on each order.</span><div><Button variant="outline" onClick={() => openCatalogItem('Frame')}><CirclePlus data-icon="inline-start" /> Add frame</Button><Button variant="outline" onClick={() => openCatalogItem('Lens')}><CirclePlus data-icon="inline-start" /> Add lens</Button></div></div>
            <div className="catalog-tabs">{(['Frames', 'Lenses'] as const).map(t => <button key={t} className={catalogTab === t ? 'selected' : ''} onClick={() => setCatalogTab(t)}>{t} <b>{t === 'Frames' ? frames.length : lenses.length}</b></button>)}</div>
            <div className="catalog-list">{(catalogTab === 'Frames' ? frames : lenses).map(item => {
              const type = catalogTab === 'Frames' ? 'Frame' : 'Lens'
              return <div className="catalog-row" key={item.id}><strong>{item.name}</strong><span className="row-actions"><button aria-label={`Edit ${item.name}`} onClick={() => openCatalogItem(type, item)}><Pencil /></button><button aria-label={`Delete ${item.name}`} className="danger" onClick={() => askDelete(type === 'Frame' ? 'frame' : 'lens', item.id)}><Trash2 /></button></span></div>
            })}{(catalogTab === 'Frames' ? frames : lenses).length === 0 && <p className="modal-help" style={{ padding: 21 }}>Nothing here yet. Use the Add button above.</p>}</div>
          </>}

          {activeNav === 'Reports' && <div className="report-layout">
            <div className="report-head"><div className="report-filters"><select className="report-select" aria-label="Report period" value={period} onChange={e => setPeriod(e.target.value as Period)}>{PERIODS.map(t => <option key={t} value={t}>{t}</option>)}</select>{period === 'Custom range' && <><label className="report-date">From<input type="date" max={custom.to} value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} /></label><label className="report-date">To<input type="date" min={custom.from} max={today} value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} /></label></>}</div><span className="report-range">{range.label}</span></div>
            <div className="report-grid">
              <div><p className="eyebrow">Sales collected</p><strong className="report-number">{money(sumBy(rangePays))}</strong><span>{rangePays.length} payment{rangePays.length === 1 ? '' : 's'}</span></div>
              <div><p className="eyebrow">Orders</p><strong className="report-number">{monthOrders.length}</strong><span>{deliveredInRange} delivered</span></div>
              <div><p className="eyebrow">Amount due</p><strong className="report-number">{money(rangeBalance)}</strong><span>on this period's orders</span></div>
              <div><p className="eyebrow">Best seller</p><strong className="report-number">{bestLens?.[0] ?? '—'}</strong><span>{bestLens ? `${bestLens[1]} orders · ${pct(bestLens[1], monthOrders.length)}%` : 'No orders yet'}</span></div>
              <div><p className="eyebrow">Top frame</p><strong className="report-number">{bestFrame?.[0] ?? '—'}</strong><span>{bestFrame ? `${bestFrame[1]} sold` : 'No orders yet'}</span></div>
            </div>
            <div className="report-bars"><h3>Collections by method</h3>{METHODS.map(m => <div key={m}><span>{m}</span><b>{money(sumBy(rangePays, m))}</b><i style={{ width: `${pct(sumBy(rangePays, m), sumBy(rangePays))}%` }} /></div>)}</div>
            {rangeBuckets.length > 0 && <div className="report-bars"><h3>Collections over time</h3>{rangeBuckets.map(([label, amount]) => <div key={label}><span>{label}</span><b>{money(amount)}</b><i style={{ width: `${pct(amount, bucketMax)}%` }} /></div>)}</div>}
          </div>}
        </section>}

        {activeNav === 'Home' && <>
          <section className="metric-grid">
            <div className="metric-card"><div className="metric-icon"><ReceiptIndianRupee /></div><p>Today's orders</p><strong>{todaysOrders.length}</strong><span className="metric-note">{todaysOrders.length - yesterdaysOrderCount >= 0 ? '+' : ''}{todaysOrders.length - yesterdaysOrderCount} from yesterday</span></div>
            <div className="metric-card accent-olive"><div className="metric-icon"><PackageCheck /></div><p>Ready for pickup</p><strong>{readyCount}</strong><button className="metric-link" onClick={() => { setActiveNav('Orders') }}>View orders <ChevronRight /></button></div>
            <div className="metric-card accent-terra"><div className="metric-icon"><Clock3 /></div><p>Overdue</p><strong>{overdueCount}</strong><button className="metric-link" onClick={() => { setActiveNav('Orders') }}>Needs attention <ChevronRight /></button></div>
            <div className="metric-card accent-ink"><div className="metric-icon"><IndianRupee /></div><p>Today's collection</p><strong>{money(todayTotal)}</strong><span className="metric-note">Cash {money(sumBy(todayPays, 'Cash'))} · UPI {money(sumBy(todayPays, 'UPI'))}</span></div>
          </section>
          <div className="main-grid">
            <section className="panel orders-panel">
              <div className="panel-header"><div><h2>Today's orders</h2><p>Keep the day moving</p></div><button className="text-link" onClick={() => { setActiveNav('Orders') }}>View all orders <ChevronRight /></button></div>
              <div className="order-list">{todaysOrders.length ? [...todaysOrders].reverse().slice(0, 4).map(o => <button key={o.number} className={`order-row ${isOverdue(o, today) ? 'is-overdue' : ''}`} onClick={() => openOrder(o)}>
                <div className="order-number">{o.number}<span>{dayLabel(o.createdAt)} · {formatTime(o.createdTime)}</span></div>
                <div className="order-customer"><strong>{nameOf(o)}</strong><span>{villageOf(o)} · {orderLine(o)}</span></div>
                <div className="order-status"><span className="status-pill">{o.status}</span><span className={`payment-pill ${payClass(payState(o))}`}>{payLabel(o)}</span></div><ChevronRight className="row-chevron" />
              </button>) : <p className="modal-help" style={{ padding: 21 }}>No orders yet today. Tap “New order” to add one.</p>}</div>
            </section>
            <section className="panel collection-panel">
              <div className="panel-header"><div><h2>Collection today</h2><p>Money received by method</p></div><MoreHorizontal /></div>
              <div className="collection-total">{money(todayTotal)} {yesterdayTotal > 0 && <span>{todayTotal >= yesterdayTotal ? '+' : ''}{Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100)}%</span>}</div>
              <div className="collection-bars">{METHODS.map(m => <div className="bar-line" key={m}><span>{m}</span><strong>{money(sumBy(todayPays, m))}</strong><div className="bar"><i style={{ width: `${pct(sumBy(todayPays, m), todayTotal)}%` }} /></div></div>)}</div>
              <div className="collection-footer"><span><Smartphone /> {todayPays.filter(p => p.method === 'UPI').length} UPI payments</span><span><CreditCard /> {todayPays.filter(p => p.method === 'Card').length} card payments</span></div>
            </section>
          </div>
          <section className="panel orders-panel due-panel">
            <div className="panel-header"><div><h2>Due for delivery today</h2><p>{dueToday.length ? `${dueToday.length} order${dueToday.length === 1 ? '' : 's'} to hand over` : 'Nothing pending'}</p></div><button className="text-link" onClick={() => { setDeliveryFilter(today); setActiveNav('Orders') }}>View on board <ChevronRight /></button></div>
            <div className="order-list">{dueToday.length ? dueToday.map(o => <button key={o.number} className="order-row" onClick={() => openOrder(o)}>
              <div className="order-number">{o.number}<span>Due today</span></div>
              <div className="order-customer"><strong>{nameOf(o)}</strong><span>{villageOf(o)} · {orderLine(o)}</span></div>
              <div className="order-status"><span className="status-pill">{o.status}</span><span className={`payment-pill ${payClass(payState(o))}`}>{payLabel(o)}</span></div><ChevronRight className="row-chevron" />
            </button>) : <p className="modal-help" style={{ padding: 21 }}>No orders are due for delivery today.</p>}</div>
          </section>
          <section className="lower-grid">
            <div className="balance-card"><div className="balance-head"><div><p className="eyebrow">Friendly reminder</p><h2>Pending dues</h2></div><div className="balance-icon"><IndianRupee /></div></div><strong className="balance-total">{money(pendingTotal)}</strong><p className="balance-sub">from {pendingCustomers} customer{pendingCustomers === 1 ? '' : 's'}</p><div className="balance-footer"><span>Oldest due: <b>{oldestPending} days</b></span><button onClick={() => { setActiveNav('Orders') }}>View list <ChevronRight /></button></div></div>
            <div className="quick-card"><div><p className="eyebrow">Quick actions</p><h2>Make the counter faster</h2></div><div className="quick-actions"><button onClick={() => openNewOrder()}><CirclePlus /><span>New order</span></button><button onClick={() => setActiveNav('Customers')}><Users /><span>Find customer</span></button><button onClick={() => setActiveNav('Frames & lenses')}><ShoppingBag /><span>Frames & lenses</span></button></div></div>
          </section>
        </>}
      </div>

      <div className="mobile-nav">
        {[nav[0], nav[1]].map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'active' : ''} onClick={() => setActiveNav(label)}><Icon /><span>{label}</span></button>)}
        <button className="mobile-new" aria-label="New order" onClick={() => openNewOrder()}><span className="fab"><Plus /></span><span>New order</span></button>
        <button className={activeNav === 'Customers' ? 'active' : ''} onClick={() => setActiveNav('Customers')}><Users /><span>Customers</span></button>
        <button className={['Frames & lenses', 'Reports'].includes(activeNav) ? 'active' : ''} onClick={() => setModal('more')}><MoreHorizontal /><span>More</span></button>
      </div>
    </section>

    {modal === 'order' && form && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="order-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">{editingNo ? `Editing order ${editingNo}` : 'Quick entry'}</p><h2>{editingNo ? 'Edit spectacle order' : 'New spectacle order'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
      <div className="order-form-grid">
        <label className="suggest-wrap">Customer mobile<input inputMode="numeric" autoComplete="off" placeholder="10-digit mobile number" value={form.mobile} readOnly={!!editingNo} onFocus={() => setSuggest('mobile')} onBlur={() => setSuggest('')} onChange={e => { setMobile(e.target.value); setSuggest('mobile') }} />{suggestList('mobile')}</label>
        <label className="suggest-wrap">Customer name<input autoComplete="off" placeholder="Full name" value={form.name} onFocus={() => setSuggest('name')} onBlur={() => setSuggest('')} onChange={e => { patchForm({ name: e.target.value }); setSuggest('name') }} />{suggestList('name')}</label>
        <label>Village<input placeholder="Search village" value={form.village} onChange={e => patchForm({ village: e.target.value })} /></label>
        <label>Expected delivery<input type="date" value={form.delivery} onChange={e => patchForm({ delivery: e.target.value })} /></label>
      </div>
      <div className="form-section"><div className="section-title"><h3>Eye power</h3><button onClick={useLastPower}><ClipboardList /> Use last power</button></div>
        <div className="power-grid"><span></span><b>SPH</b><b>CYL</b><b>AXIS</b>
          <span>OD</span>{form.od.map((v, i) => <input key={i} value={v} onChange={e => patchForm({ od: form.od.map((x, j) => (j === i ? e.target.value : x)) })} />)}
          <span>OS</span>{form.os.map((v, i) => <input key={i} value={v} onChange={e => patchForm({ os: form.os.map((x, j) => (j === i ? e.target.value : x)) })} />)}
        </div></div>
      <div className="form-section"><h3>Frame & lens</h3>
        <div className="choice-grid">{frames.map(f => <button key={f.id} className={`choice-card ${form.frameId === f.id ? 'selected' : ''}`} onClick={() => patchForm({ frameId: f.id })}><strong>{f.name}</strong></button>)}</div>
        <div className="lens-row">{lenses.map(l => <button key={l.id} className={form.lensId === l.id ? 'selected' : ''} onClick={() => patchForm({ lensId: l.id })}>{l.name}</button>)}</div></div>
      <div className="form-section"><h3>Note <small className="optional">(optional)</small></h3><textarea className="note-input" rows={2} placeholder="Anything to remember about this order…" value={form.note} onChange={e => patchForm({ note: e.target.value })} /></div>
      <div className="form-section"><div className="section-title"><h3>Pricing & payment</h3><span className="price-note">Set final prices for this order</span></div>
        <div className="order-price-grid">
          <label>Frame price (₹)<input inputMode="numeric" value={form.framePrice} onChange={e => patchForm({ framePrice: digits(e.target.value) })} /></label>
          <label>Lens price (₹)<input inputMode="numeric" value={form.lensPrice} onChange={e => patchForm({ lensPrice: digits(e.target.value) })} /></label>
          <label>Extras (₹)<input inputMode="numeric" value={form.extras} onChange={e => patchForm({ extras: digits(e.target.value) })} /></label>
          {!editingNo && form.mode === 'Part payment' && <label>Advance (₹)<input inputMode="numeric" placeholder="0" value={form.advance} onChange={e => patchForm({ advance: digits(e.target.value) })} /></label>}
        </div>
        {!editingNo && <div className="payment-options">{(['Full payment', 'Part payment', 'Pay at delivery'] as const).map(p => <button key={p} className={form.mode === p ? 'selected' : ''} onClick={() => patchForm({ mode: p })}>{p}<small>{p === 'Full payment' ? `${money(formTotal)} paid` : p === 'Part payment' ? `Advance ${money(formPaidNow)}` : `Due ${money(formTotal)}`}</small></button>)}</div>}
        {!editingNo && form.mode !== 'Pay at delivery' && <div className="method-row">{METHODS.map(m => <button key={m} className={form.method === m ? 'selected' : ''} onClick={() => patchForm({ method: m })}>{m}</button>)}</div>}
        <div className="total-line"><span>Total <small>Frame {money(num(form.framePrice))} + lens {money(num(form.lensPrice))} + extras {money(num(form.extras))}</small></span><strong>{money(formTotal)}</strong></div></div>
      <div className="modal-actions">{editingNo ? <><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={saveOrder}><Check data-icon="inline-start" /> Save changes</Button></> : <><Button variant="outline" onClick={() => { setDraft(form); setModal(null); notify('Draft saved') }}>Save draft</Button><Button onClick={saveOrder}><Printer data-icon="inline-start" /> Save & Print Order Slip</Button></>}</div>
    </section></div>}

    {modal === 'catalogItem' && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="new-order-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">Catalog</p><h2>{catalogEdit.id ? 'Edit' : 'Add'} {catalogEdit.type.toLowerCase()}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
      <div className="simple-fields"><label>{catalogEdit.type} name<input autoFocus placeholder={catalogEdit.type === 'Frame' ? 'e.g. Ray-Ban RB 5228' : 'e.g. Progressive'} value={catalogEdit.name} onChange={e => setCatalogEdit(c => ({ ...c, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') saveCatalogItem() }} /></label></div>
      <Button className="modal-submit" onClick={saveCatalogItem}>{catalogEdit.id ? 'Save changes' : `Add ${catalogEdit.type.toLowerCase()}`}</Button>
    </section></div>}

    {modal === 'customer' && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="new-order-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">Customer book</p><h2>{editingCustomerId ? 'Edit customer' : 'Add new customer'}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
      <div className="simple-fields">
        <label>Name<input autoFocus placeholder="Customer name" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label>Mobile number<input placeholder="10-digit mobile" inputMode="numeric" value={customerForm.mobile} onChange={e => setCustomerForm(f => ({ ...f, mobile: e.target.value }))} /></label>
        <label>Village<input placeholder="Bavla, Sanand..." value={customerForm.village} onChange={e => setCustomerForm(f => ({ ...f, village: e.target.value }))} /></label>
      </div>
      <Button className="modal-submit" onClick={saveCustomer}>{editingCustomerId ? 'Save changes' : <>Save & start order <ChevronRight data-icon="inline-end" /></>}</Button>
    </section></div>}

    {modal === 'customerDetail' && selectedCustomer && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="detail-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">Customer</p><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.village} · {formatMobile(selectedCustomer.mobile)}</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
      <div className="detail-status"><span className={customerBalance(selectedCustomer.id) ? 'status-unpaid' : 'status-paid'}>{customerBalance(selectedCustomer.id) ? `${money(customerBalance(selectedCustomer.id))} due` : 'No amount due'}</span></div>
      <div className="payment-timeline"><h3>Orders</h3>{orders.filter(o => o.customerId === selectedCustomer.id).length
        ? sortedOrders.filter(o => o.customerId === selectedCustomer.id).map(o => <p key={o.number}><button className="text-link" onClick={() => openOrder(o)}>{o.number} · {o.status}</button><strong>{money(orderTotal(o))}</strong></p>)
        : <p><span>No orders yet</span></p>}</div>
      <div className="detail-actions"><Button onClick={() => openNewOrder({ mobile: selectedCustomer.mobile, name: selectedCustomer.name, village: selectedCustomer.village })}><CirclePlus data-icon="inline-start" /> New order</Button><Button variant="outline" onClick={() => notify('WhatsApp is coming soon')}><MessageCircle data-icon="inline-start" /> WhatsApp</Button></div>
    </section></div>}

    {modal === 'orderDetail' && selectedOrder && (() => {
      const o = selectedOrder; const bal = orderBalance(o)
      return <div className="modal-backdrop" onClick={() => setModal(null)}><section className="detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">Order details</p><h2 className="mono large">{o.number}</h2><p>{nameOf(o)} · {villageOf(o)} · {o.frame} · {o.lens}</p><p className="created-at" suppressHydrationWarning>Created {new Date(`${o.createdAt}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {formatTime(o.createdTime)}</p></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
        <div className="detail-status"><span className="status-pill">{o.status}</span><span className={payClass(payState(o))}>{payState(o)} · {money(bal)} due</span></div>
        {o.note && <div className="pickup-box"><h3>Note</h3><p className="note-text">{o.note}</p></div>}
        {[...o.power.od, ...o.power.os].some(v => v.trim()) && <div className="pickup-box"><h3>Eye power</h3>
          <div className="power-grid"><span></span><b>SPH</b><b>CYL</b><b>AXIS</b>
            <span>OD</span>{o.power.od.map((v, i) => <em className="power-value" key={i}>{v.trim() || '—'}</em>)}
            <span>OS</span>{o.power.os.map((v, i) => <em className="power-value" key={i}>{v.trim() || '—'}</em>)}
          </div></div>}
        <div className="pickup-box"><h3>Progress</h3><div className="method-row">{STATUSES.map(s => <button key={s} className={o.status === s ? 'selected' : ''} onClick={() => setStatus(o, s)}>{s}</button>)}</div>
          <p>Expected delivery: <strong suppressHydrationWarning>{new Date(`${o.delivery}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>{isOverdue(o, today) && ' · overdue'}</p>
          {o.status === 'Delivered' && o.deliveredAt && <p>Delivered on: <strong suppressHydrationWarning>{new Date(`${o.deliveredAt}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {formatTime(o.deliveredTime ?? '00:00')}</strong></p>}</div>
        <div className="pickup-box"><h3>Payment</h3>
          <div className="pay-summary"><div><small>Total</small><strong>{money(orderTotal(o))}</strong></div><div><small>Paid</small><strong className="status-paid">{money(orderPaid(o))}</strong></div><div><small>Due</small><strong className={bal ? 'status-unpaid' : 'status-paid'}>{money(bal)}</strong></div></div>
          {bal > 0 ? <>
            <div className="method-row">{METHODS.map(m => <button key={m} className={pay.method === m ? 'selected' : ''} onClick={() => setPay(p => ({ ...p, method: m }))}>{m}</button>)}</div>
            <label className="pay-amount"><span className="pay-amount-head">Amount (₹)<button type="button" className="text-link" onClick={() => setPay(p => ({ ...p, amount: String(bal) }))}>Full due amount</button></span><input inputMode="numeric" value={pay.amount} onChange={e => setPay(p => ({ ...p, amount: digits(e.target.value) }))} /></label>
            <Button className="collect-btn" disabled={num(pay.amount) <= 0} onClick={() => collect(o)}><IndianRupee data-icon="inline-start" /> Collect {money(Math.min(num(pay.amount), bal))} via {pay.method}</Button>
            {num(pay.amount) > 0 && num(pay.amount) < bal && <p className="pay-hint">{money(bal - num(pay.amount))} will still be due after this payment</p>}
          </> : <div className="paid-badge"><Check /> Fully paid</div>}
        </div>
        <div className="detail-actions"><Button variant="outline" onClick={() => notify('WhatsApp is coming soon')}><MessageCircle data-icon="inline-start" /> WhatsApp</Button><Button variant="outline" onClick={() => notify('Order slip sent to printer')}><Printer data-icon="inline-start" /> Print slip</Button><Button variant="outline" onClick={() => downloadInvoice(o, customerOf(o.customerId), settings).then(() => notify(`Invoice ${o.number} downloaded`)).catch(() => notify('Could not create invoice'))}><FileText data-icon="inline-start" /> Invoice</Button></div>
        <div className="payment-timeline"><h3>Payment timeline</h3>
          {o.payments.map((p, i) => <p key={i}><span>{shortDate(p.date)} · {p.note}</span><strong>{money(p.amount)} · {p.method}</strong></p>)}
          <p><span>Total {money(orderTotal(o))} · Paid {money(orderPaid(o))}</span><strong>Due {money(bal)}</strong></p></div>
      </section></div>
    })()}

    {modal === 'settings' && <div className="modal-backdrop" onClick={() => setModal(null)}><section className="settings-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">Shop setup</p><h2>Settings</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
      <div className="settings-list">
        <label>Owner name<input value={settingsDraft.ownerName} onChange={e => setSettingsDraft(s => ({ ...s, ownerName: e.target.value }))} /></label>
        <label>Shop name<input value={settingsDraft.shopName} onChange={e => setSettingsDraft(s => ({ ...s, shopName: e.target.value }))} /></label>
        <label>Phone<input value={settingsDraft.phone} onChange={e => setSettingsDraft(s => ({ ...s, phone: e.target.value }))} /></label>
        <label>GSTIN (optional)<input placeholder="Add GSTIN to show on invoices" value={settingsDraft.gstin} onChange={e => setSettingsDraft(s => ({ ...s, gstin: e.target.value }))} /></label>
        <label>Default delivery days<input inputMode="numeric" value={settingsDraft.deliveryDays} onChange={e => setSettingsDraft(s => ({ ...s, deliveryDays: digits(e.target.value) }))} /></label>
        <div className="setting-row"><span><strong>WhatsApp reminders</strong><small>Offer ready and payment-due messages</small></span><button className={settingsDraft.whatsapp ? 'toggle-on' : ''} onClick={() => setSettingsDraft(s => ({ ...s, whatsapp: !s.whatsapp }))}>{settingsDraft.whatsapp ? 'On' : 'Off'}</button></div>
      </div>
      <Button className="modal-submit" disabled={saving} onClick={() => run(async () => { await db.saveSettings(settingsDraft); setSettings(settingsDraft); setModal(null); notify('Settings saved') })}>Save settings</Button>
      <Button variant="outline" className="modal-submit logout-mobile" onClick={logout}><LogOut data-icon="inline-start" /> Log out</Button>
    </section></div>}

    {modal === 'more' && <div className="modal-backdrop sheet-backdrop" onClick={() => setModal(null)}><section className="more-sheet" onClick={e => e.stopPropagation()}>
      <div className="sheet-grip" />
      {nav.slice(3).map(({ label, icon: Icon }) => <button key={label} className={activeNav === label ? 'active' : ''} onClick={() => { setActiveNav(label); setModal(null) }}><Icon /> {label}</button>)}
      <button onClick={() => { setSettingsDraft(settings); setModal('settings') }}><SettingsIcon /> Settings</button>
      <button className="danger" onClick={logout}><LogOut /> Log out</button>
    </section></div>}
    {modal === 'confirm' && pendingDelete && (() => {
      const o = pendingDelete.kind === 'order' ? orders.find(x => x.number === pendingDelete.id) : undefined
      const c = pendingDelete.kind === 'customer' ? customers.find(x => x.id === pendingDelete.id) : undefined
      const theirs = c ? orders.filter(x => x.customerId === c.id).length : 0
      const item = pendingDelete.kind === 'frame' ? frames.find(x => x.id === pendingDelete.id) : pendingDelete.kind === 'lens' ? lenses.find(x => x.id === pendingDelete.id) : undefined
      if (!o && !c && !item) return null
      return <div className="modal-backdrop" onClick={() => setModal(null)}><section className="new-order-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><p className="eyebrow">Confirm</p><h2>{o ? `Delete order ${o.number}?` : c ? `Delete ${c.name}?` : `Delete ${item!.name}?`}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Close"><X /></button></div>
        <p className="modal-help">{item ? 'It will no longer appear when creating orders. Existing orders keep their details.' : o ? `This removes the order and its ${o.payments.length} payment record${o.payments.length === 1 ? '' : 's'}. This can't be undone.` : `This removes the customer${theirs ? ` and their ${theirs} order${theirs === 1 ? '' : 's'}` : ''}. This can't be undone.`}</p>
        <div className="modal-actions"><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button className="danger-btn" onClick={() => (o ? deleteOrder(o) : c ? deleteCustomer(c) : deleteCatalogItem(pendingDelete.kind as 'frame' | 'lens', item!.id))}><Trash2 data-icon="inline-start" /> Delete</Button></div>
      </section></div>
    })()}
    {toast && <div className="toast"><span className="status-dot" /> {toast}</div>}
  </main>
}
