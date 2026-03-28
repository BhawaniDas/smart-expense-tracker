/**
 * charts.js — Chart.js wrapper module
 *
 * Manages creation and destruction of all four analytics charts.
 * Reads theme CSS variables so charts always match dark/light mode.
 */

const Charts = (() => {
  /* ── Active chart instances ─────────────────────────────── */
  let _monthly = null;
  let _cat     = null;
  let _income  = null;
  let _daily   = null;

  /* ── Theme tokens ───────────────────────────────────────── */
  function _theme() {
    const cs    = getComputedStyle(document.documentElement);
    const get   = v => cs.getPropertyValue(v).trim();
    return {
      text:    get("--text-secondary"),
      grid:    get("--glass-border"),
      tooltip: { bg: get("--bg-float"), text: get("--text-primary") },
    };
  }

  /* ── Shared defaults ────────────────────────────────────── */
  function _baseOpts(tk) {
    return {
      responsive: true,
      animation:  { duration: 600, easing: "easeOutQuart" },
      plugins: {
        legend: {
          labels: {
            color:     tk.text,
            boxWidth:  12,
            padding:   14,
            font:      { family: "'Bricolage Grotesque', sans-serif", size: 11 },
          },
        },
        tooltip: {
          backgroundColor: tk.tooltip.bg,
          titleColor:      tk.tooltip.text,
          bodyColor:       tk.text,
          borderColor:     "rgba(255,255,255,0.08)",
          borderWidth:     1,
          padding:         10,
          cornerRadius:    8,
          callbacks: {
            label: ctx => ` ₹${ctx.parsed.y !== undefined ? ctx.parsed.y.toLocaleString("en-IN") : ctx.parsed.toLocaleString("en-IN")}`,
          },
        },
      },
      scales: {
        x: {
          grid:  { color: tk.grid },
          ticks: { color: tk.text, font: { family: "'JetBrains Mono', monospace", size: 10 } },
        },
        y: {
          grid:  { color: tk.grid },
          ticks: {
            color: tk.text,
            font:  { family: "'JetBrains Mono', monospace", size: 10 },
            callback: v => "₹" + v.toLocaleString("en-IN"),
          },
          beginAtZero: true,
        },
      },
    };
  }

  function _doughnutOpts(tk) {
    return {
      responsive: true,
      cutout:     "60%",
      animation:  { duration: 700, easing: "easeOutQuart" },
      plugins: {
        legend: {
          position: "right",
          labels:   { color: tk.text, boxWidth: 12, padding: 12, font: { family: "'Bricolage Grotesque', sans-serif", size: 11 } },
        },
        tooltip: {
          backgroundColor: tk.tooltip.bg,
          titleColor:      tk.tooltip.text,
          bodyColor:       tk.text,
          borderColor:     "rgba(255,255,255,0.08)",
          borderWidth:     1,
          padding:         10,
          cornerRadius:    8,
          callbacks: {
            label: ctx => ` ₹${ctx.parsed.toLocaleString("en-IN")}`,
          },
        },
      },
    };
  }

  /* ── Destroy all ────────────────────────────────────────── */
  function destroyAll() {
    [_monthly, _cat, _income, _daily].forEach(c => c && c.destroy());
    _monthly = _cat = _income = _daily = null;
  }

  /* ── Monthly Bar Chart ──────────────────────────────────── */
  /**
   * @param {Object[]} transactions
   * @param {number}   [months=6]  how many months back to show
   */
  function renderMonthly(transactions, months = 6) {
    const canvas = document.getElementById("chartMonthly");
    if (!canvas) return;
    if (_monthly) _monthly.destroy();

    // Aggregate by month key
    const map = {};
    transactions.forEach(t => {
      const mk = t.date.slice(0, 7);
      if (!map[mk]) map[mk] = { inc: 0, exp: 0 };
      t.type === "income" ? (map[mk].inc += t.amount) : (map[mk].exp += t.amount);
    });

    const keys    = Object.keys(map).sort().slice(-months);
    const labels  = keys.map(k => {
      const [y, m] = k.split("-");
      return new Date(+y, +m - 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    });

    const tk = _theme();
    _monthly = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Income",
            data:  keys.map(k => map[k].inc),
            backgroundColor: "rgba(62,207,142,0.75)",
            borderRadius:    6,
            borderSkipped:   false,
          },
          {
            label: "Expenses",
            data:  keys.map(k => map[k].exp),
            backgroundColor: "rgba(244,96,96,0.75)",
            borderRadius:    6,
            borderSkipped:   false,
          },
        ],
      },
      options: {
        ..._baseOpts(tk),
        interaction: { mode: "index" },
      },
    });
  }

  /* ── Category Doughnut ──────────────────────────────────── */
  function renderCatChart(transactions) {
    const canvas = document.getElementById("chartCat");
    if (!canvas) return;
    if (_cat) _cat.destroy();

    const map = {};
    transactions
      .filter(t => t.type === "expense")
      .forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });

    const keys   = Object.keys(map);
    const tk     = _theme();

    _cat = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels:   keys,
        datasets: [{
          data:            keys.map(k => map[k]),
          backgroundColor: keys.map(k => CONFIG.CAT_COLORS[k] || "#8888a8"),
          borderWidth:     2,
          borderColor:     "transparent",
          hoverBorderColor: keys.map(k => CONFIG.CAT_COLORS[k] || "#8888a8"),
        }],
      },
      options: _doughnutOpts(tk),
    });
  }

  /* ── Income Doughnut ────────────────────────────────────── */
  function renderIncomeChart(transactions) {
    const canvas = document.getElementById("chartIncome");
    if (!canvas) return;
    if (_income) _income.destroy();

    const map = {};
    transactions
      .filter(t => t.type === "income")
      .forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });

    const keys = Object.keys(map);
    const tk   = _theme();

    _income = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels:   keys,
        datasets: [{
          data:            keys.map(k => map[k]),
          backgroundColor: keys.map(k => CONFIG.CAT_COLORS[k] || "#8888a8"),
          borderWidth:     2,
          borderColor:     "transparent",
          hoverBorderColor: keys.map(k => CONFIG.CAT_COLORS[k] || "#8888a8"),
        }],
      },
      options: _doughnutOpts(tk),
    });
  }

  /* ── Daily Line Chart (last 30 days) ───────────────────── */
  function renderDailyChart(transactions) {
    const canvas = document.getElementById("chartDaily");
    if (!canvas) return;
    if (_daily) _daily.destroy();

    // Build a map of date → total expense
    const daily = {};
    const now   = new Date();
    for (let i = 29; i >= 0; i--) {
      const d   = new Date(now);
      d.setDate(now.getDate() - i);
      daily[d.toISOString().slice(0, 10)] = 0;
    }
    transactions
      .filter(t => t.type === "expense" && daily[t.date] !== undefined)
      .forEach(t => { daily[t.date] += t.amount; });

    const keys   = Object.keys(daily);
    const labels = keys.map(k => {
      const d = new Date(k);
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    });
    const tk = _theme();

    _daily = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label:           "Daily Spend",
          data:            keys.map(k => daily[k]),
          fill:            true,
          borderColor:     "#5b8dee",
          backgroundColor: "rgba(91,141,238,0.12)",
          tension:         0.45,
          pointRadius:     3,
          pointHoverRadius: 5,
          pointBackgroundColor: "#5b8dee",
          borderWidth:     2,
        }],
      },
      options: {
        ..._baseOpts(tk),
        plugins: {
          ..._baseOpts(tk).plugins,
          legend: { display: false },
        },
        scales: {
          ..._baseOpts(tk).scales,
          x: { ..._baseOpts(tk).scales.x, grid: { display: false } },
        },
      },
    });
  }

  /* ── Render all (analytics view) ───────────────────────── */
  /**
   * @param {Object[]} transactions
   * @param {number}   periodMonths
   */
  function renderAll(transactions, periodMonths = 6) {
    destroyAll();
    renderMonthly(transactions, periodMonths);
    renderCatChart(transactions);
    renderIncomeChart(transactions);
    renderDailyChart(transactions);
  }

  return { renderAll, destroyAll };
})();
