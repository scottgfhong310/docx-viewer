# docx-viewer — Session context

在瀏覽器內**高保真檢視 Word（`.docx`）文件**的單頁 WebApp：用 **docx-preview**（底層 JSZip）渲染，保留分頁 / 頁首頁尾 / 註腳 / 字型 / 頁面版面，輸出長得像真實 Word 頁。輕量 Express 後端（上傳 / 列表 / 清空）。由 `html-viewer` 起手式複製改名而來（Path A，html-viewer 本身由 markdown-reader 起手），共用家族 canon（主題 / i18n / 四件式 / side-tool）。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程、`PLAYBOOK.md` 逐步劇本）。**改動前請先讀那幾份，照其中 canon 做。**

## 結構

```
app.js                              # Express 入口：port 3000；/ → 302 /apps/docx-viewer/
routes/upload.js                    # POST /api/upload?folder=docx-viewer（共用最小版）
routes/docx-viewer.js               # GET /files、POST /clear
public/apps/docx-viewer/            # 前端（服務於 /apps/docx-viewer/）
├─ index.html · docx-viewer.css · docx-viewer.js · docx-viewer-lib.js
├─ materialize-dark.css             # 家族共用（Materialize 深色；materialize.css 之後載入）
├─ side-tool.css                    # 〔正統〕flex .side-tools 版（§5.5）
├─ thinking-dot.css                 # 共用載入點 utility（與 markdown-library 同步、本份消費）
├─ i18n.js · locales/{zh-Hant,en,ja}.js
public/upload/docx-viewer/          # 上傳的文件（內容不進版控；附少量 .docx sample）
```

## 執行 / 驗證

```bash
npm install && node app.js          # → http://localhost:3000/apps/docx-viewer/
```

## 本 app 的 canon 重點

- **轉換引擎是 docx-preview**：透過 CDN 載入 `jszip@3.10.1` + `docx-preview@0.3.5`，以 `window.docx.renderAsync(blob, container, null, opts)` 把 `.docx` 渲染進 light DOM 的 `#dv-container`。**渲染呼叫會寫 DOM，故留在控制器 `docx-viewer.js`，不進 lib。** 渲染選項 `RENDER_OPTS` 沿用原型（`breakPages`、`renderHeaders/Footers/Footnotes` 等高保真設定）。
- **可嵌入 lib** `docx-viewer-lib.js`（`window.DocxViewerLib`，純邏輯、不碰 DOM）：
  - `parseQuery(search)`：穩健解析 `?docx=`——避開 `URLSearchParams` 把 `+` 變空白、容忍檔名含未編碼 `&`（沿用原型）。
  - `isSafeLink()`：擋 `..`、反斜線、scheme（`http:`/`file:`/`javascript:`）、protocol-relative `//`；絕對路徑須命中 `ALLOWED_ABSOLUTE_PREFIXES`（預設 `['/upload/docx-viewer/']`），相對路徑相對 viewer 目錄放行。
  - `encodePath(link)`：逐段 `encodeURIComponent`、保留 `/`——只對「原始（解碼後）」路徑用（已編碼字串重編碼會雙重編碼）。`fileUrl(name)` 回**原始**靜態路徑，要 fetch / 下載時才經 `encodePath`。
  - server 通訊：`listFiles` / `uploadFile` / `clearFolder` / `fetchBlob`（回 Blob 供 docx-preview）；工具 `basename` / `formatSize` / `timestamp`。
- **控制器** `docx-viewer.js`（碰 DOM）：主題切換、i18n 重繪、拖拉 / 上傳、檔案清單、`docx.renderAsync` 渲染、`?docx=` 深連結（`pushState`/`popstate`）。切檔時 `container.innerHTML=''` 再渲染，避免堆疊。
- **主題（含「紙張」）**：CSS 變數 light/dark，**預設 dark**（`<html data-theme="dark">` ＋ `localStorage('docx-viewer-theme')||'dark'`）；防閃爍開機腳本同時 toggle `dark-mode`/`light-mode` class 驅動 `materialize-dark.css`（§5.1）。docx-preview 輸出在 **light DOM**，故「紙張」由本頁 CSS 著色——`--paper-bg`/`--paper-fg` 兩主題各一份，**深色時連文件頁面也轉深**；切主題只翻 `data-theme`、**不必重新渲染**。列印 `@media print` 一律白紙黑字。
  - **已知取捨**：`.docx` 內帶**明確顏色**的文字會保留原色，深色紙張上可能對比偏低（自動 / 繼承色會跟著轉淺）。屬「紙張跟主題」決議的固有取捨；需要時切淺色或列印。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`。文件內容是 **data，永不翻譯**（也不隨語系重新渲染）。
- **side-tool**：`#setting-menu`（檔案清單）/ `#setting-mode`（主題）/ `#setting-lang` / `#setting-clear`（清空，hover 轉紅）；用〔正統〕flex `.side-tools` 容器。下載原始檔是 toolbar 內的 `#dv-doc-open`（`file_download` icon + `download` 屬性、href 經 `encodePath`）。
- **安全**：上傳白名單 `.docx`（picker accept + 前端 `isUploadable` 再驗）；後端操作目標寫死、`{ ok }` 信封；危險操作 `confirm()`。jQuery 3.7.1，後端不依賴 lodash。
- **InProgress 鏡像**：同名前端回灌到 `InProgress/public/apps/docx-viewer/`，route 掛在 InProgress 的 `/api/docx-viewer`；上傳沿用 InProgress 共用 `/api/upload?folder=docx-viewer`（雙鍵 `{ ok, success }`，前端查 `resp.ok`）。
- **preview**：`GitHub/.claude/launch.json` 有一筆 `docx-viewer`（`node docx-viewer/app.js`，port 3000）。
