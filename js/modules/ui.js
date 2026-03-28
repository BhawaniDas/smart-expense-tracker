/**
 * ui.js — UI helpers, toast system, DOM component renderers
 *
 * No business logic here. Only rendering and user-feedback utilities.
 */

const UI = (() => {
  /* ── Formatting ────────────────────────────────────────── */

  /**
   * Format a number as Indian Rupee string.
   * @param {number} n
   * @returns {string}  e.g. "₹1,23,456.78"
   */
  function fmt(n) {
    return "₹" + Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Format a date string for display.
   * @param {string} dateStr  YYYY-MM-DD
   * @returns {string}
   */
  function fmtDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  /* ── Toast Notifications ───────────────────────────────── */

  const TOAST_ICONS = {
    success: "✅", error: "❌", info: "ℹ️", warning: "⚠️",
  };

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {'success'|'error'|'info'|'warning'} [type='info']
   * @param {number} [duration=3000]
   */
  function toast(message, type = "info", duration = 3000) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type]}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add("removing");
      el.addEventListener("animationend", () => el.remove());
    }, duration);
  }

  /* ── Loading ────────────────────────────────────────────── */

  /**
   * Set loading state on a button.
   * @param {HTMLButtonElement} btn
   * @param {boolean} loading
   */
  function setLoading(btn, loading) {
    const textEl   = btn.querySelector(".btn-text");
    const loaderEl = btn.querySelector(".btn-loader");
    btn.disabled   = loading;
    if (textEl)   textEl.style.opacity   = loading ? "0.5" : "1";
    if (loaderEl) loaderEl.classList.toggle("hidden", !loading);
  }

  /* ── Empty State ────────────────────────────────────────── */

  /**
   * Render an empty state placeholder.
   * @param {string} icon
   * @param {string} text
   * @returns {HTMLElement}
   */
  function emptyState(icon, text) {
    const div = document.createElement("div");
    div.className = "empty-state";
    div.innerHTML = `<div class="empty-state-icon">${icon}</div><div class="empty-state-text">${text}</div>`;
    return div;
  }

  /* ── Transaction Item ───────────────────────────────────── */

  /**
   * Build and return a transaction list item element.
   * @param {Object} tx
   * @param {{ onEdit: Function, onDelete: Function }} handlers
   * @returns {HTMLElement}
   */
  function txItem(tx, { onEdit, onDelete }) {
    const catClass = `cat-${tx.category.toLowerCase()}`;
    const icon     = CONFIG.CAT_ICONS[tx.category] || "📦";
    const isInc    = tx.type === "income";

    const el = document.createElement("div");
    el.className   = "tx-item";
    el.dataset.id  = tx.id;

    el.innerHTML = `
      <div class="tx-cat-icon ${catClass}">${icon}</div>
      <div class="tx-info">
        <div class="tx-desc">${_escHtml(tx.description || tx.category)}</div>
        <div class="tx-sub">
          <span>${tx.category}</span>
          <span>${fmtDate(tx.date)}</span>
        </div>
      </div>
      <div class="tx-amount ${isInc ? "inc" : "exp"}">
        ${isInc ? "+" : "−"}${fmt(tx.amount)}
      </div>
      <div class="tx-actions">
        <button class="tx-action-btn edit" title="Edit" aria-label="Edit transaction">✏️</button>
        <button class="tx-action-btn del"  title="Delete" aria-label="Delete transaction">🗑</button>
      </div>
    `;

    el.querySelector(".edit").addEventListener("click", e => { e.stopPropagation(); onEdit(tx); });
    el.querySelector(".del").addEventListener("click",  e => { e.stopPropagation(); onDelete(tx.id); });

    return el;
  }

  /* ── Budget Bar (sidebar mini + hero) ──────────────────── */

  /**
   * Update the sidebar budget mini-bar.
   * @param {number} spent
   * @param {number} budget
   */
  function updateSidebarBudget(spent, budget) {
    const fill = document.getElementById("sbmFill");
    const nums = document.getElementById("sbmNums");
    if (!budget) {
      fill.style.width = "0%";
      nums.textContent = "No budget set";
      return;
    }
    const pct = Math.min((spent / budget) * 100, 100);
    fill.style.width  = pct + "%";
    fill.style.background = pct >= 100
      ? "var(--red)"
      : pct >= 80 ? "var(--yellow)"
      : "linear-gradient(90deg, var(--accent), var(--cyan))";
    nums.textContent = `${fmt(spent)} / ${fmt(budget)}`;
  }

  /**
   * Update the budget hero gauge (SVG arc).
   * @param {number} spent
   * @param {number} budget
   */
  function updateBudgetGauge(spent, budget) {
    const gaugeFill = document.getElementById("gaugeFill");
    const gaugePct  = document.getElementById("gaugePct");
    if (!gaugeFill || !gaugePct) return;

    const ARC_LENGTH = 126; // half-circle at r=40 → Math.PI * 40 ≈ 125.7
    const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
    const filled = (pct / 100) * ARC_LENGTH;

    gaugeFill.setAttribute("stroke-dasharray", `${filled} ${ARC_LENGTH}`);
    gaugeFill.className.baseVal = "gauge-fill" + (pct >= 100 ? " over" : pct >= 80 ? " warn" : "");
    gaugePct.textContent = Math.round(pct) + "%";
  }

  /* ── Budget Alert Banner ────────────────────────────────── */

  /**
   * Show/hide the budget alert banner on the dashboard.
   * @param {number} spent
   * @param {number} budget
   */
  function updateBudgetAlert(spent, budget) {
    const el = document.getElementById("budgetAlert");
    if (!el) return;

    if (!budget || spent < budget * 0.8) {
      el.classList.add("hidden");
      return;
    }

    if (spent >= budget) {
      el.className = "budget-alert over";
      el.innerHTML = `🚨 You've exceeded your monthly budget! Over by ${fmt(spent - budget)}`;
    } else {
      el.className = "budget-alert warn";
      el.innerHTML = `⚠️ Heads up — you've used ${Math.round((spent/budget)*100)}% of your budget. ${fmt(budget - spent)} remaining.`;
    }
    el.classList.remove("hidden");
  }

  /* ── Stat Cards ─────────────────────────────────────────── */

  /**
   * Animate a stat card value with a count-up effect.
   * @param {string} elementId
   * @param {number} target
   * @param {boolean} [isCurrency=true]
   */
  function animateValue(elementId, target, isCurrency = true) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const duration = 600;
    const start    = Date.now();
    const from     = parseFloat(el.dataset.value || "0");

    function step() {
      const elapsed  = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current  = from + (target - from) * eased;

      el.textContent = isCurrency ? fmt(current) : Math.round(current).toLocaleString("en-IN");
      el.dataset.value = current;

      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = isCurrency ? fmt(target) : target.toLocaleString("en-IN");
    }
    requestAnimationFrame(step);
  }

  /* ── Internal ───────────────────────────────────────────── */

  /** Escape HTML to prevent XSS */
  function _escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    fmt, fmtDate, toast, setLoading, emptyState,
    txItem, updateSidebarBudget, updateBudgetGauge,
    updateBudgetAlert, animateValue,
  };
})();
