# 會員閒置自動登出

設定：會員頁連續 30 分鐘未操作自動登出；單次登入最長 7 天，持續操作亦不超過此期限。更新前沒有伺服器時間戳的 Session 要求重新登入，不改帳號或密碼。

伺服器使用既有 Neon Session 儲存 createdAt、lastActivityAt，Cookie 期限改為 30 分鐘。GET /me 只檢查期限，不延長閒置時間。POST /api/members/activity 通過既有 Origin、JSON、Session 與會員狀態驗證後才更新操作時間，並受 7 天上限限制。閒置／絕對期限到達後銷毀 Session 並清除 Cookie，過期 Session 不可用活動請求恢復。

會員頁依伺服器期限計時；點擊、滑鼠移動、鍵盤、觸控、滑動及輸入會記錄活動。活動請求每 15 秒至多一次，尾端請求只同步已發生的操作；沒有持續背景保活。背景頁恢復時重新比較時間，避免瀏覽器暫停計時器而漏登出。支援 BroadcastChannel 的瀏覽器以無憑證訊息同步同源分頁的活動及登出。不支援時各分頁獨立計時。

無資料表 migration、無 Secret 變更。只改會員 Session 與前端閒置處理，不改註冊欄位、店家資料、其他五格或管理員登入。

測試使用可控時鐘及隔離資料庫，另在 Production 僅針對本包生成的測試帳號 Session 回撥 lastActivityAt，實際確認 401、Cookie 清除、Session 刪除、無法續期；不等待 30 分鐘，不變更真實會員 Session。Production 結果依實際部署 log 另行記錄，測試帳號最後清理。
