/**
 * store.js — Data layer
 *
 * Provides a unified CRUD interface regardless of storage backend
 * (localStorage for guests/demo, Firestore for authenticated users).
 *
 * All methods return the updated state so callers stay stateless.
 */

const Store = (() => {
  /* ── Private state ─────────────────────────────────────── */
  const LS_TX     = "ledger_tx";
  const LS_BUDGET = "ledger_budget";
  const LS_THEME  = "ledger_theme";

  let _uid    = null;   // Firebase UID when logged in
  let _useFS  = false;  // true = use Firestore

  /* ── Init ──────────────────────────────────────────────── */

  /**
   * Set the active user (after login/signup).
   * If uid is null, falls back to localStorage.
   * @param {string|null} uid
   */
  function setUser(uid) {
    _uid   = uid;
    _useFS = CONFIG.USE_FIREBASE && !!uid;
  }

  /* ── Transactions ──────────────────────────────────────── */

  /**
   * Get all transactions (localStorage).
   * @returns {Object[]}
   */
  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(LS_TX) || "[]");
    } catch {
      return [];
    }
  }

  /**
   * Persist the full array to localStorage.
   * @param {Object[]} txs
   */
  function _persist(txs) {
    localStorage.setItem(LS_TX, JSON.stringify(txs));
  }

  /**
   * Add a new transaction.
   * Syncs to Firestore if enabled.
   * @param {Object} tx
   * @returns {Object[]} updated list
   */
  async function addTx(tx) {
    const list = getAll();
    list.unshift(tx);
    _persist(list);
    if (_useFS && _uid) await Firebase.saveTx(_uid, tx).catch(console.error);
    return list;
  }

  /**
   * Update an existing transaction by id.
   * @param {Object} updated  — must include `id`
   * @returns {Object[]}
   */
  async function updateTx(updated) {
    const list = getAll().map(t => t.id === updated.id ? { ...t, ...updated } : t);
    _persist(list);
    if (_useFS && _uid) await Firebase.saveTx(_uid, updated).catch(console.error);
    return list;
  }

  /**
   * Delete a transaction by id.
   * @param {string} id
   * @returns {Object[]}
   */
  async function deleteTx(id) {
    const list = getAll().filter(t => t.id !== id);
    _persist(list);
    if (_useFS && _uid) await Firebase.deleteTx(_uid, id).catch(console.error);
    return list;
  }

  /**
   * Replace the full transaction list (used after Firestore sync).
   * @param {Object[]} txs
   */
  function replaceTxList(txs) {
    _persist(txs);
  }

  /* ── Budget ────────────────────────────────────────────── */

  /** @returns {number} */
  function getBudget() {
    return parseFloat(localStorage.getItem(LS_BUDGET) || "0");
  }

  /** @param {number} amount */
  async function setBudget(amount) {
    localStorage.setItem(LS_BUDGET, String(amount));
    if (_useFS && _uid) await Firebase.saveBudget(_uid, amount).catch(console.error);
  }

  function clearBudget() {
    localStorage.removeItem(LS_BUDGET);
  }

  /* ── Theme ─────────────────────────────────────────────── */

  /** @returns {'dark'|'light'} */
  function getTheme() {
    return localStorage.getItem(LS_THEME) || "dark";
  }

  /** @param {'dark'|'light'} t */
  function setTheme(t) {
    localStorage.setItem(LS_THEME, t);
    document.documentElement.setAttribute("data-theme", t);
  }

  /* ── Derived helpers ───────────────────────────────────── */

  /**
   * Returns transactions for the current calendar month.
   * @returns {Object[]}
   */
  function getCurrentMonthTx() {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return getAll().filter(t => t.date && t.date.startsWith(key));
  }

  /**
   * Returns summary totals.
   * @returns {{ income: number, expense: number, balance: number }}
   */
  function getTotals() {
    const all = getAll();
    const income  = all.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = all.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }

  /**
   * Generate a unique transaction ID.
   * @returns {string}
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * Today's date as YYYY-MM-DD string.
   * @returns {string}
   */
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  return {
    setUser,
    getAll, addTx, updateTx, deleteTx, replaceTxList,
    getBudget, setBudget, clearBudget,
    getTheme, setTheme,
    getCurrentMonthTx, getTotals,
    uid, today,
  };
})();
