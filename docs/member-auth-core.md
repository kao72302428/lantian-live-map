# 正式會員註冊登入核心

資料層基準：e82ee9bb5837118e1b6bd6917eef15a289b7edd7。
本包只修改會員頁並新增會員 API、Session 與限流，不變更其他模組或管理員 LINE 驗證。

## API

- POST /api/members/register：完整核定必填欄位與 consent、Email 正規化、密碼規則檢核。
  repository 交易建立 members 與 business_member_profiles；失敗全部 rollback。
- POST /api/members/login：Email＋密碼，帳號不存在與密碼錯誤統一回覆。
- GET /api/members/me：依伺服器 Session 讀本人，忽略傳入的其他 member ID。
- POST /api/members/logout：刪除 DB Session 並清除 Cookie。

僅接受 canonical origin `https://lantian-live-map.vercel.app` 的 JSON POST。
不提供跨站 CORS credentials，不使用 GET 改狀態。所有回應 no-store。
前端 Pages vision.html 保留相同入口 URL，由 member-area.js 導到 Vercel 同網域會員頁。
既有會員雙卡、欄位及 CSS 保留；增加登入區及正式註冊／登出操作。

## 密碼、Session 與資料保護

- bcryptjs 3.0.3，bcrypt cost 12，隨機 salt；至少 8 字元且最多 72 UTF-8 bytes，
  超長拒絕以避免 bcrypt 靜默截斷。不保存明文、不回傳 hash、不記錄 credential。
- express-session 1.19.0 ＋ connect-pg-simple 10.0.0，Session 存 Neon。
  登入 regenerate 防止 session fixation；成功保存 Session 後才更新最後登入時間。
- Cookie：`__Host-lantian.sid`，HttpOnly、Secure、SameSite=Lax、Path=/、無 Domain，
  7 天到期，不 rolling；signed opaque session ID，不放 browser storage。
- SESSION_SECRET 僅 Production sensitive env，至少 32 字元；本包生成 48 bytes 隨機值，
  不寫程式庫，不輸出值。
- /me 每次重新檢查 pending/active 及 suspended；停權或停用後既有 Session 同樣拒絕。
  停權後遭 /me 拒絕的 Session 會被刪除，不會在帳號恢復後重新生效。
- pending 代表「可登入但尚未驗證」，不假改 active；email/mobile verified 都 false。
- 對外投影不含 DB UUID、hash、admin_notes、Session 或 Secret。
- 店家保持 pending、unbound、shop_id=null，不讀寫 merchants.js、不自動公開。

## Migration 與基本濫用防護

`002-member-auth.sql` 只新增會員 schema 的 sessions、rate_limits。
不重建 001，不改既有會員欄位。使用同一 migration ledger、checksum、交易與 lock。
既有 001 runner 是原始初始化／驗證用途；完成 002 後須使用新的 auth migration runner，
不再執行只認得 001 schema 的舊 Production 初始化測試腳本。

限流使用 DB 原子 counter，因此跨 Function instance 共享：
每 15 分鐘，註冊每 IP 10 次；登入每 IP 40 次、每 Email 10 次。
IP 使用 Vercel 提供的 x-real-ip；IP/Email 只以 SECRET HMAC key 存計數。
每次受限操作清除超過 24 小時的計數與過期 Session。不是 CAPTCHA；
共享 IP 可能共用額度，固定時間窗有邊界突發限制，後續可另包改善。

## 測試與部署

- 本機 API／DB／Session：28 項，PGlite PostgreSQL 相容引擎與實際 HTTP handler。
- 本機前端 DOM 串接：6 項；不是人工手機／桌機驗收。
- Production：單次 deployment build 執行 auth migration 後部署 API；
  確認 READY 再從另一個伺服器 job 真實 HTTP register/login/me/logout，
  獨立 DB connection 查核 hash、初始狀態與 business profile。
- UAT 帳號與密碼在 job 內隨機產生，僅 example.invalid 合成帳號；不輸出 credential。
  finally 依本輪專屬 Email＋SYSTEM UAT TEST 標記查出 UUID，僅清理其 Session、
  business profile 與 member，確認剩餘零筆。
- 不新增公開的 migration/UAT/delete API。正式會員後台仍是示意骨架，本包不串真實列表。

## 保留項目

既有會員條款及隱私政策仍標示待平台核定，本包不代擬法律文件。
Logo／主圖沿用原本本頁預覽、不上傳；無新增檔案儲存服務。
無寄信、OTP、忘記密碼、社群登入、會員編修、店家審核／綁定或付款等功能。

參考原作者文件：
https://github.com/expressjs/session
https://github.com/voxpelli/node-connect-pg-simple
https://github.com/dcodeIO/bcrypt.js
