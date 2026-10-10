# 高大好店家｜第二階段管理權限（2026-10-10）

## 已確認權限
- 唯一可新增、修改、上下架、發布店家資料的角色：協會管理員。
- 商家本人：沒有後台編輯權；不得透過商家帳號、前台參數或直接呼叫 API 執行寫入。
- 管理員：必須經伺服器端 LINE ID Token 驗證並符合 `ADMIN_LINE_USER_HASHES` 白名單；僅前端解鎖按鈕不構成授權。

## 範圍及保護
- 現有 `merchants.js` 157 筆資料保持原樣；不得批次覆寫、清空或重新編號。
- 第二階段目標：店家新增／資料修改／分類／地圖與外部連結／上下架／排序。
- 所有寫入透過伺服器端授權 API，採 GitHub SHA 衝突檢查；拒絕未授權請求。
- 上架資料與草稿資料需區隔，未公開項目不可出現在前台。
- 功能未完成伺服器端安全驗證、隔離測試前，不在正式站啟用可寫入的操作按鈕。

## 驗收
1. 未登入、無效 Token、非白名單管理員：拒絕所有寫入。
2. 白名單管理員：可新增、編輯、下架、重新發布；變更持久化。
3. 現有 157 筆基準逐筆完整，前台既有搜尋／分類／地圖不可退化。
4. 不修改案件管理、地方大小事或其他已驗收項目。


## 2026-10-10 隔離驗收狀態（僅限第二階段）
- 隔離分支：`feature/merchant-admin-phase2-access-20261010`；正式 `main` 不合併、不發布。
- 最新已確認 CI：`3c58812a1732db4b5a361a8405c00ab5f45d7762`，GitHub Actions PASS。
- 同版本 Vercel Preview 部署 READY；此狀態不等於瀏覽器／手機實機驗收。
- 與 `main` 比對：施工分支超前 35 次提交、落後 0 次；8 個變更檔案，不含 `merchants.js`。
- 已有自動化覆蓋：非管理員拒絕、正式環境禁止寫入、測試環境寫入開關、資料版本衝突、157 筆資料保留、上下架／排序、搜尋／分類、地圖網址及 HTML 轉義。
- 未完成：隔離管理員實際登入與讀取／新增／編輯／上下架／排序持久化驗收；電腦與手機實際畫面驗收。
- 手機管理員登入另列「故障待修」；不得以此阻擋其他不需授權的唯讀工作，也不要求重複手機測試。

## 隔離環境獨立授權｜人工操作前置條件
以下均為「需要人工操作」，且須先由帳號持有人明確授權。不得將 Production 密鑰複製至 Preview、不得在聊天中貼出存取權杖。
1. Vercel 專案 `lantian-live-map` 的 Preview 環境，僅限分支 `feature/merchant-admin-phase2-access-20261010`，設定 `ADMIN_LINE_USER_HASHES`（獲授權測試管理員 LINE 使用者識別碼之 SHA-256 雜湊）；不修改 Production 既有值。
2. 另建立專供此隔離測試的 GitHub fine-grained 存取權杖，僅授權 `kao72302428/lantian-live-map` 的 Contents 讀寫，並於同一 Preview 分支範圍設定 `GITHUB_CONTENT_TOKEN`；不使用正式環境既有權杖。
3. `MERCHANT_UAT_WRITES_ENABLED=true` 已存在於指定 Preview 分支；維持正式環境禁止寫入。
4. 授權後先確認 Preview 的管理員唯讀載入，再於隔離分支建立「不上架」測試店家，驗證修改、上下架、排序、重新讀取及衝突提示；不得動正式資料。
5. 所有實機驗收項目通過前，Production／正式 GitHub Pages 保持 HOLD。

## 操作入口（供獲授權者使用）
- Vercel 專案設定入口：`https://vercel.com/dashboard`（選擇 `lantian-live-map` → Settings → Environment Variables；需再次核對 Preview 與 Git 分支範圍）。
- GitHub 細粒度權杖設定入口：`https://github.com/settings/personal-access-tokens`（Fine-grained tokens → Generate new token；只授權指定儲存庫的 Contents）。
- 隔離分支與程式檢查：`https://github.com/kao72302428/lantian-live-map/tree/feature/merchant-admin-phase2-access-20261010`。
- 任何密鑰都只能填入相應服務的保密欄位，不得貼在聊天室、提交至 GitHub 或提供截圖。
