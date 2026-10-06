import { formatTime, orderBalance, orderPaid, orderTotal, payState, shortDate, formatMobile, type Customer, type Order, type Settings } from './data'

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN')}`

export async function downloadInvoice(order: Order, customer: Customer | undefined, settings: Settings) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210; const L = 18; const R = W - 18
  let y = 22

  doc.setFont('helvetica', 'bold').setFontSize(20).text(settings.shopName, L, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(100)
  doc.text(settings.phone, L, (y += 6))
  if (settings.gstin) doc.text(`GSTIN: ${settings.gstin}`, L, (y += 5))
  doc.setTextColor(0).setFont('helvetica', 'bold').setFontSize(16).text('INVOICE', R, 22, { align: 'right' })
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(100)
  doc.text(`No: INV-${order.number.replace('KCG-', '')}`, R, 28, { align: 'right' })
  doc.text(`Order: ${order.number}`, R, 33, { align: 'right' })
  doc.text(`Date: ${shortDate(order.createdAt)} ${order.createdAt.slice(0, 4)}, ${formatTime(order.createdTime)}`, R, 38, { align: 'right' })

  y = 48
  doc.setDrawColor(220).line(L, y, R, y)
  doc.setTextColor(100).setFontSize(9).text('BILL TO', L, (y += 8))
  doc.setTextColor(0).setFontSize(12).setFont('helvetica', 'bold').text(customer?.name ?? 'Customer', L, (y += 6))
  doc.setFont('helvetica', 'normal').setFontSize(10)
  if (customer) doc.text(`${customer.village} · ${formatMobile(customer.mobile)}`.replace('·', '-'), L, (y += 5))

  // eye power, only when entered
  const { od, os } = order.power
  if ([...od, ...os].some(v => v.trim())) {
    y += 10
    doc.setTextColor(100).setFontSize(9).text('EYE POWER', L, y)
    doc.setTextColor(0).setFontSize(10)
    const cols = [L + 14, L + 44, L + 74]
    ;['SPH', 'CYL', 'AXIS'].forEach((h, i) => doc.text(h, cols[i], y + 6))
    doc.text('OD', L, y + 12); od.forEach((v, i) => doc.text(v.trim() || '-', cols[i], y + 12))
    doc.text('OS', L, y + 18); os.forEach((v, i) => doc.text(v.trim() || '-', cols[i], y + 18))
    y += 18
  }

  y += 12
  doc.setFillColor(244, 246, 251).rect(L, y - 5, R - L, 9, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(10)
  doc.text('Item', L + 3, y + 1); doc.text('Amount', R - 3, y + 1, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  const items: [string, number][] = [[`Frame - ${order.frame}`, order.framePrice], [`Lens - ${order.lens}`, order.lensPrice]]
  if (order.extras) items.push(['Extras', order.extras])
  items.forEach(([label, amount]) => { y += 9; doc.text(label, L + 3, y + 1); doc.text(rs(amount), R - 3, y + 1, { align: 'right' }) })

  y += 8; doc.setDrawColor(220).line(L, y, R, y)
  const row = (label: string, value: string, bold = false) => {
    y += 7; doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 12 : 10)
    doc.text(label, R - 60, y); doc.text(value, R - 3, y, { align: 'right' })
  }
  row('Total', rs(orderTotal(order)), true)
  row('Paid', rs(orderPaid(order)))
  row('Amount due', rs(orderBalance(order)), true)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(100).text(`Status: ${payState(order)}`, L, y)

  if (order.payments.length) {
    y += 12
    doc.setTextColor(100).setFontSize(9).text('PAYMENTS', L, y)
    doc.setTextColor(0).setFontSize(10)
    order.payments.forEach(p => { y += 6; doc.text(`${shortDate(p.date)} - ${p.note} (${p.method})`, L, y); doc.text(rs(p.amount), R - 3, y, { align: 'right' }) })
  }

  if (order.note) { y += 12; doc.setTextColor(100).setFontSize(9).text('NOTE', L, y); doc.setTextColor(0).setFontSize(10).text(doc.splitTextToSize(order.note, R - L), L, y + 6) }
  doc.setTextColor(120).setFontSize(9).text(`Thank you for shopping at ${settings.shopName}.`, W / 2, 285, { align: 'center' })
  doc.save(`${order.number}-invoice.pdf`)
}
