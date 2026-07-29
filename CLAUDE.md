# docx-viewer — Session context

在瀏覽器內**高保真檢視 Word（`.docx`）文件**的單頁 WebApp：用 **docx-preview**（底層 JSZip）渲染，保留分頁 / 頁首頁尾 / 註腳 / 字型 / 頁面版面，輸出長得像真實 Word 頁。輕量 Express 後端（上傳 / 列表 / 清空）。由 `html-viewer` 起手式複製改名而來（Path A，html-viewer 本身由 markdown-reader 起手），共用家族 canon（主題 / i18n / 四件式 / side-tool）。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程、`PLAYBOOK.md` 逐步劇本）。**改動前請先讀那幾份，照其中 canon 做。**

**設計細節（架構 / 逐模組 / 決策 / 限制）見 [DESIGN.md](./DESIGN.md)。**

## 結構

```
app.js                              # Express 入口：port 3000；/ → 302 /apps/docx-viewer/
routes/upload.js                    # POST /api/upload?folder=docx-viewer（家族共用最小版：權威版＝ nodeapp-webapp-family/routes-upload.js，byte-identical；含檔名消毒 sanitizeUploadName，§3.4）
routes/docx-viewer.js               # GET /files、POST /clear
public/apps/docx-viewer/            # 前端（服務於 /apps/docx-viewer/）
├─ index.html · docx-viewer.css · docx-viewer.js · docx-viewer-lib.js
├─ materialize-dark.css             # 家族共用（Materialize 深色；materialize.css 之後載入）
├─ side-tool.css · side-tool.js     # 家族共用側鍵：〔正統〕flex .side-tools 樣式＋setIconDone 行為（權威版＝家族 repo，§5.5）
├─ thinking-dot.css                 # 共用載入點 utility（權威版＝獨立 repo thinking-dot；本份消費、byte-identical 同步；載入點預設 2026-07-19 隨權威統一 14px→27px/2.1s）
├─ i18n.js · locales/{zh-Hant,en,ja}.js
public/upload/docx-viewer/          # 上傳的文件（內容不進版控；附少量 .docx sample）
scripts/make-icons.py               # viewer 六支共用的 icon 產生器（六份 byte-identical）
scripts/sync-copies.sh              # viewer 六支共用的回灌腳本（同上；不碰 upload.js／public/upload/）
public/apps/docx-viewer/icons/              # App icon：母版 SVG 深/淺＋favicon(.ico/.svg)＋PNG 16–512＋manifest

```

## 執行 / 驗證

```bash
npm install && node app.js          # → http://localhost:3000/apps/docx-viewer/
```

## App icon（viewer 六支共用模板）

```bash
python3 scripts/make-icons.py       # 重產整套 icon（SVG／PNG／.ico／manifest）
```

`docx-viewer`／`html-viewer`／`pptx-viewer`／`xlsx-viewer`／`rare-glyph`／`svg-style`
**共用同一支產生器**（六份 byte-identical，照家族 A 類共用件慣例；改一份要六份一起同步，
`md5` 應為單一 hash）。它靠**自己所在的 repo 目錄名**決定產哪一支，所以六份不必各自改參數。

**共用的是 tile 系統，不是圖案**：同樣的圓角方塊、同樣的「紙」與同樣的 accent
（`#90caf9`——六支的 `--accent` 本來就相同），一眼是一套；差異只在裡面那枚純幾何標記。
本 app 是 **段落橫線（文字文件）**。

- **刻意不用副檔名字樣**（`.docx` 這種）：六支裡 `rare-glyph`／`svg-style` 根本不是文件檢視器，
  套上去會說謊。純幾何也省掉字型依賴（光柵化時不必內嵌字型）。
- ⚠️ **PyMuPDF 兩個限制**（家族其他 icon 也踩過）：① **不渲染 `linearGradient`**，會整片退成黑色
  → 母版一律純色底；② **以 SVG 宣告的 `width`/`height` 為渲染基準、不是 `viewBox`**
  → 倍率要用「目標 ÷ 實際 page 寬」反推。
- **產出要排出來看**：`html-viewer` 第一版的角括號尖端朝內，讀起來是一個 ✕ 而不是 `< >`——
  九個 PNG 都產出、尺寸都對，光看檔案清單完全發現不了。

### 回灌 InProgress

```bash
bash scripts/sync-copies.sh
```

同樣是 **viewer 六支共用、byte-identical 的一份**（靠 repo 目錄名認自己是誰）。
**兩個絕對不覆蓋的東西**：`routes/upload.js`（InProgress 是加強版，往回蓋會弄壞孵化器上
所有 app 的上傳——腳本只搬 `routes/<app>.js`，並在偵測到兩邊變成一樣時出聲）、
`public/upload/`（使用者實際上傳的檔案，從不觸碰）。`app.js` 同理不同步。
共用件一律**只驗不抓**，不一致時明講去哪個 repo 同步、回非 0。

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
- **side-tool**：`#setting-menu`（檔案清單）/ `#setting-download`（下載原始檔，只在開檔時顯示、臨時 `<a download>` + check 回饋、href 經 `encodePath`）/ `#setting-clear`（清空，hover 轉紅）/ `#setting-mode`（主題）/ `#setting-lang`；用〔正統〕flex `.side-tools` 容器，**chrome（主題／語言）墊底**（§5.5 排列順序，2026-07-26 收斂）。**下載走側鍵、toolbar 不放操作鍵**（家族 §4.7）。
- **安全**：上傳白名單 `.docx`（picker accept + 前端 `isUploadable` 再驗）；後端操作目標寫死、`{ ok }` 信封；危險操作 `confirm()`。jQuery 3.7.1，後端不依賴 lodash。
- **InProgress 鏡像**：同名前端回灌到 `InProgress/public/apps/docx-viewer/`，route 掛在 InProgress 的 `/api/docx-viewer`；上傳沿用 InProgress 共用 `/api/upload?folder=docx-viewer`（雙鍵 `{ ok, success }`，前端查 `resp.ok`）。
- **preview**：`GitHub/.claude/launch.json` 有一筆 `docx-viewer`（`node docx-viewer/app.js`，port 3000）。
