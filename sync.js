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
