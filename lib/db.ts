import { createClient } from './supabase/client'
import { iso, nowTime, type Customer, type Frame, type Lens, type Method, type Order, type Payment, type Settings, type Status } from './data'

// Everything here talks to Supabase. Rows are never deleted: "delete" sets deleted_at.
let client: ReturnType<typeof createClient> | undefined
const sb = () => (client ??= createClient())

const fail = (error: { message: string; code?: string } | null): void => {
  if (!error) return
  if (error.code === '23505') throw new Error('That already exists')
  throw new Error(error.message)
}

type Row = Record<string, any>
const mapCustomer = (r: Row): Customer => ({ id: r.id, name: r.name, village: r.village, mobile: r.mobile })
const mapPayment = (r: Row): Payment => ({ id: r.id, date: iso(new Date(r.paid_at)), amount: r.amount, method: r.method as Method, note: r.note })
const mapOrder = (r: Row): Order => {
  const created = new Date(r.created_at); const delivered = r.delivered_at ? new Date(r.delivered_at) : undefined
  return {
    id: r.id, number: r.number, customerId: r.customer_id, frame: r.frame, lens: r.lens,
    framePrice: r.frame_price, lensPrice: r.lens_price, extras: r.extras, power: r.power, note: r.note ?? undefined,
    status: r.status as Status, createdAt: iso(created), createdTime: nowTime(created), delivery: r.delivery_date,
    deliveredAt: delivered && iso(delivered), deliveredTime: delivered && nowTime(delivered),
    payments: ((r.payments ?? []) as Row[]).filter(p => !p.deleted_at).sort((a, b) => a.paid_at.localeCompare(b.paid_at)).map(mapPayment),
  }
}
const mapSettings = (r: Row): Settings => ({ shopName: r.shop_name, ownerName: r.owner_name, phone: r.phone, gstin: r.gstin, deliveryDays: String(r.delivery_days), whatsapp: r.whatsapp })

export async function loadAll() {
  const db = sb()
  const [c, o, f, l, s] = await Promise.all([
    db.from('customers').select('*').is('deleted_at', null).order('created_at'),
    db.from('orders').select('*, payments(*)').is('deleted_at', null).order('created_at'),
    db.from('frames').select('*').is('deleted_at', null).order('created_at'),
    db.from('lenses').select('*').is('deleted_at', null).order('created_at'),
    db.from('shop_settings').select('*').maybeSingle(),
  ])
  for (const r of [c, o, f, l, s]) fail(r.error)
  return {
    customers: (c.data ?? []).map(mapCustomer), orders: (o.data ?? []).map(mapOrder),
    frames: (f.data ?? []) as Frame[], lenses: (l.data ?? []) as Lens[], settings: s.data ? mapSettings(s.data) : null,
  }
}

export async function nextOrderNumber() {
  const { data, error } = await sb().rpc('next_order_number'); fail(error); return data as string
}

export async function createCustomer(c: Omit<Customer, 'id'>) {
  const { data, error } = await sb().from('customers').insert(c).select().single(); fail(error); return mapCustomer(data!)
}
export async function updateCustomer(id: string, c: Omit<Customer, 'id'>) {
  const { error } = await sb().from('customers').update(c).eq('id', id); fail(error)
}
export async function softDeleteCustomer(id: string) {
  const { error } = await sb().rpc('soft_delete_customer', { p_id: id }); fail(error)
}

export type NewOrder = Pick<Order, 'customerId' | 'frame' | 'lens' | 'framePrice' | 'lensPrice' | 'extras' | 'power' | 'note' | 'delivery'> & { payment?: { amount: number; method: Method; note: string } }
export async function createOrder(o: NewOrder) {
  const db = sb(); const number = await nextOrderNumber()
  const { data, error } = await db.from('orders').insert({
    number, customer_id: o.customerId, frame: o.frame, lens: o.lens, frame_price: o.framePrice, lens_price: o.lensPrice,
    extras: o.extras, power: o.power, note: o.note ?? null, delivery_date: o.delivery,
  }).select('*, payments(*)').single()
  fail(error)
  if (o.payment) {
    const p = await db.from('payments').insert({ order_id: data!.id, ...o.payment }).select().single(); fail(p.error)
    data!.payments = [p.data]
  }
  return mapOrder(data!)
}
export async function updateOrder(id: string, o: Omit<NewOrder, 'customerId' | 'payment'>) {
  const { error } = await sb().from('orders').update({
    frame: o.frame, lens: o.lens, frame_price: o.framePrice, lens_price: o.lensPrice, extras: o.extras,
    power: o.power, note: o.note ?? null, delivery_date: o.delivery,
  }).eq('id', id); fail(error)
}
export async function setOrderStatus(id: string, status: Status) {
  const { error } = await sb().from('orders').update({ status, delivered_at: status === 'Delivered' ? new Date().toISOString() : null }).eq('id', id); fail(error)
}
export async function softDeleteOrder(id: string) {
  const { error } = await sb().from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', id); fail(error)
}
export async function addPayment(orderId: string, p: { amount: number; method: Method; note: string }) {
  const { data, error } = await sb().from('payments').insert({ order_id: orderId, ...p }).select().single(); fail(error); return mapPayment(data!)
}

export async function createCatalogItem(table: 'frames' | 'lenses', name: string) {
  const { data, error } = await sb().from(table).insert({ name }).select().single(); fail(error); return data as Frame
}
export async function renameCatalogItem(table: 'frames' | 'lenses', id: string, name: string) {
  const { error } = await sb().from(table).update({ name }).eq('id', id); fail(error)
}
export async function softDeleteCatalogItem(table: 'frames' | 'lenses', id: string) {
  const { error } = await sb().from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id); fail(error)
}

export async function saveSettings(s: Settings) {
  const { error } = await sb().from('shop_settings').upsert({ shop_name: s.shopName, owner_name: s.ownerName, phone: s.phone, gstin: s.gstin, delivery_days: Number(s.deliveryDays) || 0, whatsapp: s.whatsapp }); fail(error)
}
export async function signOut() { await sb().auth.signOut() }
