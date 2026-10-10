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
- 最新已確認 CI：`84f5dc48f1a5523fb10b62561510f03c6c28f8fa`，GitHub Actions PASS（workflow run 38073945254）。
- 同版本 Vercel Preview 部署 READY；此狀態不等於瀏覽器／手機實機驗收。
- 2026-10-11 盤查基準：施工分支於 `5bfbeb5a` 時超前 38 次提交、落後 0 次；8 個變更檔案，不含 `merchants.js`。後續提交數以即時 GitHub 比對為準。
- 已有自動化覆蓋：非管理員拒絕、正式環境禁止寫入、測試環境寫入開關、資料版本衝突、157 筆資料保留、上下架／排序、搜尋／分類、地圖網址及 HTML 轉義。
- 未完成：隔離管理員實際登入與讀取／新增／編輯／上下架／排序持久化驗收；電腦與手機實際畫面驗收。
- 手機管理員登入另列「故障待修」；不得以此阻擋其他不需授權的唯讀工作，也不要求重複手機測試。

## 隔離環境獨立授權｜人工操作前置條件
以下均為「需要人工操作」，且須先由帳號持有人明確授權。不得將 Production 密鑰複製至 Preview、不得在聊天中貼出存取權杖。
1. Vercel 專案 `lantian-live-map` 的 Preview 環境，僅限分支 `feature/merchant-admin-phase2-access-20261010`，設定 `ADMIN_LINE_USER_HASHES`（獲授權測試管理員 LINE 使用者識別碼之 SHA-256 雜湊）；不修改 Production 既有值。
2. 另建立專供此隔離測試的 GitHub fine-grained 存取權杖，僅授權 `kao72302428/lantian-live-map` 的 Contents 讀寫，並於同一 Preview 分支範圍設定 `MERCHANT_UAT_GITHUB_TOKEN`；不使用正式環境既有 `GITHUB_CONTENT_TOKEN` 權杖。
3. `MERCHANT_UAT_WRITES_ENABLED=true` 已存在於指定 Preview 分支；維持正式環境禁止寫入。
4. 授權後先確認 Preview 的管理員唯讀載入，再於隔離分支建立「不上架」測試店家，驗證修改、上下架、排序、重新讀取及衝突提示；不得動正式資料。
5. 所有實機驗收項目通過前，Production／正式 GitHub Pages 保持 HOLD。

## 操作入口（供獲授權者使用）
- Vercel 專案設定入口：`https://vercel.com/dashboard`（選擇 `lantian-live-map` → Settings → Environment Variables；需再次核對 Preview 與 Git 分支範圍）。
- GitHub 細粒度權杖設定入口：`https://github.com/settings/personal-access-tokens`（Fine-grained tokens → Generate new token；只授權指定儲存庫的 Contents）。
- 隔離分支與程式檢查：`https://github.com/kao72302428/lantian-live-map/tree/feature/merchant-admin-phase2-access-20261010`。
- 任何密鑰都只能填入相應服務的保密欄位，不得貼在聊天室、提交至 GitHub 或提供截圖。

## 2026-10-11 架構收斂與防重工紀錄
- `admin.html` / `admin.js` 是既有統一管理中心，`api/_admin-verify.js` 是既有伺服器端 LINE 身分及管理員白名單驗證；不得為商家模組再建立平行的授權機制。
- `admin-merchant.js` 已於 `84f5dc48` 移除對 `/api/admin-auth` 的額外重複請求；商家 API 自行呼叫既有 `verifyAdminToken` 驗證。前端仍可從管理中心沿用當次 session Token；未取得 Token 時仍使用原有 LIFF 流程，手機故障另案處理。
- `merchant.html` 目前直接載入靜態 `merchants.js`；商家管理 API 則讀寫 GitHub 指定隔離分支的 `merchants.js`。後台隔離寫入不等於正式前台立即同步，正式發布流程仍未驗收。
- Vercel 已查得 `MERCHANT_UAT_WRITES_ENABLED` 僅作用於指定 Preview 分支；`GITHUB_CONTENT_TOKEN` 與 `ADMIN_LINE_USER_HASHES` 目前僅在 Production。測試環境缺少 `MERCHANT_UAT_GITHUB_TOKEN` 與獨立的 `ADMIN_LINE_USER_HASHES`，因此不得宣稱真實商家編輯驗收已完成。
- 先盤查、再最小修正、最後以 CI/Preview/實機分開驗收；不重複要求使用者登入或建立權杖，不讀取、複製或更動 Production 密鑰。
- 正式 `main`、Production、其他五個管理模組及 157 筆原始資料保持 HOLD；不自動合併 PR。
