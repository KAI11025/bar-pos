// Firebase 連線：登入店帳號後，把 Firestore 包成 app 用的介面（doc / collection / where / onSnapshot）
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
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

window.POSAUTH = { logout: () => signOut(auth).then(() => location.reload()) };

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
    if (storeEmail) { $('login-email').value = storeEmail; $('login-email').hidden = true; }
    setTimeout(() => $('login-pass').focus(), 50);
  }
});

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('login-err'); err.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-pass').value);
  } catch (x) {
    const c = (x && x.code) || '';
    err.textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? '密碼不對，再試一次。'
      : /network/.test(c) ? '連不到網路，確認一下 Wi-Fi 或行動網路。' : '登入失敗（' + c + '）';
    err.hidden = false;
  }
});
