# 會員基本資料試算表

狀態：程式與試算表已準備；Apps Script 部署與 Production 同步尚未啟用，不能標示施工完成。

管理員可直接開啟：
https://docs.google.com/spreadsheets/d/1N1m_GBw7vQK0KZ6SncyZj3io0G8bt9_ksMX9t_UCsK8/edit?usp=drivesdk

試算表僅擁有者可存取。會員頁的網址不授予任何 Google 權限，不提供公開會員查詢 API。

## 資料與用途

單向新增：會員編號、會員類別、姓名／聯絡人、店家名稱、手機、Email、會員方案、註冊時間（台灣）。手機以文字保存，保留前導零；時間使用真正日期值，試算表時區為 Asia/Taipei。

Neon 仍為帳號與登入資料來源。試算表不是帳號管理或權限管理來源。編輯試算表不會更改會員帳號、密碼、資格或登入狀態。

不傳送密碼、password_hash、內部 DB ID、Session、admin_notes 或任何 Secret。沒有 DB migration，沒有修改既有會員、店家、其他五格或已驗收 contact Apps Script。

## 啟用步驟（尚未執行）

1. 用試算表擁有者 Google 帳號建立獨立 Apps Script 專案，貼上 `member-sheet-google-apps-script.gs`。不要覆蓋 contact 或註冊收據專案。
2. 產生至少 32 字元的隨機 Secret，分別存入 Apps Script 的 Script Property 與 Vercel Production 的敏感環境變數 `MEMBER_SHEET_SECRET`；不得貼到聊天室、程式庫或 log。
3. 將獨立 Script 部署為 Web App，以擁有者執行，允許伺服器呼叫。Google 授權須由帳號擁有者完成。試算表本身繼續維持受限。入口不回傳會員名單，僅接受具有效 HMAC 簽章且五分鐘內的 POST。
4. 部署產生的 `/exec` 網址存入 Vercel Production 的 `MEMBER_SHEET_URL`，重新部署。
5. 在可信任 Production 環境執行 `node scripts/member-sheet-backfill.cjs`，補入既有非測試會員。此腳本僅 SELECT DB，不更新會員；僅輸出成功數量，不輸出基本資料。先確認沒有未清理的 UAT 測試帳號。
6. 真實驗證一般與店家會員註冊後都有列出、手機保留零、重試不重複、未授權 Google 帳號不能看資料。測試結束只清除本次測試會員與對應試算表列。
7. 全部通過後才能移除 `vision.html` 的「資料同步尚未啟用」提示。

## 故障與重試

同步只在帳號已成功 COMMIT 後執行。同步失敗不回滾帳號，不誘導使用者重複註冊；API 的 `memberSheet.status` 如實回覆 not_configured、synced、failed 或 uncertain。失敗 log 只有固定代碼，不含個資。

目前沒有背景排程或持久化重試佇列。網路中斷或 Google 配額問題後，由管理員執行 backfill 補齊。member_id 防重複，即使先前寫入成功而回應遺失也不新增第二列。已有會員編號的列不覆寫，保留人工編輯。若需自動重試與同步監控，需後續獨立工作包。

## 驗證邊界

本地測試使用模擬 Sheets/MailApp 與隔離 DB，不等於 Production 真實寫入。現有註冊成功信件不因這包自動啟用。
