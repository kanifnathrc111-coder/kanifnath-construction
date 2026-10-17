/* ==========================================================================
   finance.js - pure calculation helpers (no DOM, no Firebase).
   Shared by Dashboard and History so both always agree.

   Data facts (from how the existing pages save records):
   - documents/{id}: type "Invoice" | "Quotation".
       Invoice: subtotal, gstAmount, advance, amount (= BALANCE after advance), status, dueDate
       Quotation: subTotal, gstAmount, amount (= grand total)
   - labourWorks.amount   = work earned by a labour (cubic metre x rate)
   - labourExpenses.amount = advances / food / travel ... paid on a labour's behalf
   - labourPayments.amount = salary paid to a labour
   Labour balance (existing rule): earned - expenses - payments.
   ========================================================================== */
export const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
/* ---- Exact money arithmetic in whole paise (avoids float drift, so printed lines always add up) ---- */
export const toPaise = (v) => Math.round(num(v) * 100);
/** Invoice: GST is rounded to paise FIRST, then balance = subtotal + GST - advance (never below 0). */
export function invoiceTotals(subtotal, gstPercent, advance) {
  const sub = toPaise(subtotal), gst = Math.round(sub * num(gstPercent) / 100), adv = toPaise(advance);
  return { subtotal: sub / 100, gstAmount: gst / 100, final: Math.max(0, sub + gst - adv) / 100 };
}
/** Quotation: fixed 18% GST (unchanged rule); gstOn=false omits GST from the total. */
export function quotationTotals(subtotal, gstOn = true) {
  const sub = toPaise(subtotal), gst = gstOn ? Math.round(sub * 18 / 100) : 0;
  return { subtotal: sub / 100, gstAmount: gst / 100, total: (sub + gst) / 100 };
}
export const siteKey = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const EXPENSE_LABELS = { Bazar: "Food", home: "Diesel", kharchi: "Room Rent" };
export const expenseLabel = (t) => EXPENSE_LABELS[t] || t || "Expense";

/** Invoice grand total (before advance). Older records without subtotal/gst fall back to amount + advance. */
export function invoiceTotal(d) {
  if (d.subtotal != null && d.gstAmount != null && d.subtotal !== "" && d.gstAmount !== "") return num(d.subtotal) + num(d.gstAmount);
  return num(d.amount != null ? d.amount : d.total) + num(d.advance);
}
export const invoiceStatus = (d) => d.status || d.paymentStatus || "";
export const invoicePending = (d) => (invoiceStatus(d) === "Pending" ? num(d.amount != null ? d.amount : d.total) : 0);
export const invoiceReceived = (d) => Math.max(0, invoiceTotal(d) - invoicePending(d));
export const isOverdue = (d, today) => invoiceStatus(d) === "Pending" && !!d.dueDate && d.dueDate < today;
export const inRange = (date, from, to) => {
  if (!from && !to) return true;
  if (!date) return false;
  const k = String(date).slice(0, 10);
  return (!from || k >= from) && (!to || k <= to);
};

export function monthKeys(from, to, today, max = 12) {
  const end = to || today; const [ey, em] = end.slice(0, 7).split("-").map(Number);
  let sy, sm;
  if (from) [sy, sm] = from.slice(0, 7).split("-").map(Number); else { sy = ey; sm = em - 5; while (sm < 1) { sm += 12; sy--; } }
  const out = []; let y = sy, m = sm;
  while ((y < ey || (y === ey && m <= em)) && out.length < 240) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
  return out.slice(-max);
}

/**
 * @param data {documents, labours, works, expenses, payments}
 * @param f    {from, to, site (siteKey or ""), today}
 */
export function computeFinance(data, f = {}) {
  const { from = "", to = "", site = "", today = new Date().toISOString().slice(0, 10) } = f;
  const labById = new Map(data.labours.map((l) => [l.id, l]));
  const labSite = (id) => siteKey((labById.get(id) || {}).site);
  const siteOk = (k) => !site || k === site;

  const invoices = data.documents.filter((d) => d.type === "Invoice" && inRange(d.date, from, to) && siteOk(siteKey(d.site)));
  const quotations = data.documents.filter((d) => d.type === "Quotation" && inRange(d.date, from, to) && siteOk(siteKey(d.site)));
  const works = data.works.filter((w) => inRange(w.date, from, to) && siteOk(siteKey(w.site) || labSite(w.labourId)));
  const expenses = data.expenses.filter((e) => inRange(e.date, from, to) && siteOk(labSite(e.labourId)));
  const payments = data.payments.filter((p) => inRange(p.date, from, to) && siteOk(labSite(p.labourId)));
  const labours = data.labours.filter((l) => siteOk(siteKey(l.site)));

  const sum = (arr, fn) => arr.reduce((s, x) => s + toPaise(fn(x)), 0) / 100;   // exact paise: no floating-point drift
  const revenue = sum(invoices, invoiceTotal);
  const pending = sum(invoices, invoicePending);
  const received = Math.max(0, revenue - pending);
  const expenseTotal = sum(expenses, (e) => num(e.amount));
  const paymentTotal = sum(payments, (p) => num(p.amount));
  const paidOut = expenseTotal + paymentTotal;
  const labourEarned = sum(works, (w) => num(w.amount));

  /* per-site table */
  const sites = new Map();
  const row = (name) => {
    const k = siteKey(name);
    if (!sites.has(k)) sites.set(k, { key: k, name: String(name || "").trim() || "Unassigned", invoiced: 0, received: 0, pending: 0, labourEarned: 0, paidOut: 0, labours: 0, activeLabours: 0, invoices: 0, clients: new Set() });
    return sites.get(k);
  };
  invoices.forEach((d) => { const r = row(d.site); r.invoiced += invoiceTotal(d); r.pending += invoicePending(d); r.received += invoiceReceived(d); r.invoices++; if (d.client) r.clients.add(d.client); });
  works.forEach((w) => { const l = labById.get(w.labourId); row(w.site || (l && l.site)).labourEarned += num(w.amount); });
  expenses.forEach((e) => { const l = labById.get(e.labourId); row(l && l.site).paidOut += num(e.amount); });
  payments.forEach((p) => { const l = labById.get(p.labourId); row(l && l.site).paidOut += num(p.amount); });
  labours.forEach((l) => { const r = row(l.site); r.labours++; if (l.status === "Active") r.activeLabours++; });
  const r2 = (v) => Math.round(v * 100) / 100;
  const siteRows = [...sites.values()].map((r) => ({ ...r, invoiced: r2(r.invoiced), received: r2(r.received), pending: r2(r.pending), labourEarned: r2(r.labourEarned), paidOut: r2(r.paidOut), clients: [...r.clients], profit: r2(r.invoiced - r.paidOut), payable: r2(r.labourEarned - r.paidOut) })).sort((a, b) => b.invoiced - a.invoiced || a.name.localeCompare(b.name));

  /* monthly series */
  const months = monthKeys(from, to, today);
  const rev = months.map(() => 0), out = months.map(() => 0);
  const put = (arr, date, v) => { const i = months.indexOf(String(date || "").slice(0, 7)); if (i > -1) arr[i] += v; };
  invoices.forEach((d) => put(rev, d.date, invoiceTotal(d)));
  expenses.forEach((e) => put(out, e.date, num(e.amount)));
  payments.forEach((p) => put(out, p.date, num(p.amount)));

  /* expense breakdown */
  const brk = new Map();
  expenses.forEach((e) => brk.set(expenseLabel(e.type), (brk.get(expenseLabel(e.type)) || 0) + num(e.amount)));
  if (paymentTotal) brk.set("Salary payments", paymentTotal);
  const breakdown = [...brk.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const activeSiteKeys = new Set(labours.filter((l) => l.status === "Active").map((l) => siteKey(l.site)).filter(Boolean));
  return {
    invoices, quotations, labours, works, expenses, payments,
    kpi: {
      revenue, received, pending, expenseTotal, paymentTotal, paidOut, labourEarned,
      labourPayable: Math.round((labourEarned - paidOut) * 100) / 100,
      profit: Math.round((revenue - paidOut) * 100) / 100,            // existing rule: invoiced revenue - labour cash paid out
      cashPosition: Math.round((received - paidOut) * 100) / 100,     // money actually received - money actually paid out
      invoiceCount: invoices.length, quotationCount: quotations.length, quotationValue: sum(quotations, (q) => num(q.amount)),
      labourCount: labours.length, activeLabours: labours.filter((l) => l.status === "Active").length,
      siteCount: siteRows.filter((r) => r.key).length, activeSites: activeSiteKeys.size,
      overdue: invoices.filter((d) => isOverdue(d, today)),
    },
    siteRows, months, rev, out, breakdown,
  };
}
