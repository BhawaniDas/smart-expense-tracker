/**
 * firebase.js — Firebase Auth + Firestore adapter
 *
 * When CONFIG.USE_FIREBASE = false, every method is a no-op that
 * returns null, and the app falls back to localStorage (Store).
 *
 * When USE_FIREBASE = true, this module initialises Firebase,
 * provides auth helpers, and syncs transactions to Firestore.
 */

const Firebase = (() => {
  let _app  = null;
  let _auth = null;
  let _db   = null;

  /**
   * Initialise Firebase if enabled.
   * Safe to call multiple times.
   */
  function init() {
    if (!CONFIG.USE_FIREBASE) return;
    if (_app) return; // already initialised

    try {
      _app  = firebase.initializeApp(CONFIG.firebase);
      _auth = firebase.auth();
      _db   = firebase.firestore();
      console.log("[Firebase] Initialised ✓");
    } catch (err) {
      console.error("[Firebase] Init failed:", err);
    }
  }

  /* ── Auth ─────────────────────────────────────────────── */

  /**
   * Sign up with email + password.
   * Also sets displayName on the new user profile.
   * @param {string} name
   * @param {string} email
   * @param {string} password
   */
  async function signUp(name, email, password) {
    if (!_auth) throw new Error("Firebase not initialised");
    const cred = await _auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });
    return cred.user;
  }

  /**
   * Sign in with email + password.
   */
  async function signIn(email, password) {
    if (!_auth) throw new Error("Firebase not initialised");
    const cred = await _auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  /**
   * Sign out current user.
   */
  async function signOut() {
    if (!_auth) return;
    await _auth.signOut();
  }

  /**
   * Subscribe to auth state changes.
   * @param {(user: firebase.User | null) => void} callback
   */
  function onAuthChange(callback) {
    if (!_auth) { callback(null); return; }
    _auth.onAuthStateChanged(callback);
  }

  /* ── Firestore ────────────────────────────────────────── */

  /**
   * Get the Firestore collection reference for a user's transactions.
   * @param {string} uid
   */
  function _txRef(uid) {
    return _db.collection("users").doc(uid).collection("transactions");
  }

  /**
   * Save or update a transaction in Firestore.
   * @param {string} uid
   * @param {Object} tx  — must have an `id` field
   */
  async function saveTx(uid, tx) {
    if (!_db) return;
    await _txRef(uid).doc(tx.id).set(tx);
  }

  /**
   * Delete a transaction from Firestore.
   * @param {string} uid
   * @param {string} txId
   */
  async function deleteTx(uid, txId) {
    if (!_db) return;
    await _txRef(uid).doc(txId).delete();
  }

  /**
   * Fetch all transactions for a user (ordered by date desc).
   * @param {string} uid
   * @returns {Promise<Object[]>}
   */
  async function fetchAllTx(uid) {
    if (!_db) return [];
    const snap = await _txRef(uid).orderBy("date", "desc").get();
    return snap.docs.map(d => d.data());
  }

  /**
   * Real-time listener for transactions.
   * @param {string} uid
   * @param {(txs: Object[]) => void} callback
   * @returns {function} unsubscribe
   */
  function listenTx(uid, callback) {
    if (!_db) { callback([]); return () => {}; }
    return _txRef(uid)
      .orderBy("date", "desc")
      .onSnapshot(snap => {
        callback(snap.docs.map(d => d.data()));
      });
  }

  /**
   * Save budget amount for a user.
   * @param {string} uid
   * @param {number} amount
   */
  async function saveBudget(uid, amount) {
    if (!_db) return;
    await _db.collection("users").doc(uid).set({ budget: amount }, { merge: true });
  }

  /**
   * Fetch user settings (includes budget).
   * @param {string} uid
   * @returns {Promise<Object>}
   */
  async function fetchSettings(uid) {
    if (!_db) return {};
    const doc = await _db.collection("users").doc(uid).get();
    return doc.exists ? doc.data() : {};
  }

  return { init, signUp, signIn, signOut, onAuthChange, saveTx, deleteTx, fetchAllTx, listenTx, saveBudget, fetchSettings };
})();
