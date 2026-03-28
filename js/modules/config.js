/**
 * config.js — App-wide configuration
 *
 * 🔥 FIREBASE SETUP:
 *   1. Go to https://console.firebase.google.com
 *   2. Create a new project → "Ledger Pro"
 *   3. Add a Web App → copy firebaseConfig values below
 *   4. Enable Authentication → Email/Password
 *   5. Enable Firestore Database (start in test mode for now)
 *   6. Deploy to Firebase Hosting OR GitHub Pages
 */

const CONFIG = {
  // ── Replace with your own Firebase project config ──────────
  firebase: {
    apiKey:            "YOUR_API_KEY",
    authDomain:        "YOUR_PROJECT.firebaseapp.com",
    projectId:         "YOUR_PROJECT_ID",
    storageBucket:     "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId:             "YOUR_APP_ID",
  },

  // ── Feature flags ─────────────────────────────────────────
  // Set to false to use localStorage-only (no Firebase)
  USE_FIREBASE: false,

  // ── Pagination ────────────────────────────────────────────
  TX_PER_PAGE: 10,

  // ── Category configuration ────────────────────────────────
  CATEGORIES: {
    expense: [
      { value: "Food",          label: "🍔 Food",          color: "#f5c842" },
      { value: "Travel",        label: "✈️ Travel",        color: "#5b8dee" },
      { value: "Bills",         label: "⚡ Bills",          color: "#f46060" },
      { value: "Shopping",      label: "🛍️ Shopping",      color: "#f472b6" },
      { value: "Health",        label: "🏥 Health",        color: "#3ecf8e" },
      { value: "Entertainment", label: "🎬 Entertainment", color: "#a78bfa" },
      { value: "Other",         label: "📦 Other",         color: "#8888a8" },
    ],
    income: [
      { value: "Salary",     label: "💼 Salary",     color: "#3ecf8e" },
      { value: "Freelance",  label: "💻 Freelance",  color: "#22d3ee" },
      { value: "Investment", label: "📈 Investment", color: "#5b8dee" },
      { value: "Other",      label: "📦 Other",      color: "#8888a8" },
    ],
  },

  // Flat list for filter dropdowns
  ALL_CATEGORIES: [
    "Food","Travel","Bills","Shopping","Health","Entertainment",
    "Salary","Freelance","Investment","Other",
  ],

  CAT_ICONS: {
    Food: "🍔", Travel: "✈️", Bills: "⚡", Shopping: "🛍️",
    Health: "🏥", Entertainment: "🎬", Salary: "💼",
    Freelance: "💻", Investment: "📈", Other: "📦",
  },

  CAT_COLORS: {
    Food: "#f5c842", Travel: "#5b8dee", Bills: "#f46060",
    Shopping: "#f472b6", Health: "#3ecf8e", Entertainment: "#a78bfa",
    Salary: "#3ecf8e", Freelance: "#22d3ee", Investment: "#5b8dee",
    Other: "#8888a8",
  },

  // ── Auto-category keyword mapping ─────────────────────────
  CAT_KEYWORDS: {
    Food:    ["food","pizza","burger","restaurant","cafe","lunch","dinner","breakfast",
              "snack","grocery","groceries","swiggy","zomato","dominos","mcdonalds",
              "kfc","chai","coffee","biryani","meal","eat","hotel","dhaba","eatery"],
    Travel:  ["uber","ola","cab","taxi","flight","train","bus","metro","petrol","fuel",
              "diesel","travel","trip","tour","ticket","booking","irctc","redbus",
              "makemytrip","airport","toll","parking","rapido","auto"],
    Bills:   ["bill","electricity","water","gas","rent","wifi","internet","mobile",
              "recharge","netflix","spotify","amazon prime","subscription","emi",
              "loan","insurance","broadband","jio","airtel","vi","bsnl"],
    Shopping:["shopping","amazon","flipkart","myntra","clothes","shoes","fashion",
              "dress","shirt","pants","mall","market","purchase","buy","order","delivery","meesho"],
    Health:  ["medicine","doctor","hospital","clinic","pharmacy","medical","health",
              "gym","fitness","yoga","chemist","apollo","prescription","checkup",
              "dental","eye","optician"],
    Entertainment:["movie","cinema","game","concert","party","fun","entertainment",
              "pub","bar","club","outing","event","show","bookmyshow","pvr","inox"],
    Salary:  ["salary","wages","paycheck","pay","earnings","ctc","stipend"],
    Freelance:["freelance","client","project","contract","consulting","gig","upwork","fiverr"],
    Investment:["invest","investment","stock","mutual fund","sip","shares","dividend",
              "crypto","fd","ppf","nps","returns","zerodha","groww"],
  },
};
