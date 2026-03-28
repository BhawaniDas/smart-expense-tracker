/**
 * app.js — Main application controller
 *
 * Bootstraps all modules, wires up event listeners,
 * and coordinates state updates across the UI.
 *
 * Entry points:
 *   App.onLogin(user)   — called by Auth after successful sign-in
 *   App.onLogout()      — called by Auth on sign-out
 *   App.switchView(name)— navigate between dashboard/transactions/analytics/budget
 */

const App = (() => {
  /* ── App state ──────────────────────────────────────────── */
  let _currentUser   = null;
  let _currentView   = "dashboard";
  let _currentPage   = 1;
  let _editingTxId   = null;   // id of the transaction being edited (null = new)
  let _txType        = "expense";
  let _analyticsPeriod = 6;    // months shown in charts
  let _firestoreUnsub = null;  // Firestore listener cleanup

  /* ────────────────────────────────────────────────────────
     LOGIN / LOGOUT
  ──────────────────────────────────────────────────────── */

  /**
   * Called after a successful login or when Firebase restores a session.
   * @param {{ uid: string, displayName: string, email: string }} user
   */
  async function onLogin(user) {
    _currentUser = user;
    Store.setUser(user.uid);

    // If Firebase is enabled, subscribe to real-time updates
    if (CONFIG.USE_FIREBASE && user.uid !== "guest" && user.uid !== "local") {
      Firebase.init();
      _firestoreUnsub = Firebase.listenTx(user.uid, txs => {
        Store.replaceTxList(txs);
        refreshAll();
      });
      // Also load saved budget from Firestore
      const settings = await Firebase.fetchSettings(user.uid).catch(() => ({}));
      if (settings.budget) localStorage.setItem("ledger_budget", settings.budget);
    }

    // Update avatar
    const initial = (user.displayName || user.email || "?")[0].toUpperCase();
    const avatarEl = document.getElementById("userAvatar");
    if (avatarEl) avatarEl.querySelector("#userInitial").textContent = initial;

    // Reveal app, hide auth
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");

    refreshAll();
    UI.toast(`Welcome back, ${user.displayName || "there"} 👋`, "success");
  }

  /** Called on sign-out */
  function onLogout() {
    if (_firestoreUnsub) { _firestoreUnsub(); _firestoreUnsub = null; }
    _currentUser = null;
    Store.setUser(null);
    document.getElementById("appScreen").classList.add("hidden");
    document.getElementById("authScreen").classList.remove("hidden");
    UI.toast("Signed out.", "info");
  }

  /* ────────────────────────────────────────────────────────
     VIEW NAVIGATION
  ──────────────────────────────────────────────────────── */

  function switchView(name) {
    _currentView = name;
    _currentPage = 1;

    document.querySelectorAll(".view").forEach(v =>
      v.classList.toggle("active", v.id === `view-${name}`)
    );
    document.querySelectorAll(".nav-item").forEach(n =>
      n.classList.toggle("active", n.dataset.view === name)
    );

    // Lazy initialise charts only when analytics is opened
    if (name === "analytics") {
      Charts.renderAll(Store.getAll(), _analyticsPeriod);
    }
    if (name === "transactions") renderTransactions();
    if (name === "budget") renderBudgetView();

    // Close mobile sidebar
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("open");
  }

  /* ────────────────────────────────────────────────────────
     DASHBOARD
  ──────────────────────────────────────────────────────── */

  function renderDashboard() {
    const { income, expense, balance } = Store.getTotals();
    const all = Store.getAll();

    UI.animateValue("statBalance", balance);
    UI.animateValue("statIncome",  income);
    UI.animateValue("statExpense", expense);

    document.getElementById("statBalanceMeta").textContent =
      `${all.length} transaction${all.length !== 1 ? "s" : ""} total`;
    document.getElementById("statIncomeMeta").textContent =
      `${all.filter(t => t.type === "income").length} entries`;
    document.getElementById("statExpenseMeta").textContent =
      `${all.filter(t => t.type === "expense").length} entries`;

    // Insights
    _renderInsights();

    // Budget
    const monthExp = Store.getCurrentMonthTx()
      .filter(t => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const budget = Store.getBudget();

    UI.updateSidebarBudget(monthExp, budget);
    UI.updateBudgetAlert(monthExp, budget);

    // Recent (last 5)
    const recent = [...all]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    const list = document.getElementById("recentList");
    list.innerHTML = "";
    if (!recent.length) {
      list.appendChild(UI.emptyState("💸", "No transactions yet. Add your first one!"));
    } else {
      recent.forEach(t => list.appendChild(
        UI.txItem(t, { onEdit: openEditModal, onDelete: confirmDelete })
      ));
    }
  }

  function _renderInsights() {
    const month = Store.getCurrentMonthTx();
    const exp   = month.filter(t => t.type === "expense");
    const inc   = month.filter(t => t.type === "income");

    // Top category
    const catMap = {};
    exp.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    const top = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];
    document.getElementById("insTopCat").textContent    = top ? `${CONFIG.CAT_ICONS[top[0]] || "📦"} ${top[0]}` : "—";
    document.getElementById("insTopCatAmt").textContent = top ? UI.fmt(top[1]) : "";

    // Daily average
    const totalExp    = exp.reduce((s, t) => s + t.amount, 0);
    const daysElapsed = new Date().getDate();
    document.getElementById("insDailyAvg").textContent = UI.fmt(totalExp / Math.max(daysElapsed, 1));

    // Biggest expense
    const biggest = [...exp].sort((a, b) => b.amount - a.amount)[0];
    document.getElementById("insBiggest").textContent     = biggest ? UI.fmt(biggest.amount) : "—";
    document.getElementById("insBiggestName").textContent = biggest ? biggest.description.slice(0, 22) : "";

    // Savings rate
    const totalInc  = inc.reduce((s, t) => s + t.amount, 0);
    const savings   = totalInc > 0 ? Math.max(0, ((totalInc - totalExp) / totalInc) * 100) : 0;
    document.getElementById("insSavings").textContent = `${Math.round(savings)}%`;
  }

  /* ────────────────────────────────────────────────────────
     TRANSACTIONS
  ──────────────────────────────────────────────────────── */

  function _getFiltered() {
    const q    = document.getElementById("searchInput")?.value.toLowerCase() || "";
    const cat  = document.getElementById("filterCat")?.value || "";
    const type = document.getElementById("filterType")?.value || "";
    const from = document.getElementById("filterFrom")?.value || "";
    const to   = document.getElementById("filterTo")?.value || "";

    return Store.getAll()
      .filter(t => {
        if (q && !t.description.toLowerCase().includes(q) &&
            !t.category.toLowerCase().includes(q)) return false;
        if (cat  && t.category !== cat)  return false;
        if (type && t.type     !== type) return false;
        if (from && t.date < from)        return false;
        if (to   && t.date > to)          return false;
        return true;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function renderTransactions() {
    const filtered = _getFiltered();
    const total    = filtered.length;
    const start    = (_currentPage - 1) * CONFIG.TX_PER_PAGE;
    const end      = Math.min(start + CONFIG.TX_PER_PAGE, total);
    const page     = filtered.slice(start, end);

    const list = document.getElementById("allTxList");
    list.innerHTML = "";

    if (!page.length) {
      list.appendChild(UI.emptyState("🔍", total ? "" : "No transactions yet."));
    } else {
      page.forEach(t => list.appendChild(
        UI.txItem(t, { onEdit: openEditModal, onDelete: confirmDelete })
      ));
    }

    const pageInfo = document.getElementById("pageInfo");
    if (pageInfo) pageInfo.textContent = total
      ? `Showing ${start + 1}–${end} of ${total}`
      : "No results";

    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    if (prevBtn) prevBtn.disabled = _currentPage <= 1;
    if (nextBtn) nextBtn.disabled = end >= total;
  }

  /* ────────────────────────────────────────────────────────
     BUDGET VIEW
  ──────────────────────────────────────────────────────── */

  function renderBudgetView() {
    const budget   = Store.getBudget();
    const monthTx  = Store.getCurrentMonthTx();
    const monthExp = monthTx.filter(t => t.type === "expense");
    const totalExp = monthExp.reduce((s, t) => s + t.amount, 0);

    // Pre-fill input
    const input = document.getElementById("budgetInput");
    if (input && budget) input.value = budget;

    UI.updateBudgetGauge(totalExp, budget);

    // Category breakdown
    const catMap = {};
    monthExp.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const container = document.getElementById("catBreakdown");
    container.innerHTML = "";

    if (!sortedCats.length) {
      container.appendChild(UI.emptyState("📊", "No expenses this month yet."));
      return;
    }

    sortedCats.forEach(([cat, amt]) => {
      const pct   = totalExp > 0 ? (amt / totalExp) * 100 : 0;
      const color = CONFIG.CAT_COLORS[cat] || "#8888a8";
      const row   = document.createElement("div");
      row.className = "cat-row";
      row.innerHTML = `
        <div class="cat-row-icon">${CONFIG.CAT_ICONS[cat] || "📦"}</div>
        <div class="cat-row-name">${cat}</div>
        <div class="cat-row-bar-wrap">
          <div class="cat-row-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="cat-row-pct">${Math.round(pct)}%</div>
        <div class="cat-row-amt">${UI.fmt(amt)}</div>
      `;
      container.appendChild(row);
    });
  }

  /* ────────────────────────────────────────────────────────
     MODAL (Add / Edit)
  ──────────────────────────────────────────────────────── */

  function openAddModal() {
    _editingTxId = null;
    document.getElementById("modalHeading").textContent = "Add Transaction";
    document.getElementById("modalSave").textContent    = "Save Transaction";
    document.getElementById("txAmount").value   = "";
    document.getElementById("txDate").value     = Store.today();
    document.getElementById("txDesc").value     = "";
    document.getElementById("txCat").value      = "";
    document.getElementById("autoSuggest").classList.add("hidden");
    _setTxType("expense");
    _populateCatSelect("expense");
    document.getElementById("txModal").classList.add("open");
    document.getElementById("txAmount").focus();
  }

  function openEditModal(tx) {
    _editingTxId = tx.id;
    document.getElementById("modalHeading").textContent = "Edit Transaction";
    document.getElementById("modalSave").textContent    = "Update Transaction";
    _setTxType(tx.type);
    _populateCatSelect(tx.type);
    document.getElementById("txAmount").value = tx.amount;
    document.getElementById("txDate").value   = tx.date;
    document.getElementById("txDesc").value   = tx.description;
    document.getElementById("txCat").value    = tx.category;
    document.getElementById("autoSuggest").classList.add("hidden");
    document.getElementById("txModal").classList.add("open");
  }

  function closeModal() {
    document.getElementById("txModal").classList.remove("open");
    _editingTxId = null;
  }

  function _setTxType(type) {
    _txType = type;
    const expBtn = document.getElementById("btnTypeExpense");
    const incBtn = document.getElementById("btnTypeIncome");
    expBtn.classList.toggle("active", type === "expense");
    incBtn.classList.toggle("active", type === "income");
    _populateCatSelect(type);
  }

  function _populateCatSelect(type) {
    const sel  = document.getElementById("txCat");
    const cats = CONFIG.CATEGORIES[type] || [];
    sel.innerHTML = `<option value="">Select category…</option>` +
      cats.map(c => `<option value="${c.value}">${c.label}</option>`).join("");
  }

  /* ── Save transaction ───────────────────────────────────── */
  async function saveTx() {
    const amount = parseFloat(document.getElementById("txAmount").value);
    const date   = document.getElementById("txDate").value;
    const desc   = document.getElementById("txDesc").value.trim();
    const cat    = document.getElementById("txCat").value;

    // Validate
    if (!amount || amount <= 0) { UI.toast("Enter a valid amount.", "warning"); return; }
    if (!date)                   { UI.toast("Please select a date.", "warning"); return; }
    if (!cat)                    { UI.toast("Please choose a category.", "warning"); return; }

    const saveBtn = document.getElementById("modalSave");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      if (_editingTxId) {
        // Edit existing
        await Store.updateTx({ id: _editingTxId, type: _txType, amount, date, description: desc || cat, category: cat });
        UI.toast("Transaction updated.", "success");
      } else {
        // New transaction
        const tx = { id: Store.uid(), type: _txType, amount, date, description: desc || cat, category: cat };
        await Store.addTx(tx);
        UI.toast(`${_txType === "income" ? "Income" : "Expense"} added! ✅`, "success");
      }
      closeModal();
      refreshAll();
    } catch (err) {
      console.error(err);
      UI.toast("Failed to save. Please try again.", "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = _editingTxId ? "Update Transaction" : "Save Transaction";
    }
  }

  /* ── Delete ─────────────────────────────────────────────── */
  async function confirmDelete(id) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    try {
      await Store.deleteTx(id);
      UI.toast("Transaction deleted.", "info");
      refreshAll();
    } catch (err) {
      console.error(err);
      UI.toast("Failed to delete.", "error");
    }
  }

  /* ── Auto-suggest category ──────────────────────────────── */
  function _bindAutoSuggest() {
    const input  = document.getElementById("txDesc");
    const area   = document.getElementById("autoSuggest");
    if (!input || !area) return;

    input.addEventListener("input", () => {
      const val  = input.value.toLowerCase();
      const sugg = _detectCategory(val);
      if (sugg) {
        area.classList.remove("hidden");
        area.innerHTML = `
          <span class="suggest-badge" id="suggBadge">
            ✨ Suggested: ${CONFIG.CAT_ICONS[sugg] || ""} ${sugg}
          </span>`;
        document.getElementById("suggBadge")?.addEventListener("click", () => {
          document.getElementById("txCat").value = sugg;
          area.classList.add("hidden");
        });
      } else {
        area.classList.add("hidden");
      }
    });
  }

  function _detectCategory(desc) {
    for (const [cat, kws] of Object.entries(CONFIG.CAT_KEYWORDS)) {
      if (kws.some(k => desc.includes(k))) return cat;
    }
    return null;
  }

  /* ────────────────────────────────────────────────────────
     BUDGET
  ──────────────────────────────────────────────────────── */

  function _bindBudget() {
    document.getElementById("saveBudgetBtn")?.addEventListener("click", async () => {
      const v = parseFloat(document.getElementById("budgetInput").value);
      if (!v || v <= 0) { UI.toast("Enter a valid budget amount.", "warning"); return; }
      await Store.setBudget(v);
      renderBudgetView();
      renderDashboard();
      UI.toast(`Budget set to ${UI.fmt(v)} ✅`, "success");
    });

    document.getElementById("clearBudgetBtn")?.addEventListener("click", () => {
      Store.clearBudget();
      const input = document.getElementById("budgetInput");
      if (input) input.value = "";
      renderBudgetView();
      renderDashboard();
      UI.toast("Budget cleared.", "info");
    });
  }

  /* ────────────────────────────────────────────────────────
     FILTERS
  ──────────────────────────────────────────────────────── */

  function _bindFilters() {
    ["searchInput","filterCat","filterType","filterFrom","filterTo"].forEach(id => {
      document.getElementById(id)?.addEventListener("input", () => {
        _currentPage = 1;
        renderTransactions();
      });
    });
    document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
      ["searchInput","filterCat","filterType","filterFrom","filterTo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      _currentPage = 1;
      renderTransactions();
    });
  }

  /* ── Pagination ─────────────────────────────────────────── */
  function _bindPagination() {
    document.getElementById("prevPage")?.addEventListener("click", () => {
      if (_currentPage > 1) { _currentPage--; renderTransactions(); }
    });
    document.getElementById("nextPage")?.addEventListener("click", () => {
      _currentPage++;
      renderTransactions();
    });
  }

  /* ────────────────────────────────────────────────────────
     EXPORT CSV
  ──────────────────────────────────────────────────────── */

  function exportCSV() {
    const txs  = Store.getAll();
    if (!txs.length) { UI.toast("Nothing to export yet.", "warning"); return; }

    const rows = [["ID","Type","Amount","Category","Date","Description"]];
    txs.forEach(t =>
      rows.push([t.id, t.type, t.amount, t.category, t.date, `"${(t.description||"").replace(/"/g,'""')}"`])
    );
    const csv  = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ledger-pro-${Store.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast("CSV exported successfully.", "success");
  }

  /* ────────────────────────────────────────────────────────
     THEME TOGGLE
  ──────────────────────────────────────────────────────── */

  function _bindTheme() {
    const btn  = document.getElementById("themeToggle");
    const icon = document.getElementById("themeIcon");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const next   = isDark ? "light" : "dark";
      Store.setTheme(next);
      if (icon) icon.textContent = next === "dark" ? "🌙" : "☀️";
      // Refresh charts so they inherit new CSS colours
      if (_currentView === "analytics") Charts.renderAll(Store.getAll(), _analyticsPeriod);
    });
  }

  /* ────────────────────────────────────────────────────────
     ANALYTICS — PERIOD CHIPS
  ──────────────────────────────────────────────────────── */

  function _bindPeriodChips() {
    document.querySelectorAll(".period-chips .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".period-chips .chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        _analyticsPeriod = parseInt(chip.dataset.period);
        Charts.renderAll(Store.getAll(), _analyticsPeriod);
      });
    });
  }

  /* ────────────────────────────────────────────────────────
     MOBILE SIDEBAR
  ──────────────────────────────────────────────────────── */

  function _bindSidebar() {
    const sidebar  = document.getElementById("sidebar");
    const overlay  = document.getElementById("sidebarOverlay");
    const menuBtn  = document.getElementById("menuToggle");

    menuBtn?.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("open");
    });
    overlay?.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    });
  }

  /* ────────────────────────────────────────────────────────
     REFRESH ALL
  ──────────────────────────────────────────────────────── */

  /** Full re-render of current view + shared widgets */
  function refreshAll() {
    renderDashboard();
    if (_currentView === "transactions") renderTransactions();
    if (_currentView === "analytics")    Charts.renderAll(Store.getAll(), _analyticsPeriod);
    if (_currentView === "budget")       renderBudgetView();
  }

  /* ────────────────────────────────────────────────────────
     BOOTSTRAP
  ──────────────────────────────────────────────────────── */

  function _bindNav() {
    document.querySelectorAll(".nav-item[data-view]").forEach(item => {
      item.addEventListener("click", e => {
        e.preventDefault();
        switchView(item.dataset.view);
      });
    });
  }

  function _bindModal() {
    // Open
    document.getElementById("headerAddBtn")?.addEventListener("click", openAddModal);
    document.getElementById("txAddBtn")?.addEventListener("click", openAddModal);

    // Close
    document.getElementById("modalClose")?.addEventListener("click", closeModal);
    document.getElementById("modalCancel")?.addEventListener("click", closeModal);
    document.getElementById("txModal")?.addEventListener("click", e => {
      if (e.target === document.getElementById("txModal")) closeModal();
    });

    // Type toggle
    document.getElementById("btnTypeExpense")?.addEventListener("click", () => _setTxType("expense"));
    document.getElementById("btnTypeIncome")?.addEventListener("click",  () => _setTxType("income"));

    // Save
    document.getElementById("modalSave")?.addEventListener("click", saveTx);

    // Keyboard
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closeModal();
    });
  }

  function _bindExport() {
    document.getElementById("exportBtn")?.addEventListener("click", exportCSV);
    document.getElementById("sidebarExport")?.addEventListener("click", e => {
      e.preventDefault();
      exportCSV();
    });
  }

  /** Application entry point — called once on page load */
  function init() {
    // Apply saved theme immediately
    const theme = Store.getTheme();
    Store.setTheme(theme);
    document.getElementById("themeIcon").textContent = theme === "dark" ? "🌙" : "☀️";

    // Initialise Firebase (no-op if disabled)
    Firebase.init();

    // Wire up all event listeners
    _bindNav();
    _bindModal();
    _bindAutoSuggest();
    _bindFilters();
    _bindPagination();
    _bindBudget();
    _bindExport();
    _bindTheme();
    _bindPeriodChips();
    _bindSidebar();

    // Initialise Auth module (handles session restore + form events)
    Auth.init();
  }

  return { init, onLogin, onLogout, switchView, refreshAll };
})();

/* ── Boot the app ─────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", App.init);
