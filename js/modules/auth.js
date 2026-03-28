/**
 * auth.js — Authentication module
 *
 * Handles login, signup, guest mode, and session persistence.
 * Works with or without Firebase (CONFIG.USE_FIREBASE flag).
 *
 * After successful auth, calls App.onLogin() to boot the main app.
 */

const Auth = (() => {
  /* ── Internal helpers ───────────────────────────────────── */

  function _showForm(tab) {
    document.querySelectorAll(".auth-tab").forEach(t =>
      t.classList.toggle("active", t.dataset.tab === tab)
    );
    document.querySelectorAll(".auth-form").forEach(f =>
      f.classList.toggle("active", f.id === tab + "Form")
    );
  }

  function _validate(fields) {
    for (const [key, val] of Object.entries(fields)) {
      if (!val || !val.trim()) {
        UI.toast(`Please fill in the ${key} field.`, "warning");
        return false;
      }
    }
    return true;
  }

  /* ── Bind auth tab switching ────────────────────────────── */
  function _bindTabs() {
    // Tab buttons
    document.querySelectorAll(".auth-tab").forEach(btn => {
      btn.addEventListener("click", () => _showForm(btn.dataset.tab));
    });
    // Switch links inside forms
    document.querySelectorAll(".auth-switch a").forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        _showForm(link.dataset.tab);
      });
    });
  }

  /* ── Login ──────────────────────────────────────────────── */
  function _bindLogin() {
    const form = document.getElementById("loginForm");
    const btn  = document.getElementById("loginBtn");
    if (!form) return;

    form.addEventListener("submit", async e => {
      e.preventDefault();

      const email    = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;
      if (!_validate({ email, password })) return;

      UI.setLoading(btn, true);
      try {
        if (CONFIG.USE_FIREBASE) {
          const user = await Firebase.signIn(email, password);
          await App.onLogin(user);
        } else {
          // localStorage-only demo: treat email as "user"
          await App.onLogin({ uid: "local", email, displayName: email.split("@")[0] });
        }
      } catch (err) {
        UI.toast(_friendlyError(err), "error");
      } finally {
        UI.setLoading(btn, false);
      }
    });
  }

  /* ── Sign Up ────────────────────────────────────────────── */
  function _bindSignup() {
    const form = document.getElementById("signupForm");
    const btn  = document.getElementById("signupBtn");
    if (!form) return;

    form.addEventListener("submit", async e => {
      e.preventDefault();

      const name     = document.getElementById("signupName").value.trim();
      const email    = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      if (!_validate({ name, email, password })) return;
      if (password.length < 6) {
        UI.toast("Password must be at least 6 characters.", "warning");
        return;
      }

      UI.setLoading(btn, true);
      try {
        if (CONFIG.USE_FIREBASE) {
          const user = await Firebase.signUp(name, email, password);
          await App.onLogin(user);
        } else {
          await App.onLogin({ uid: "local", email, displayName: name });
        }
        UI.toast("Account created! Welcome 🎉", "success");
      } catch (err) {
        UI.toast(_friendlyError(err), "error");
      } finally {
        UI.setLoading(btn, false);
      }
    });
  }

  /* ── Guest / Demo ───────────────────────────────────────── */
  function _bindGuest() {
    const btn = document.getElementById("guestBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      // Seed some demo data if localStorage is empty
      if (!Store.getAll().length) _seedDemo();
      await App.onLogin({ uid: "guest", displayName: "Demo User", email: "demo@ledger.pro" });
      UI.toast("Running in demo mode — data stored locally.", "info");
    });
  }

  /* ── Logout ─────────────────────────────────────────────── */
  function _bindLogout() {
    const btn = document.getElementById("logoutBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      if (CONFIG.USE_FIREBASE) await Firebase.signOut().catch(console.error);
      App.onLogout();
    });
  }

  /* ── Firebase session persistence ──────────────────────── */
  function _bindFirebaseSession() {
    if (!CONFIG.USE_FIREBASE) return;
    Firebase.onAuthChange(user => {
      if (user) App.onLogin(user).catch(console.error);
    });
  }

  /* ── Error messages ─────────────────────────────────────── */
  function _friendlyError(err) {
    const code = err.code || "";
    const map  = {
      "auth/user-not-found":        "No account found for that email.",
      "auth/wrong-password":        "Incorrect password. Please try again.",
      "auth/email-already-in-use":  "An account with this email already exists.",
      "auth/invalid-email":         "Please enter a valid email address.",
      "auth/weak-password":         "Password is too weak.",
      "auth/too-many-requests":     "Too many attempts. Please try again later.",
      "auth/network-request-failed":"Network error. Check your connection.",
    };
    return map[code] || err.message || "Something went wrong.";
  }

  /* ── Demo seed data ─────────────────────────────────────── */
  function _seedDemo() {
    const now  = new Date();
    const date = (daysAgo) => {
      const d = new Date(now);
      d.setDate(now.getDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };
    const seed = [
      { id: Store.uid(), type: "income",  amount: 65000, category: "Salary",        date: date(25), description: "Monthly Salary — July" },
      { id: Store.uid(), type: "income",  amount: 12000, category: "Freelance",     date: date(18), description: "Client Project — Logo Design" },
      { id: Store.uid(), type: "expense", amount: 12500, category: "Bills",         date: date(22), description: "Rent — July" },
      { id: Store.uid(), type: "expense", amount: 2400,  category: "Food",          date: date(2),  description: "Swiggy orders" },
      { id: Store.uid(), type: "expense", amount: 899,   category: "Entertainment", date: date(5),  description: "Netflix subscription" },
      { id: Store.uid(), type: "expense", amount: 1500,  category: "Travel",        date: date(8),  description: "Uber rides" },
      { id: Store.uid(), type: "expense", amount: 3200,  category: "Shopping",      date: date(11), description: "Amazon — headphones" },
      { id: Store.uid(), type: "expense", amount: 600,   category: "Health",        date: date(14), description: "Pharmacy" },
      { id: Store.uid(), type: "income",  amount: 5000,  category: "Investment",    date: date(20), description: "Mutual Fund returns" },
      { id: Store.uid(), type: "expense", amount: 1200,  category: "Bills",         date: date(3),  description: "Electricity bill" },
      { id: Store.uid(), type: "expense", amount: 800,   category: "Food",          date: date(1),  description: "Lunch — office canteen" },
      { id: Store.uid(), type: "expense", amount: 4500,  category: "Shopping",      date: date(30), description: "Clothes — Myntra" },
    ];
    localStorage.setItem("ledger_tx", JSON.stringify(seed));
    localStorage.setItem("ledger_budget", "20000");
  }

  /* ── Public init ────────────────────────────────────────── */
  function init() {
    _bindTabs();
    _bindLogin();
    _bindSignup();
    _bindGuest();
    _bindLogout();
    _bindFirebaseSession();
  }

  return { init };
})();
