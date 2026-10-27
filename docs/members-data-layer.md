# 會員資料層：第二步

保護基準：3b987425a92e76246ddfbca8ddd444de90bcd509。
本包不開放註冊、登入或會員 API，不修改任何既有前台／管理畫面。

## 儲存與權限

使用已關聯 Neon `neon-violet-forest`。`DATABASE_URL` 僅由 Vercel Production
內的伺服器程式使用，不解密拉回施工端、不寫入程式庫、不印出。
新增 node-postgres (`pg`) client，CommonJS，維持原有 API 的模組形式。
資料放在獨立 `lantian_members` schema，撤銷 PUBLIC schema/table/function 權限。
沒有新增資料庫使用者，也沒有變更既有管理員或 LINE 權限。

## Migration

`migrations/001-members.sql` 透過 `lib/members-migrate.cjs` 執行。
交易與 advisory lock 防止同時初始化；版本與 SHA-256 記錄在 schema_migrations。
偵測其他未知 user schema/table/view/sequence 即 HOLD；同版本 checksum 不符也 HOLD。
不 drop、不 reset、不清除未知資料；DDL 失敗會 rollback。
不在一般網站請求或一般部署自動執行 migration。

資料表：

- `members`：UUID 主鍵、DB 隨機會員編號、會員類別、姓名／暱稱／手機／Email、
  password_hash、會員狀態、時間戳、驗證旗標、停權旗標、內部備註、is_test、registration_profile。
- `business_member_profiles`：會員外鍵、shop_id、店名、existing/new、綁定旗標、
  店家審核與資料變更審核狀態；複合外鍵限制只能對應 business 會員。
- `schema_migrations`：版本、checksum、套用時間。

會員編號：`MEM-YYYYMMDD-32位隨機大寫十六進位`，由 DB 產生，非流水號。
Email 正規化為 trim/lowercase，DB check 與 lower(email) 唯一索引共同保護。
member_type 僅 individual/business；member_status 僅 pending/active/suspended/disabled。
所有帳號預設 pending，驗證與停權旗標皆 false；updated_at 由 DB trigger 維護。
password_hash 可 null：尚未完成 authentication，不代表可登入。
測試假 hash 僅允許 is_test=true；不可作正式登入憑證。

## Server-only repository

`repository(client)` 提供 createMember / getMemberByEmail / getMemberByMemberId。
createMember 使用交易建立會員及店家資料，禁止從 input 帶入權限／狀態／會員編號／
管理備註／時間戳。選用核定資料以 registration_profile 白名單保存。
trusted.passwordHash 只供將來伺服器認證層傳入；絕對不可把 HTTP body 當 trusted 參數。
回傳投影不含 password_hash、admin_notes。讀取函式是內部資料層，不等於對外授權 API。
下一包仍須建立 authentication、授權與 request validation 後才能接前台。

店家會員只建立 pending/unbound profile；shop_id=null，不參照、不更動 merchants.js。
尚無 profile 修改、店家審核、密碼重設、管理員編輯功能。

## Production 驗證執行方式

以單次 Vercel Production deployment 的 buildCommand override 執行
`npm run members:production-verify`。不改專案永久 build 設定，不新增公開測試 API。
腳本同時限制 VERCEL_ENV 與固定專案 ID，密鑰留在 Vercel。
Migration 成功後 INSERT 合成 UAT 資料並 COMMIT，使用另一 DB connection SELECT。
測試唯一性、非法狀態／類別、plaintext 拒絕、defaults、updated_at、店家 pending。
負向寫入在各自交易內 rollback；已 commit 的測試資料以本輪產生的 UUID 加 is_test
雙條件清除，確認剩餘零筆。只輸出 PASS 狀態與合成測試 UUID／會員編號／時間。
原始錯誤、password_hash、敏感會員資料與連線設定一律不輸出。

`npm run test:members-data` 為本機 PGlite PostgreSQL 相容引擎測試；
不得當作 Production 連線／持久化證據。Production 結果必須以部署 build log 單獨核對。

參考：node-postgres 官方 queries / transactions 文件（參數化查詢、同 client 交易）。
