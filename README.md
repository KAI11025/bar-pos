# 點單收銀

酒吧用的點單、出餐、結帳、營業額 app。網頁版，iPhone 用 Safari「分享 → 加入主畫面」就能當 app 用。

- 資料存在 Firebase Firestore，多支手機即時同步；斷網時先存在手機，連上後自動補上傳。
- 只有店帳號（Firebase Authentication）能讀寫，規則在 `firestore.rules`。

## 檔案
- `index.html`：整個 app（畫面、樣式、邏輯）
- `db.js`：登入與 Firestore 連線
- `config.js`：Firebase 專案設定、店帳號 email
- `menu.json`：資料庫還沒有菜單時放入的預設菜單
- `manifest.webmanifest`、`icons/`：桌面圖示

## 資料
- `menu/main`：菜單 `{items:[{id,name,en,cat,price,active}]}`
- `regulars/main`：熟客 `{list:[{id,name,note,last}]}`
- `settings/main`：桌位 `{tables:[...]}`
- `orders/*`：訂單 `{kind:'table'|'person', table, rid, note, items:[{id,menuId,name,price,qty,sv,t,at}], payments:[{at,method,amount,lines,tendered}], payDays, status, serving, createdAt, closedAt}`（`t` 是出餐類別 drink/food/none；舊單的 `guests` 已不使用）
- `notes/*`：備忘 `{text, done, at, doneAt}`，每則一份文件，多支手機同時新增不會互蓋
- 營業日以早上 6 點換日。
