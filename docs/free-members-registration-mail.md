# 免費會員與註冊通知信

基準：577b762fdeec8f2d8d5d409bd85a0be8871d6f3b。

目前所有會員方案為 free，不需店家資格審核。新註冊由伺服器建立 active 帳號，Email／手機驗證仍是 false。既有 pending 帳號繼續可登入，畫面顯示可使用、聯絡方式尚未驗證；不批次變更任何既有會員。停權、停用限制照舊。

會員中心不再顯示店家待審核，改顯示免費會員。歷史 business_member_profiles.shop_review_status 保留原欄位與預設值供未來工作包設計，不作為現階段免費資格關卡；shopReviewRequired=false。仍不自動綁定或公開店家。店家資料增修沿用建言與合作現有入口；未增修該模組。

註冊交易成功後才嘗試寄通知信。通知僅包含姓名、會員類別、會員編號、店名、註冊時間與固定登入網址，不含密碼、雜湊、Token、手機或內部備註，不當成信箱驗證。寄信失敗不撤銷已建立帳號、不假稱已寄出，也不自動重送。

## 寄信尚未啟用：待 Google 部署及安全設定

目前 Vercel 沒有 MEMBER_RECEIPT_URL／MEMBER_RECEIPT_SECRET；因此 API 回報 registrationEmail.status=not_configured，畫面明示通知信尚未啟用。未完成實際寄送或收件驗證，不能標示整包完成。

沿用既有 MailApp 寄信方式，但採獨立 Apps Script，避免覆蓋已驗收的 contact-google-apps-script.gs 或改動留言流程。

1. 開啟 https://script.google.com/home/start ，使用現有平台寄信帳號建立新專案，名稱「智慧藍田會員註冊通知」。
2. 將根目錄 member-receipt-google-apps-script.gs 完整貼入新專案；不要覆蓋建言與合作專案。
3. 在專案設定→指令碼屬性加入 MEMBER_RECEIPT_SECRET，使用至少 32 字元的隨機值；同一值需放入 Vercel 本專案 Production 的同名敏感環境變數。不要將值貼到聊天、GitHub 或紀錄中。
4. 部署→新增部署→網頁應用程式；執行身分選自己、存取權選任何人，完成 Google 所需的寄信授權。端點只接受有效 HMAC 簽章與短效時間戳，不接受公開任意寄信請求。
5. 將部署的 /exec 網址設為 Vercel Production 的 MEMBER_RECEIPT_URL，重新部署本專案。
6. 用明確測試帳號註冊，驗證 API 回應 sent 及信箱實際收到一次通知；清理該測試會員及 Session。不得用 Node／Apps Script 模擬測試取代真實寄信。

指令碼以會員編號防重，PropertiesService 僅存會員編號及送信時間，不存會員個資。Google 寄信與相關容量使用其既有帳號限制；未開通付費服務。

狀態：免費會員程式及寄信接線已建立；本地測試另記。Production 免費會員流程須另依部署 log 驗證。正式寄信未啟用／待完成上述 Google 與環境設定。
