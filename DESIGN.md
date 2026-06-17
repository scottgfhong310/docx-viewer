# docx-viewer — 設計文件

> 開發者面向的設計與實作參考。使用說明見 [README](./README.md)；快速定位 / canon 重點見 [CLAUDE.md](./CLAUDE.md)；
> 家族共同規範見 [nodeapp-webapp-family](https://github.com/scottgfhong310/nodeapp-webapp-family)（`DESIGN_GUIDELINES.md` / `WORKFLOW.md` / `PLAYBOOK.md`）。
> 本 app 屬「**viewer 類**」家族成員，與 `html-/xlsx-/pptx-viewer` 共用同一套骨架（見 §6 與家族 §4.7）。

---

## 1. 定位與目標

在瀏覽器內**高保真檢視 Word（`.docx`）文件**：保留分頁、頁首／頁尾、註腳、字型、頁面版面，呈現得像真實的一頁 Word。
零打包、CDN-first；薄後端（只負責靜態檔 + 上傳／列表／清空），重邏輯放前端、核心抽成可嵌入 lib。

設計取捨的總原則：**忠實還原 > 可編輯性**（這是 viewer，不是編輯器）；**沿用家族 canon > 自創**。

## 2. 架構與資料流

```
使用者
  │  拖拉 / 點選 / ?docx=<路徑> / 側欄點擊
  ▼
docx-viewer.js（控制器，碰 DOM）
  │  loadAndShow(link)
  ├─ DocxViewerLib.isSafeLink(link)            // 路徑安全（純邏輯）
  ├─ DocxViewerLib.fetchBlob(link)             // GET → Blob（逐段編碼 + cache-bust）
  ▼
window.docx.renderAsync(blob, #dv-container, null, RENDER_OPTS)   // docx-preview：寫 DOM
  ▼
#dv-container > .docx-wrapper > section.docx …（一頁頁「紙張」，受本頁 CSS 著色）
```

- **依賴載入順序**（`index.html`）：jQuery → Materialize → Lodash → `jszip` → `docx-preview` → `docx-viewer-lib.js` → `i18n.js` → `locales/*` → `docx-viewer.js`（最後，DOM/依賴皆就緒）。
- **後端**：`/` 302 → `/apps/docx-viewer/`；靜態檔由 Express 從站台根提供；前端一律走絕對路徑（`/api/...`、`/upload/...`）→ **不相容 GitHub Pages**。

## 3. 後端（Express）

| 檔案 | 角色 |
|---|---|
| `app.js` | 入口：`morgan` + `express.json({limit:'5mb'})` + static；掛 `/api/upload`、`/api/docx-viewer`；`/`→302；JSON 404；`PORT||3000` |
| `routes/upload.js` | 家族**共用最小版**：`POST /api/upload?folder=docx-viewer`，欄位 `myFiles`、多檔、指定 folder 保留原檔名（同名覆寫）|
| `routes/docx-viewer.js` | app 專屬：`GET /files`（列出、新→舊）、`POST /clear`（刪可見檔，留資料夾與隱藏檔）|

| Method / Path | 說明 | 回應 |
|---|---|---|
| `POST /api/upload?folder=docx-viewer` | 上傳（多檔、覆寫）| `{ ok, ... }` |
| `GET /api/docx-viewer/files` | 列出 `public/upload/docx-viewer/` | `{ ok, files:[{name,size,mtime}] }` |
| `POST /api/docx-viewer/clear` | 清空該資料夾 | `{ ok, removed }` |

**安全**：操作目標寫死為 `public/upload/docx-viewer`，不接受任何外部路徑參數；只處理可見一般檔（跳過 `.` 開頭與子目錄）。

## 4. 前端四件式

### 4.1 `index.html`（純結構）
- `<head>` 防閃爍開機腳本：先讀 `localStorage('docx-viewer-theme')||'dark'` 設好 `data-theme`，並同步 toggle `dark-mode`/`light-mode` class（驅動共用 `materialize-dark.css`，家族 §5.1）。
- 結構：側欄 `#slide-out`（檔案清單）、`#empty-state`（空狀態 / 可點選 / 全頁拖拉）、`#dv-doc`（toolbar：icon + 檔名；`#dv-container`：docx-preview 輸出）、`#loading`、`#drop-overlay`、`#file-picker`（accept `.docx`）、`.side-tools`。
- 載入 `materialize.css` → `materialize-dark.css` → `docx-viewer.css` → `thinking-dot.css` → `side-tool.css`。

### 4.2 `docx-viewer.css`（主題 token + 樣式）
- 家族標準 token（`--bg/--surface/--text/--accent…`）light/dark；`--mz-*` 映射讓 Materialize 元件跟 `--accent`。
- **紙張 token**：`--paper-bg` / `--paper-fg` / `--paper-shadow` 兩主題各一份。`.docx-wrapper > section.docx { background: var(--paper-bg) !important; color: var(--paper-fg); }`——深色主題下紙張也轉深。
- `@media print`：強制白底黑字、去陰影（列印不隨螢幕深色）。

### 4.3 `docx-viewer-lib.js`（核心 library，`window.DocxViewerLib`，純邏輯、不碰 DOM）
IIFE + 掛 window；零 DOM 依賴。Public API：

| 成員 | 說明 |
|---|---|
| `parseQuery(search)` | 穩健解析 `?docx=`——避開 `URLSearchParams` 把 `+` 變空白；`docx=` 開頭時整段當值，容忍未編碼 `&` |
| `isSafeLink(link)` | 擋 `..`、`\`、scheme（`http:`/`file:`/`javascript:`）、protocol-relative `//`；絕對路徑須命中 `ALLOWED_ABSOLUTE_PREFIXES`（`/upload/docx-viewer/`）|
| `isUploadable(name)` | `/\.docx$/i` |
| `encodePath(link)` | 逐段 `encodeURIComponent`、保留 `/`（只對原始路徑用）|
| `fileUrl(name)` | 回**原始**靜態路徑 `/upload/docx-viewer/<name>`（fetch/下載時才 `encodePath`）|
| `fetchBlob(link)` | `encodePath` + cache-bust → `GET` → `Blob`（供 docx-preview）|
| `uploadFile / listFiles / clearFolder` | 伺服器溝通，回 `{ok}` 信封；失敗 `reject(Error)` |
| `basename / formatSize / timestamp / escapeHtml` | 工具 |

### 4.4 `docx-viewer.js`（控制器，碰 DOM）
- `applyTheme/toggleTheme`：切 `data-theme` + class，**不重新渲染**（紙張由 CSS 著色）。
- `loadAndShow(link)`：安全檢查 → 顯示 + `showLoading` → `fetchBlob` → `renderAsync`；切檔先 `container.innerHTML=''` 避免堆疊；失敗轉 toast。
- `RENDER_OPTS`：`className:'docx'`、`inWrapper`、`breakPages`、`renderHeaders/Footers/Footnotes` 等高保真設定（沿用原型）。
- 檔案清單（`renderSideNav`/`markActive`/`refreshFiles`）、上傳（`uploadFiles`，過濾 `isUploadable`）、清空（`confirm` 二次確認）、全頁拖拉（depth 計數避免閃爍）、i18n 重繪、`?docx=` 深連結（`pushState`/`popstate`）。
- **下載原始檔**：右側 `#setting-download` 側鍵（家族 §4.7），只在開檔時顯示、點擊以臨時 `<a download>` 觸發、套 `check` 微回饋。

## 5. 關鍵設計決策（與理由 / 替代方案）

1. **轉換引擎：docx-preview（非 mammoth）。** docx-preview 重現頁面版面（分頁／頁首尾／註腳／字型）；mammoth 輸出語意化 HTML、易主題化但**失分頁與版面保真**——對「檢視器」是退步。原型已採 docx-preview，沿用。
2. **渲染呼叫留控制器（不進 lib）。** `renderAsync` 直接寫 DOM；依家族 §4.7「引擎碰 DOM → 渲染留控制器」，lib 只保留純邏輯。
3. **紙張跟主題（深色紙張）。** 外殼與文件頁面都隨主題；以 `--paper-*` 兩主題供色。**取捨**：`.docx` 內帶**明確顏色**的文字會保留原色，深底上對比可能偏低（自動/繼承色才會轉淺）。需要時切淺色或列印（一律白紙）。
4. **穩健 query 解析 + 逐段編碼。** 檔名常含空白／`+`／`&`／括號；`parseQuery` + `encodePath` 確保深連結與 fetch/下載都正確。
5. **下載走側鍵。** 操作收斂到右側工具列、toolbar 只留檔名（家族 §4.7）。

## 6. lib / 控制器邊界（家族 §4.7）

docx-viewer 落在「**引擎直接寫 DOM**」這側：`fetchBlob`（純）在 lib，`renderAsync`（寫 DOM）在控制器。對照同家族：`xlsx-viewer` 的引擎回純資料 → 連「表格組字串」都進 lib；`pptx-viewer` 同 docx（引擎寫 DOM）。三者剛好標出這條邊界的兩側。

## 7. 主題 / i18n / 安全

- **主題**：CSS 變數 light/dark，預設 dark；防閃爍開機腳本；Materialize 深色交給共用 `materialize-dark.css`。
- **i18n**：`i18n.js` 引擎 + `locales/{zh-Hant,en,ja}.js`，`data-i18n*` 屬性，預設 `zh-Hant`；**文件內容是 data，永不翻譯、也不隨語系重渲染**。
- **安全**：上傳白名單 `.docx`（picker accept + 前端 `isUploadable` 再驗）；路徑安全 `isSafeLink`；後端操作目標寫死、`{ok}` 信封、`express.json` 5mb 上限、危險操作 `confirm`；jQuery 3.7.1、後端不依賴 lodash。

## 8. 已知限制與取捨

- **深色紙張的明確色文字**：見 §5.3。
- **超大文件**：docx-preview 全量渲染所有頁，極大檔可能較慢／吃記憶體。
- **呈現範圍**：以 docx-preview 能力為界；少數複雜版面元素可能略有差異。
- **信任邊界**：檢視信任來源的檔案（與開啟任何本機文件同級）。

## 9. 參考

- 家族規範：`DESIGN_GUIDELINES.md`（§4.1 拆分、§4.7 viewer 引擎與 lib 邊界、§5 視覺、§6 i18n、§8 安全）。
- 流程：`WORKFLOW.md`（Path A）、`PLAYBOOK.md`（逐步劇本、§5 `display=''` 坑）。
- 上游：[docx-preview](https://github.com/VolodymyrBaydalka/docxjs)、[JSZip](https://stuk.github.io/jszip)。
