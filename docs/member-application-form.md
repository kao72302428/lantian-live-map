# 店家會員申請表單

基準：dca06f6c00042072438db965e6e25eb5268bf0e2。

店家註冊改為單一「店家會員申請」表單，不分 A／B，不要求申請人判別既有／新店家。欄位依序為聯絡人姓名、手機、Email、密碼、店家名稱、店家會員條款、隱私權政策。一般會員原必要欄位不變。

後端統一建立 shop_identity=application（待判別申請），忽略客戶端傳來的店家分類／綁定主張。shop_bound=false、shop_review_status=pending、shop_id=NULL。不改公開店家資料、不給予管理權。

003-member-application.sql 僅擴充店家身分 CHECK 約束，保留 existing/new 並新增 application；無會員資料 UPDATE、欄位刪除或資料表重建。專用 migration runner 驗證 001/002 checksum、已知資料表與既有約束後執行，可重複執行。003 套用後不要重跑只認識 001/002 的舊 migration runner。

55 項會員 API 與 DOM 測試通過，包含移轉前 existing/new 資料保持一致、單一 fieldset、店名必填、無身分選項、無前端綁定權限，以及登入／me／登出相容。Production 驗證仍須另依實際部署記錄確認。

Authentication 與 Session 核心、其他五格、157 筆店家及既有會員資料均不在修改範圍。店家判別、資料補填及審核功能仍為後續工作包。待使用者人工驗收。
