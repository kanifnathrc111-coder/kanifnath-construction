/* ==========================================================================
   common.js - shared helpers for every Kanifnath ERP page (ES module)
   Auth guard, app shell (sidebar / mobile drawer / header), toasts, modals,
   icons, formatting. No business data lives here.
   ========================================================================== */
import { auth, onAuthStateChanged, signOut } from "../firebase.js";
import { num, siteKey, expenseLabel } from "./finance.js";
export { num, siteKey, expenseLabel };

/* ---------- Theme (same localStorage key the old dashboard used) ---------- */
const THEME_KEY = "kcThemePreference";
export function applyTheme(mode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { /* storage blocked */ }
export function toggleTheme() {
  const dark = !document.documentElement.classList.contains("dark");
  applyTheme(dark ? "dark" : "light");
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch (e) {}
  const b = document.getElementById("theme-btn");
  if (b) b.innerHTML = icon(dark ? "sun" : "moon");
}

/* ---------- Escaping / formatting ---------- */
export function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function money(v, withSymbol = true) {
  const s = num(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return withSymbol ? "\u20B9 " + s : s;
}
export function moneyShort(v) {
  const n = num(v), a = Math.abs(n), sign = n < 0 ? "-" : "";
  if (a >= 1e7) return sign + "\u20B9" + (a / 1e7).toFixed(2) + " Cr";
  if (a >= 1e5) return sign + "\u20B9" + (a / 1e5).toFixed(2) + " L";
  return sign + "\u20B9" + Math.round(a).toLocaleString("en-IN");
}
export const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d) ? esc(iso) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
/* CSV cell. Text starting with = + - @ would be run as a formula by Excel/Sheets (CSV injection), so it is
   prefixed with an apostrophe; genuine negative numbers such as -100.00 are left alone. */
export const csvCell = (v) => {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export function downloadFile(name, text, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}


/* ---------- Number to words (Indian system, rupees) ---------- */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
export function below100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""); }
function below1000(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? below100(n % 100) : ""); }
export function numberToWords(n) {
  n = Math.floor(Math.abs(num(n)));
  if (n === 0) return "Zero";
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(below1000(crore) + " Crore");
  if (lakh) parts.push(below100(lakh) + " Lakh");
  if (th) parts.push(below100(th) + " Thousand");
  if (n) parts.push(below1000(n));
  return parts.join(" ");
}
function splitMoney(v) {
  const n = num(v), totalPaise = Math.round(Math.abs(n) * 100);
  return { neg: n < 0 && totalPaise > 0, rupees: Math.floor(totalPaise / 100), paise: totalPaise % 100 };
}
/** Invoice style: "Rupees Eight Thousand Eight Hundred and Fifty Paise Only" (paise are no longer dropped). */
export function rupeesInWords(v) {
  const { neg, rupees, paise } = splitMoney(v);
  const body = rupees === 0 && paise ? below100(paise) + " Paise" : "Rupees " + numberToWords(rupees) + (paise ? " and " + below100(paise) + " Paise" : "");
  return (neg ? "Minus " : "") + body + " Only";
}
/** Labour-report style: "Two Thousand Two Hundred Rupees and Fifty Paise Only". */
export function amountInWords(v) {
  const { neg, rupees, paise } = splitMoney(v);
  const body = rupees === 0 && paise ? below100(paise) + " Paise" : numberToWords(rupees) + " Rupees" + (paise ? " and " + below100(paise) + " Paise" : "");
  return (neg ? "Minus " : "") + body + " Only";
}

/* ---------- Icons (inline SVG, no external font/CDN) ---------- */
const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  invoice: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  quote: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  rupee: '<path d="M6 3h12M6 8h12M6 13h3a5 5 0 0 0 0-10M6 13l9 8"/>',
  trendUp: '<path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6"/>',
  trendDown: '<path d="m22 17-8.5-8.5-5 5L2 7M16 17h6v-6"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6"/>',
  hardhat: '<path d="M2 18h20v2H2zM4 18a8 8 0 0 1 16 0M12 6v4M8 7.5V10M16 7.5V10"/>',
};
export function icon(name, cls = "w-5 h-5") {
  return `<svg class="${cls} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}
/* Static markup uses <i data-icon="plus" data-cls="w-4 h-4"></i> */
export function hydrateIcons(root = document) {
  root.querySelectorAll("i[data-icon]").forEach((el) => {
    el.outerHTML = icon(el.dataset.icon, el.dataset.cls || "w-5 h-5");
  });
}

/* ---------- Logo (uses the project's real icon-1922.png; falls back to a
   neutral monogram only if that file is missing from the deployment) ---------- */
export const LOGO_SRC = "icon-1922.png";
export const LOGO_FALLBACK = "assets/logo-placeholder.svg";
document.addEventListener("error", (e) => {
  const t = e.target;
  if (t && t.tagName === "IMG" && t.dataset.logo !== undefined && !t.dataset.fb) { t.dataset.fb = "1"; t.src = LOGO_FALLBACK; }
}, true);
/* Static <img data-logo> tags can fail before this module runs, so re-check them. */
export function fixLogos(root = document) {
  root.querySelectorAll("img[data-logo]").forEach((i) => { if (!i.dataset.fb && i.complete && i.naturalWidth === 0) { i.dataset.fb = "1"; i.src = LOGO_FALLBACK; } });
}
export const logoImg = (cls = "w-10 h-10 rounded-xl") => `<img data-logo src="${LOGO_SRC}" alt="Kanifnath Construction logo" class="${cls} object-cover bg-white">`;

/* ---------- Toasts ---------- */
export function toast(message, type = "info", ms = 3200) {
  let box = document.getElementById("toasts");
  if (!box) {
    box = document.createElement("div");
    box.id = "toasts"; box.setAttribute("aria-live", "polite");
    box.className = "no-print fixed z-[80] bottom-4 inset-x-3 sm:inset-x-auto sm:right-4 sm:w-96 flex flex-col gap-2 pointer-events-none";
    document.body.appendChild(box);
  }
  const map = { success: ["check", "border-emerald-300 text-emerald-700"], error: ["alert", "border-red-300 text-red-700"], warning: ["alert", "border-amber-300 text-amber-700"], info: ["info", "border-line text-brand"] };
  const [ic, cls] = map[type] || map.info;
  const t = document.createElement("div");
  t.className = "toast " + cls.split(" ")[0]; t.setAttribute("role", type === "error" ? "alert" : "status");
  t.innerHTML = `<span class="${cls.split(" ")[1]} mt-0.5">${icon(ic, "w-5 h-5")}</span><span class="text-ink flex-1">${esc(message)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(6px)"; setTimeout(() => t.remove(), 300); }, ms);
}
export function errMsg(err) {
  const c = err && err.code ? String(err.code) : "";
  if (c.includes("permission-denied")) return "Permission denied by Firestore security rules. Check you are signed in with an authorised account.";
  if (c.includes("unavailable") || c.includes("network")) return "Network problem - please check your connection and try again.";
  return (err && err.message) || "Something went wrong.";
}

/* ---------- Modal (focus trap, Esc, overlay click, scroll lock) ---------- */
export function showModal({ title, html, wide = false, onClose } = {}) {
  const prev = document.activeElement;
  const id = "m" + Math.random().toString(36).slice(2, 7);
  const wrap = document.createElement("div");
  wrap.className = "no-print";
  wrap.innerHTML = `<div class="overlay" data-close></div>
    <div class="modal ${wide ? "max-w-3xl" : ""}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="flex items-start justify-between gap-3 mb-3">
        <h3 id="${id}" class="text-base font-bold text-ink">${esc(title || "")}</h3>
        <button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close dialog">${icon("x")}</button>
      </div>
      <div data-body>${html || ""}</div></div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  const dlg = wrap.querySelector(".modal");
  const close = () => { document.body.style.overflow = ""; document.removeEventListener("keydown", key, true); wrap.remove(); if (prev && prev.focus) prev.focus(); if (onClose) onClose(); };
  const focusables = () => [...dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')];
  function key(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    else if (e.key === "Tab") {
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener("keydown", key, true);
  wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  hydrateIcons(wrap);
  const f = focusables(); (f[1] || f[0] || dlg).focus();
  return { el: dlg, body: wrap.querySelector("[data-body]"), close };
}
export function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Confirm", danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = showModal({ title, html: `<p class="text-sm text-muted mb-5">${esc(message)}</p>
      <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" class="btn btn-outline" data-no>Cancel</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-yes>${esc(confirmText)}</button></div>`,
      onClose: () => { if (!done) { done = true; resolve(false); } } });
    m.el.querySelector("[data-yes]").onclick = () => { done = true; m.close(); resolve(true); };
    m.el.querySelector("[data-no]").onclick = () => m.close();
  });
}

/* ---------- PWA service worker (relative path => works on GitHub Pages sub-folders) ---------- */
export function registerSW() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
registerSW();

/* ---------- Auth guard ---------- */
let _user = null;
export const currentUser = () => _user;
export function requireAuth() {
  return new Promise((resolve) => {
    let first = true;
    onAuthStateChanged(auth, (user) => {
      if (!user) { location.replace("login.html"); return; }
      _user = user;
      if (first) { first = false; resolve(user); }
    });
  });
}
export async function logout() {
  const ok = await confirmDialog({ title: "Log out?", message: "You will need to sign in again to use Kanifnath ERP.", confirmText: "Log out", danger: true });
  if (!ok) return;
  try { await signOut(auth); } finally { location.href = "login.html"; }
}

/* ---------- App shell ---------- */
export const NAV = [
  { id: "dashboard", label: "Dashboard", href: "index.html", icon: "dashboard" },
  { id: "invoice", label: "Invoice", href: "Billing Calculator Page.html", icon: "invoice" },
  { id: "quotation", label: "Quotation", href: "quotation.html", icon: "quote" },
  { id: "labour", label: "Labour Management", href: "labour-management.html", icon: "users" },
  { id: "history", label: "History", href: "history.html", icon: "history" },
];
const navHtml = (active) => NAV.map((n) => `<a class="nav-link ${n.id === active ? "active" : ""}" href="${n.href}" ${n.id === active ? 'aria-current="page"' : ""}>${icon(n.icon)}<span>${n.label}</span></a>`).join("");

/** Wraps the page's <main id="page-content"> in the shared ERP shell. */
export function mountShell({ active, title, subtitle = "" }) {
  const content = document.getElementById("page-content");
  const dark = document.documentElement.classList.contains("dark");
  const email = (auth.currentUser && auth.currentUser.email) || "";
  const initials = (email.split("@")[0] || "U").slice(0, 2).toUpperCase();
  const shell = document.createElement("div");
  shell.id = "app-shell"; shell.className = "min-h-screen flex";
  shell.innerHTML = `
  <aside class="no-print sidebar hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col z-30" aria-label="Main navigation">
    <div class="side-brand border-b border-line flex items-center gap-3 px-4 h-16">${logoImg("w-10 h-10 rounded-xl border border-line bg-white")}
      <div class="min-w-0"><div class="font-extrabold text-brand tracking-wide leading-tight text-[13px]">KANIFNATH CONSTRUCTION</div><div class="text-[10px] font-semibold text-muted tracking-widest">ERP CONTROL PANEL</div></div></div>
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">${navHtml(active)}</nav>
    <div class="side-foot p-3 border-t border-line"><button type="button" class="nav-link w-full text-left hover:!text-red-600" data-logout>${icon("logout")}<span>Logout</span></button></div>
  </aside>
  <div id="drawer-overlay" class="no-print overlay hidden lg:hidden" style="z-index:40"></div>
  <aside id="drawer" class="no-print sidebar lg:hidden fixed inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col z-50 -translate-x-full transition-transform duration-300 ease-out" aria-label="Main navigation" aria-hidden="true">
    <div class="side-brand border-b border-line flex items-center justify-between gap-3 px-4 h-16"><div class="flex items-center gap-3 min-w-0">${logoImg("w-10 h-10 rounded-xl border border-line bg-white")}
      <div class="min-w-0"><div class="font-extrabold text-brand text-[13px] leading-tight">KANIFNATH CONSTRUCTION</div><div class="text-[10px] font-semibold text-muted tracking-widest">ERP CONTROL PANEL</div></div></div>
      <button type="button" class="btn btn-ghost btn-icon btn-sm" data-drawer-close aria-label="Close menu">${icon("x")}</button></div>
    <nav class="flex-1 overflow-y-auto p-3 space-y-1">${navHtml(active)}</nav>
    <div class="side-foot p-3 border-t border-line"><button type="button" class="nav-link w-full text-left hover:!text-red-600" data-logout>${icon("logout")}<span>Logout</span></button></div>
  </aside>
  <div class="flex-1 min-w-0 lg:pl-64 flex flex-col min-h-screen">
    <header class="no-print app-header sticky top-0 z-20 bg-surface/90 backdrop-blur">
      <div class="flex items-center gap-2 px-3 sm:px-6 h-16">
        <button type="button" id="menu-btn" class="btn btn-ghost btn-icon lg:hidden" aria-label="Open menu" aria-controls="drawer" aria-expanded="false">${icon("menu")}</button>
        ${active !== "dashboard" ? `<a href="index.html" class="btn btn-ghost btn-icon hidden sm:inline-flex" aria-label="Back to dashboard" title="Back to Dashboard">${icon("arrowLeft")}</a>` : ""}
        <div class="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" class="text-[11px] text-muted font-semibold flex items-center gap-1 truncate"><a href="index.html" class="hover:text-brand">Dashboard</a>${active !== "dashboard" ? `<span class="opacity-60">${icon("chevronRight", "w-3 h-3")}</span><span class="text-brand truncate">${esc(title)}</span>` : ""}</nav>
          <h1 class="text-base sm:text-lg font-bold leading-tight truncate">${esc(title)}</h1>
        </div>
        <div id="header-extra" class="flex items-center gap-2"></div>
        ${active !== "dashboard" ? `<a href="index.html" class="btn btn-outline btn-sm sm:hidden" aria-label="Dashboard">${icon("home", "w-4 h-4")}<span>Home</span></a>` : ""}
        <button type="button" id="theme-btn" class="btn btn-ghost btn-icon" aria-label="Toggle dark mode">${icon(dark ? "sun" : "moon")}</button>
        <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-line ml-1" title="${esc(email)}">
          <div class="w-9 h-9 rounded-full bg-brand text-white grid place-items-center text-xs font-bold">${esc(initials)}</div>
          <div class="hidden md:block leading-tight max-w-[140px]"><div class="text-xs font-bold truncate">${esc(email.split("@")[0] || "User")}</div><div class="text-[10px] text-muted">Signed in</div></div>
        </div>
      </div>
    </header>
    <div id="page-slot" class="flex-1 min-w-0"></div>
    <footer class="no-print px-6 py-4 text-center text-[11px] text-muted border-t border-line">
      <strong>KANIFNATH CONSTRUCTION ERP</strong> &middot; &copy; ${new Date().getFullYear()} All rights reserved</footer>
  </div>`;
  document.body.prepend(shell);
  fixLogos(document);
  const offBar = document.createElement("div");
  offBar.id = "offline-banner"; offBar.setAttribute("role", "status"); offBar.className = "no-print hidden text-center text-xs font-semibold px-3 py-2 bg-amber-100 text-amber-900";
  offBar.textContent = "You are offline. Data cannot be loaded or saved until the connection returns.";
  shell.querySelector("header").after(offBar);
  const syncOnline = () => offBar.classList.toggle("hidden", navigator.onLine !== false);
  window.addEventListener("online", syncOnline); window.addEventListener("offline", syncOnline); syncOnline();
  if (content) { content.classList.remove("hidden"); shell.querySelector("#page-slot").appendChild(content); content.classList.add("animate-fade-up"); }

  const drawer = shell.querySelector("#drawer"), ov = shell.querySelector("#drawer-overlay"), mb = shell.querySelector("#menu-btn");
  const setDrawer = (open) => {
    drawer.classList.toggle("-translate-x-full", !open); ov.classList.toggle("hidden", !open);
    drawer.setAttribute("aria-hidden", String(!open)); mb.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) drawer.querySelector("a,button").focus(); else mb.focus();
  };
  mb.addEventListener("click", () => setDrawer(true));
  ov.addEventListener("click", () => setDrawer(false));
  shell.querySelector("[data-drawer-close]").addEventListener("click", () => setDrawer(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.classList.contains("-translate-x-full")) setDrawer(false); });
  window.matchMedia("(min-width:1024px)").addEventListener("change", (m) => { if (m.matches) setDrawer(false); });
  shell.querySelector("#theme-btn").addEventListener("click", toggleTheme);
  shell.querySelectorAll("[data-logout]").forEach((b) => b.addEventListener("click", logout));
  hydrateIcons(shell);
  return shell;
}
