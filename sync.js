// Road to C1 : connexion à la base Firebase (projet dédié) et service hors connexion.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Configuration du projet Firebase « Road to C1 » (ces valeurs ne sont pas secrètes :
// les données sont protégées par le code personnel et les règles Firestore).
const firebaseConfig = {
  apiKey: "AIzaSyANTl65_LRALk8ishPmksXipbcEQlWsGgk",
  authDomain: "road-to-c1-f4842.firebaseapp.com",
  projectId: "road-to-c1-f4842",
  storageBucket: "road-to-c1-f4842.firebasestorage.app",
  messagingSenderId: "734078227406",
  appId: "1:734078227406:web:a754ca523dc99c6595119f"
};

const KEY = "_c1code";
const $ = (id) => document.getElementById(id);
const getCode = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const setCode = (c) => { try { c ? localStorage.setItem(KEY, c) : localStorage.removeItem(KEY); } catch (e) {} };

let db = null;
function adapter(code) {
  const col = collection(db, "espaces", code, "anglais");
  return {
    get: async () => { const s = await getDocs(col); return { docs: s.docs.map(d => ({ id: d.id, data: () => d.data() })) }; },
    doc: (k) => ({ set: (v) => setDoc(doc(col, k), v), delete: () => deleteDoc(doc(col, k)) })
  };
}
async function connect(code) {
  const r = await window.c1Sync.start(adapter(code));
  if (r === "denied") { setCode(null); askCode("Ce code ne fonctionne pas, ou la base n'est pas encore configurée."); }
  else { $("codeMsg").textContent = "Code enregistré sur cet appareil ✓"; }
}
function askCode(msg) {
  $("acct").open = true;
  $("codeMsg").textContent = msg || "Entre ton code personnel pour activer la sauvegarde.";
  window.c1Sync.show("Sauvegarde en attente de ton code personnel (voir « Ma sauvegarde »).");
}

try { db = getFirestore(initializeApp(firebaseConfig)); }
catch (e) { window.c1Sync.show("La base n'a pas pu démarrer. Recharge l'app."); }

$("codeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const c = $("codeIn").value.trim().toLowerCase();
  if (!/^[a-z0-9-]{24,}$/.test(c)) { $("codeMsg").textContent = "Le code fait au moins 24 caractères (lettres, chiffres). Recopie-le en entier."; return; }
  setCode(c); $("codeIn").value = ""; if (db) connect(c);
});
const saved = getCode();
if (db) { saved ? connect(saved) : askCode(); }

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

// ===== Programme automatique : bilan quotidien et programme du matin (dépôt GitHub privé) =====
const GH_REPO = "Gwladys-cloud/road-to-c1-donnees";
const GH_KEY = "_c1gh";
const API = "https://api.github.com/repos/" + GH_REPO + "/contents/";
const ghTok = () => { try { return localStorage.getItem(GH_KEY); } catch (e) { return null; } };
const ghHead = (t, raw) => ({ "Authorization": "Bearer " + t, "Accept": raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" });
const b64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const ghMsg = (t) => { const m = $("ghMsg"); if (m) m.textContent = t; };

async function loadProgramme() {
  const t = ghTok(); if (!t || !navigator.onLine) return;
  try {
    const r = await fetch(API + "programme.json", { headers: ghHead(t, true), cache: "no-store" });
    if (r.status === 401 || r.status === 403 || r.status === 404) { ghMsg("Le jeton ne donne pas accès à road-to-c1-donnees. Vérifie-le."); return; }
    if (!r.ok) return;
    const txt = await r.text(); const p = JSON.parse(txt);
    let old = null; try { old = localStorage.getItem("_c1prog"); } catch (e) {}
    if (old !== txt) {
      try { localStorage.setItem("_c1prog", txt); } catch (e) {}
      let done = false; try { done = sessionStorage.getItem("_c1progReload") === p.date; } catch (e) {}
      if (!done) { try { sessionStorage.setItem("_c1progReload", p.date || "x"); } catch (e) {} location.reload(); }
    }
  } catch (e) {}
}

let sending = false;
async function sendBilan(force) {
  const t = ghTok(); if (!t || sending || !navigator.onLine) return;
  const data = {}; try { Object.keys(localStorage).filter(k => /^c1/.test(k) && k !== "c1tab").sort().forEach(k => { data[k] = localStorage.getItem(k); }); } catch (e) {}
  const body = JSON.stringify(data);
  let last = null, lastAt = 0; try { last = localStorage.getItem("_c1bilanSent"); lastAt = +localStorage.getItem("_c1bilanAt") || 0; } catch (e) {}
  if (!force && (last === body || Date.now() - lastAt < 20 * 60 * 1000)) return;
  sending = true;
  try {
    const bilan = JSON.stringify({ envoye: new Date().toISOString(), progression: data }, null, 1);
    let sha;
    const g = await fetch(API + "bilan.json", { headers: ghHead(t), cache: "no-store" });
    if (g.ok) sha = (await g.json()).sha;
    else if (g.status !== 404) { ghMsg("Bilan non envoyé : le jeton est refusé. Vérifie-le."); sending = false; return; }
    const r = await fetch(API + "bilan.json", { method: "PUT", headers: ghHead(t), body: JSON.stringify({ message: "Bilan du " + new Date().toLocaleDateString("fr-FR"), content: b64(bilan), sha }) });
    if (r.ok) {
      try { localStorage.setItem("_c1bilanSent", body); localStorage.setItem("_c1bilanAt", String(Date.now())); } catch (e) {}
      ghMsg("Bilan envoyé à ton prof · " + new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    } else ghMsg("Bilan non envoyé pour l'instant, nouvel essai plus tard.");
  } catch (e) {}
  sending = false;
}

$("ghForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = $("ghIn").value.trim();
  if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { ghMsg("Ce jeton n'a pas le bon format. Il commence par github_pat_."); return; }
  ghMsg("Vérification du jeton…");
  try {
    const r = await fetch("https://api.github.com/repos/" + GH_REPO, { headers: ghHead(t) });
    if (!r.ok) { ghMsg("Ce jeton n'ouvre pas road-to-c1-donnees. Vérifie qu'il est limité à ce dépôt avec « Contents : Read and write »."); return; }
  } catch (err) { ghMsg("Pas de réseau : réessaie quand tu es connectée."); return; }
  try { localStorage.setItem(GH_KEY, t); } catch (err) {}
  $("ghIn").value = ""; ghMsg("Jeton enregistré ✓ Envoi de ton premier bilan…");
  await sendBilan(true); loadProgramme();
});
if (ghTok()) {
  ghMsg("Programme automatique actif.");
  loadProgramme();
  setTimeout(() => sendBilan(false), 8000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") sendBilan(false); });
  window.addEventListener("online", () => { loadProgramme(); sendBilan(false); });
}

// ===== Restauration depuis la dernière sauvegarde (bilan.json du dépôt privé) =====
let restArm = null;
$("restBtn").addEventListener("click", async () => {
  const b = $("restBtn"), m = $("restMsg"), t = ghTok();
  if (!t) { m.textContent = "Enregistre d'abord ton jeton GitHub, juste au-dessus."; return; }
  if (!restArm) {
    b.textContent = "Confirmer : remplacer ma progression ?"; m.textContent = "Ta progression actuelle sera remplacée par la dernière sauvegarde. Touche à nouveau pour confirmer.";
    restArm = setTimeout(() => { restArm = null; b.textContent = "Restaurer depuis la sauvegarde"; m.textContent = ""; }, 6000); return;
  }
  clearTimeout(restArm); restArm = null; b.textContent = "Restaurer depuis la sauvegarde"; b.disabled = true; m.textContent = "Récupération de la sauvegarde…";
  try {
    const r = await fetch(API + "bilan.json", { headers: ghHead(t, true), cache: "no-store" });
    if (!r.ok) { m.textContent = r.status === 404 ? "Aucune sauvegarde trouvée pour l'instant." : "Accès refusé : vérifie ton jeton."; b.disabled = false; return; }
    const d = JSON.parse(await r.text());
    const n = window.c1Sync.importAll(d.progression || {});
    if (!n) { m.textContent = "La sauvegarde est vide."; b.disabled = false; return; }
    let when = ""; try { when = new Date(d.envoye).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }); } catch (e) {}
    m.textContent = n + " élément(s) restauré(s), sauvegarde du " + when + ". Redémarrage…";
    await window.c1Sync.flush(); setTimeout(() => location.reload(), 800);
  } catch (e) { m.textContent = "Pas de réseau : réessaie quand tu es connectée."; b.disabled = false; }
});

// ===== Restaurer depuis la dernière sauvegarde (bilan.json du dépôt privé) =====
let restArmed = false;
$("restBtn").addEventListener("click", async () => {
  const m = $("restMsg"), t = ghTok();
  if (!t) { m.textContent = "Enregistre d'abord ton jeton GitHub (Programme automatique, plus bas)."; return; }
  if (!restArmed) { restArmed = true; $("restBtn").textContent = "Confirmer : remplacer ma progression sur ce téléphone"; m.textContent = "Ta progression sur ce téléphone sera remplacée par la sauvegarde."; setTimeout(() => { restArmed = false; $("restBtn").textContent = "Restaurer ma dernière sauvegarde"; }, 8000); return; }
  restArmed = false; m.textContent = "Récupération de la sauvegarde…";
  try {
    const r = await fetch(API + "bilan.json", { headers: ghHead(t, true), cache: "no-store" });
    if (!r.ok) { m.textContent = r.status === 404 ? "Aucune sauvegarde trouvée pour l'instant." : "La sauvegarde n'a pas pu être lue. Vérifie ton jeton."; return; }
    const b = await r.json();
    const n = window.c1Sync.importAll(b.progression || {});
    if (!n) { m.textContent = "La sauvegarde est vide."; return; }
    let d = ""; try { d = new Date(b.envoye).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }); } catch (e) {}
    m.textContent = n + " élément(s) restauré(s), sauvegarde du " + d + ". Redémarrage…";
    await window.c1Sync.flush(); setTimeout(() => location.reload(), 800);
  } catch (e) { m.textContent = "Pas de réseau : réessaie quand tu es connectée."; }
});
