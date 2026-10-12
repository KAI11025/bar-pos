// Firebase 連線：每個人用自己的帳號密碼登入，把 Firestore 包成 app 用的介面（doc / collection / where / onSnapshot）
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, query, where,
  onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, storeEmail } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let fs;
try {
  fs = initializeFirestore(app, { ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  fs = initializeFirestore(app, { ignoreUndefinedProperties: true });
}

const docSnap = (s) => ({ exists: s.exists(), id: s.id, data: () => s.data() });
const docRef = (ref) => ({
  id: ref.id,
  get: () => getDoc(ref).then(docSnap),
  set: (d) => setDoc(ref, d),
  update: (d) => updateDoc(ref, d),
  delete: () => deleteDoc(ref),
  onSnapshot: (cb, err) => onSnapshot(ref, (s) => cb(docSnap(s)), err),
});
const coll = (path, cons = []) => ({
  doc: (id) => docRef(id ? doc(fs, path, id) : doc(collection(fs, path))),
  where: (f, op, v) => coll(path, cons.concat([where(f, op, v)])),
  onSnapshot: (cb, err) => onSnapshot(query(collection(fs, path), ...cons),
    (q) => cb({ docs: q.docs.map((d) => ({ id: d.id, data: () => d.data() })) }), err),
});
const db = { doc: (p) => docRef(doc(fs, p)), collection: (p) => coll(p) };

const DOMAIN = (storeEmail.split('@')[1]) || 'jcorner.app';
const normName = (s) => String(s || '').trim().toLowerCase();

// 帳號名字 → 登入用的 email：先查員工名單（public/logins），查不到就當成 名字@網域
async function emailFor(name) {
  const n = normName(name);
  if (n.includes('@')) return n;
  try {
    const s = await getDoc(doc(fs, 'public/logins'));
    const map = (s.exists() && s.data().map) || {};
    if (map[n]) return map[n];
  } catch (e) { /* 規則還沒開放 public 時就用預設 */ }
  return n + '@' + DOMAIN;
}

// 新增員工帳號：用第二個 Firebase 連線建立，現在登入的人不會被登出
let creator = null;
async function createAccount(password) {
  if (!creator) creator = getAuth(initializeApp(firebaseConfig, 'creator'));
  const email = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + '@' + DOMAIN;
  await createUserWithEmailAndPassword(creator, email, password);
  await signOut(creator);
  return email;
}
async function changeMyPassword(oldPw, newPw) {
  const u = auth.currentUser; if (!u) throw new Error('not-signed-in');
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, oldPw));
  await updatePassword(u, newPw);
}

window.POSAUTH = {
  logout: () => signOut(auth).then(() => location.reload()),
  email: () => (auth.currentUser && auth.currentUser.email) || '',
  isMaster: () => !!auth.currentUser && auth.currentUser.email === storeEmail,
  createAccount, changeMyPassword,
};

// 第一次使用：資料庫還沒有菜單就放入預設菜單
async function seedMenu() {
  try {
    const ref = doc(fs, 'menu/main');
    const s = await getDoc(ref);
    if (!s.exists()) {
      const m = await (await fetch('menu.json', { cache: 'no-store' })).json();
      await setDoc(ref, { items: m.items, updatedAt: Date.now() });
    }
  } catch (e) { console.error('seed menu', e); }
}

const $ = (id) => document.getElementById(id);
let started = false, startedUid = null;
onAuthStateChanged(auth, (user) => {
  if (user) {
    $('login').hidden = true;
    if (started && startedUid !== user.uid) { location.reload(); return; }
    if (!started) { started = true; startedUid = user.uid; seedMenu(); window.__resolveDB(db); }
  } else {
    if (started) { location.reload(); return; }
    $('login').hidden = false;
    setTimeout(() => $('login-name').focus(), 50);
  }
});

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('login-err'); err.hidden = true;
  try {
    const email = await emailFor($('login-name').value);
    await signInWithEmailAndPassword(auth, email, $('login-pass').value);
  } catch (x) {
    const c = (x && x.code) || '';
    err.textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? '帳號或密碼不對'
      : /network/.test(c) ? '連不到網路' : /too-many/.test(c) ? '試太多次了，等一下再試' : '登入失敗（' + c + '）';
    err.hidden = false;
  }
});
