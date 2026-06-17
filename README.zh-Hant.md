# docx-viewer

[English](README.md) · **中文** · [日本語](README.ja.md)

在瀏覽器內**高保真檢視 Microsoft Word（`.docx`）文件**的單頁 WebApp。以 [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)（底層用 JSZip）渲染每份文件，保留**分頁、頁首／頁尾、註腳、字型與頁面版面**，結果長得就像真實的 Word 頁面。後端是輕量 Express（上傳 / 列表 / 清空）。

- 📄 **高保真渲染** — docx-preview 排出真實頁面（尺寸、邊界、頁首頁尾、註腳、內嵌圖片與字型），不轉成失真的 HTML
- 📥 **拖拉上傳** — 把 `.docx` 拖到頁面任意位置；**同名覆寫**
- 🔗 **深連結** — 用 `?docx=<路徑>` 開任一檔（相對 viewer 目錄，或允許清單內的絕對路徑）；可分享、支援上一頁／下一頁。穩健的 query 解析容忍檔名含 `+`、空白、括號與未編碼的 `&`
- 🌗 **淺色 / 深色** 切換（存 localStorage）——**外殼與文件「紙張」都跟著主題**（深色時連頁面也轉深）；列印一律白紙黑字
- 🌐 **三語 UI** — 繁體中文 / English / 日本語（預設繁體中文，存 localStorage）。文件內容是 data，**永不翻譯**
- 🛡️ **路徑安全** — 擋 `..`、反斜線、`javascript:` / `file:` 協定、protocol-relative `//`，以及非允許清單的絕對路徑
- 🗂️ 檔案清單側欄、下載原始檔、清空資料夾

> 第三方前端庫（jQuery、Materialize、Lodash、Material Icons、JSZip、docx-preview）走 CDN——零打包、零 build。`npm install` 只裝後端依賴。

## 快速開始

需要 Node.js 18+。

```bash
npm install
npm start
# 開啟 http://localhost:3000/apps/docx-viewer/
```

以 `PORT` 改 port：`PORT=8080 npm start`。

## 目錄結構

```
docx-viewer/
├── app.js                          # 獨立 Express 伺服器（static + 兩支 API）
├── package.json
├── routes/
│   ├── upload.js                   # POST /api/upload?folder=docx-viewer（multer、多檔、覆寫）
│   └── docx-viewer.js              # GET /files、POST /clear
└── public/
    ├── apps/docx-viewer/           # 前端（服務於 /apps/docx-viewer/）
    │   ├── index.html              # 純結構
    │   ├── docx-viewer.css         # 主題 token（含紙張 token）+ 本頁樣式
    │   ├── docx-viewer.js          # 控制器（膠水）：主題 / i18n / 上傳 / docx-preview 渲染
    │   ├── docx-viewer-lib.js      # DocxViewerLib：query 解析 / 路徑安全 / 伺服器溝通（純邏輯、不碰 DOM）
    │   ├── materialize-dark.css    # 家族共用資產（Materialize 深色）
    │   ├── side-tool.css           # 右側浮動工具列
    │   ├── thinking-dot.css        # 共用載入點 utility
    │   ├── i18n.js                 # i18n 引擎
    │   └── locales/{zh-Hant,en,ja}.js
    └── upload/docx-viewer/         # 上傳的文件（內容不進版控；附少量 sample）
```

## API

| Method / Path | 說明 |
|---|---|
| `POST /api/upload?folder=docx-viewer` | 上傳（form 欄位 `myFiles`、多檔；指定 `folder` 時保留原檔名 → 覆寫）|
| `GET /api/docx-viewer/files` | 列出 `public/upload/docx-viewer/` 下可見檔（新→舊）|
| `POST /api/docx-viewer/clear` | 刪除該資料夾下所有可見檔（保留資料夾與隱藏檔）|

靜態讀檔：`/upload/docx-viewer/<name>`。所有 API 一律 `{ ok }` 信封。

`GET /api/docx-viewer/files` 回傳：

```jsonc
{
  "ok": true,
  "files": [
    { "name": "string", "size": 0, "mtime": 0 }   // mtime = epoch ms；依新→舊排序
  ]
}
```

## 核心 library（`DocxViewerLib`）

純邏輯、不碰 DOM，可獨立嵌入。真正的「`.docx → HTML`」由 docx-preview（`window.docx.renderAsync`）完成，它會寫 DOM，故該呼叫留在控制器、不在 library。

工具：`parseQuery`（穩健解析 `?docx=`）、`isSafeLink`、`isUploadable`（`.docx`）、`basename`、`encodePath`（逐段編碼）、`fileUrl`、`fetchBlob`、`listFiles`、`uploadFile`、`clearFolder`、`formatSize`、`timestamp`。

## 備註

- 前端以**絕對路徑**呼叫 API（`/api/...`、`/upload/...`），須由本專案 Node 伺服器從**站台根**提供。**不相容 GitHub Pages**（純靜態託管跑不了上傳 / 列表 / 清空 API）。
- 「深色紙張」會重新著色文件底色與**繼承**的文字；但 `.docx` 中帶**明確顏色**的文字會保留原色，在深色頁面上可能對比偏低。若文件大量依賴寫死顏色，切回淺色或直接列印（一律白紙）即可。
- 本 app 屬 **nodeapp WebApp 家族**；共同規範見 [nodeapp-webapp-family](https://github.com/scottgfhong310/nodeapp-webapp-family)。

## 授權

[MIT](./LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
