# 會員後台唯讀列表

基準：391c5aa473de9c062fa5c711c85c5dc87892b4e0

本包將原本 admin-members.html 的固定示意卡升級為 Neon 正式會員資料的唯讀列表。管理權限沿用既有 LINE LIFF 管理中心與 ADMIN_LINE_USER_HASHES 白名單，不建立第二套管理員帳號。

## 安全邊界
- API：POST /api/members-admin，唯一允許 action=list。
- 後端先驗證 LINE ID token 與管理員白名單，再 SELECT Neon。
- 回傳欄位不含 password_hash、admin_notes、內部 UUID、Session 或 Secret。
- 前端不提供修改、停權、停用、刪除、店家審核或綁定操作。
- 最多回傳 250 筆最新正式會員；is_test=true 的測試會員不列入。
- 不使用 Google Sheet 作為會員權限或帳號資料來源；Neon 仍是正式來源。

## 管理中心
原「藍田新願景管理」入口改為「會員專用區管理」，連到 admin-members.html。其他管理模組不修改。

本包沒有 migration、沒有 Production 資料寫入、沒有改會員帳號、沒有改 157 筆店家。
