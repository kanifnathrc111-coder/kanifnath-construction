/* ==========================================================================
   data.js - single place for Firestore subscriptions + backup/restore.
   Collections used by the app (unchanged from the original project):
   documents, labours, labourExpenses, labourPayments, labourWorks, counters
   ========================================================================== */
import { db, collection, onSnapshot, doc, setDoc, addDoc, runTransaction } from "./firebase.js";

export const COLLECTIONS = {
  documents: "documents", labours: "labours", expenses: "labourExpenses",
  payments: "labourPayments", works: "labourWorks",
};

/** Firestore doc -> plain object. The Firestore doc id always wins over any stale `id` field. */
export const mapDoc = (d) => ({ ...d.data(), id: d.id });

/** createdAt may be a Firestore Timestamp, ISO string or number. */
export function tsMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const t = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Subscribe to several collections at once.
 * @param keys  e.g. ["documents","labours"] (keys of COLLECTIONS)
 * @param onData  (state, readyKeys) - state[key] is an array (empty until first snapshot)
 * @param onError (err, key)
 * @returns unsubscribe()
 */
export function subscribe(keys, onData, onError) {
  const state = {}; const ready = new Set(); const unsubs = [];
  keys.forEach((k) => {
    state[k] = [];
    unsubs.push(onSnapshot(collection(db, COLLECTIONS[k]),
      (snap) => { state[k] = snap.docs.map(mapDoc); ready.add(k); onData(state, ready); },
      (err) => { console.error("Firestore listener failed:", k, err); if (onError) onError(err, k); }));
  });
  return () => unsubs.forEach((u) => u());
}

/* ---------- Backup / restore ---------- */
export function buildBackup(state) {
  return {
    app: "Kanifnath Construction ERP", exportedAt: new Date().toISOString(),
    documents: state.documents || [], labours: state.labours || [],
    labourExpenses: state.expenses || [], labourPayments: state.payments || [], labourWorks: state.works || [],
  };
}
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;   // refuse files larger than 10 MB
export const MAX_BACKUP_RECORDS = 20000;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const COL_LABEL = { documents: "invoices/quotations", labours: "labour profiles", labourExpenses: "expenses", labourPayments: "payments", labourWorks: "work entries" };
export const colLabel = (k) => COL_LABEL[k] || k;

/** Drops prototype-pollution keys at every depth; returns a clean deep copy of plain JSON data. */
function scrub(v, depth = 0) {
  if (depth > 12) throw new Error("Backup is nested too deeply");
  if (Array.isArray(v)) return v.map((x) => scrub(x, depth + 1));
  if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) if (!FORBIDDEN_KEYS.has(k)) o[k] = scrub(x, depth + 1); return o; }
  return v;
}

/**
 * Strict validation of a parsed backup. Returns { clean, counts, warnings } or throws Error(<user-readable reason>).
 * Accepts both the dashboard backup keys and the labour-page keys (expenses/payments/works).
 * Rejects: non-objects, > MAX_BACKUP_RECORDS records, records that are not plain objects, invalid or duplicate ids,
 * documents whose type is not Invoice/Quotation, and child records without a labourId.
 */
export function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Not a backup file");
  const arr = (...names) => { for (const n of names) if (Array.isArray(data[n])) return data[n]; return []; };
  const raw = {
    documents: arr("documents"), labours: arr("labours"),
    labourExpenses: arr("labourExpenses", "expenses"), labourPayments: arr("labourPayments", "payments"), labourWorks: arr("labourWorks", "works"),
  };
  const total = Object.values(raw).reduce((s, a) => s + a.length, 0);
  if (!total) throw new Error("Backup file contains no records");
  if (total > MAX_BACKUP_RECORDS) throw new Error(`Backup has ${total} records; the limit is ${MAX_BACKUP_RECORDS}`);
  const clean = {}, warnings = []; let noId = 0;
  for (const [col, list] of Object.entries(raw)) {
    const seen = new Set(); clean[col] = [];
    list.forEach((r, i) => {
      if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error(`${colLabel(col)} #${i + 1} is not a record`);
      const rec = scrub(r);
      if (rec.id !== undefined && rec.id !== null && rec.id !== "") {
        const id = String(rec.id);
        if (id.length > 150 || /[\/]/.test(id) || id === "." || id === "..") throw new Error(`${colLabel(col)} #${i + 1} has an invalid id`);
        if (seen.has(id)) throw new Error(`Duplicate id "${id}" in ${colLabel(col)}`);
        seen.add(id); rec.id = id;
      } else noId++;
      if (col === "documents" && !["Invoice", "Quotation"].includes(rec.type)) throw new Error(`Document #${i + 1} has type "${String(rec.type)}" (must be Invoice or Quotation)`);
      if (["labourExpenses", "labourPayments", "labourWorks"].includes(col) && !rec.labourId) throw new Error(`${colLabel(col)} #${i + 1} has no labourId`);
      clean[col].push(rec);
    });
  }
  if (noId) warnings.push(`${noId} record(s) have no id (old backup format) and will be added as NEW records; restoring the same file twice would add them twice.`);
  const counts = Object.fromEntries(Object.entries(clean).map(([k, v]) => [k, v.length]));
  return { clean, counts, warnings };
}
/** Kept for existing callers: normalised collections only. */
export function normaliseBackup(data) { return validateBackup(data).clean; }

/** What would a restore do right now? new = id not present, overwrite = id already exists (backup copy wins). */
export function previewRestore(clean, state) {
  const have = { documents: state.documents, labours: state.labours, labourExpenses: state.expenses, labourPayments: state.payments, labourWorks: state.works };
  const out = {};
  for (const [col, list] of Object.entries(clean)) {
    if (have[col] === undefined) { out[col] = { total: list.length, overwrite: 0, create: 0, unknown: true }; continue; }   // this page does not load that collection
    const ids = new Set(have[col].map((r) => r.id));
    out[col] = { total: list.length, overwrite: list.filter((r) => r.id && ids.has(r.id)).length, create: list.filter((r) => !r.id || !ids.has(r.id)).length };
  }
  return out;
}

const seqOf = (n) => { const m = String(n || "").match(/(\d+)\s*$/); return m ? parseInt(m[1], 10) : 0; };
/** Highest invoice / quotation sequence present in the restored documents (so numbering never restarts below it). */
export function counterFloors(documents) {
  const f = { invoice: 0, quotation: 0 };
  documents.forEach((d) => { const k = d.type === "Invoice" ? "invoice" : "quotation"; f[k] = Math.max(f[k], seqOf(d.number)); });
  return f;
}

/**
 * Idempotent restore: every record with an id is written back to the SAME document id (setDoc),
 * so restoring twice never creates duplicates. Records without an id (very old backups) get a new id.
 * Existing documents with the same id are overwritten by the backup copy; nothing is ever deleted.
 * A failed write does not abort the run: it is collected and returned, so the caller can say exactly what is missing
 * (re-running the same restore is safe and completes the missing records).
 * Counters are only ever RAISED (never lowered) to the highest restored number, so new invoices cannot reuse a number.
 * @returns {{written:number, failed:{col:string,id:string,error:string}[], total:number, counters:Object}}
 */
export async function restoreBackup(data, onProgress) {
  const { clean } = validateBackup(data);
  const jobs = [];
  Object.entries(clean).forEach(([col, records]) => records.forEach((r) => jobs.push([col, r])));
  let done = 0; const failed = [];
  for (let i = 0; i < jobs.length; i += 15) {
    await Promise.all(jobs.slice(i, i + 15).map(async ([col, record]) => {
      const { id, ...rest } = record;
      try {
        if (id) await setDoc(doc(db, col, String(id)), rest);
        else await addDoc(collection(db, col), rest);
        done++;
      } catch (err) { failed.push({ col, id: String(id || "(new)"), error: (err && (err.code || err.message)) || "error" }); }
    }));
    if (onProgress) onProgress(done + failed.length, jobs.length);
  }
  const counters = {};
  if (!failed.length) {
    const floors = counterFloors(clean.documents);
    for (const [name, floor] of Object.entries(floors)) {
      if (!floor) continue;
      try {
        await runTransaction(db, async (tx) => {
          const ref = doc(db, "counters", name); const snap = await tx.get(ref);
          const cur = snap.exists() ? (Number(snap.data().value) || 0) : 0;
          if (floor > cur) { tx.set(ref, { value: floor }); counters[name] = floor; }
        });
      } catch (err) { failed.push({ col: "counters", id: name, error: (err && (err.code || err.message)) || "error" }); }
    }
  }
  return { written: done, failed, total: jobs.length, counters };
}
export const backupCounts = (data) => validateBackup(data).counts;

/**
 * Shared restore workflow for every page: validate -> preview -> explicit confirmation -> restore -> summary.
 * ui = { confirmDialog, toast, errMsg }.  Resolves to the restore result, or null when cancelled / rejected.
 */
export async function restoreFromFile(file, state, ui, onProgress) {
  const { confirmDialog, toast, errMsg } = ui;
  if (file.size > MAX_BACKUP_BYTES) { toast(`Invalid backup file: larger than ${Math.round(MAX_BACKUP_BYTES / 1048576)} MB`, "error", 6000); return null; }
  let text; try { text = await file.text(); } catch (err) { toast("Could not read the file: " + errMsg(err), "error"); return null; }
  let data, v;
  try { data = JSON.parse(text); v = validateBackup(data); } catch (err) { toast("Invalid backup file: " + err.message, "error", 6000); return null; }
  const pv = previewRestore(v.clean, state);
  const total = Object.values(v.counts).reduce((a, b) => a + b, 0), over = Object.values(pv).reduce((a, b) => a + b.overwrite, 0), fresh = Object.values(pv).reduce((a, b) => a + b.create, 0), unk = Object.values(pv).some((x) => x.unknown);
  const lines = Object.entries(pv).filter(([, x]) => x.total).map(([k, x]) => (x.unknown ? `${x.total} ${colLabel(k)} (existing copies not checked on this page - same ids WILL be overwritten)` : `${x.total} ${colLabel(k)} (${x.create} new, ${x.overwrite} overwrite)`)).join("; ");
  const ok = await confirmDialog({ title: "Restore backup?", confirmText: "Restore", message:
    `This backup contains ${total} records: ${lines}. ${unk ? "" : `${over} existing record(s) with the same id WILL BE OVERWRITTEN by the backup copy; ${fresh} will be created. `}Nothing is deleted. `
    + `Records return to their ORIGINAL ids, so running the same restore again creates no duplicates. Invoice/quotation numbering is only moved forward, never back. `
    + `Tip: download a fresh backup first so you can undo this. ${v.warnings.join(" ")}` });
  if (!ok) return null;
  toast("Restoring " + total + " records...", "info", 2000);
  let res;
  try { res = await restoreBackup(data, onProgress); } catch (err) { toast("Restore failed: " + errMsg(err), "error", 8000); return null; }
  if (res.failed.length) toast(`Restore incomplete: ${res.written} of ${res.total} written, ${res.failed.length} failed (${res.failed.slice(0, 3).map((f) => f.col + "/" + f.id + ": " + f.error).join("; ")}). Running the same restore again is safe and will finish the rest.`, "error", 12000);
  else toast(`Restored ${res.written} records.` + (Object.keys(res.counters).length ? " Numbering counters moved forward." : ""), "success", 5000);
  return res;
}
