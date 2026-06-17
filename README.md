# docx-viewer

**English** · [中文](README.zh-Hant.md) · [日本語](README.ja.md)

A single-page web app to **view Microsoft Word (`.docx`) documents in the browser**, faithfully. It renders each document with [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) (JSZip under the hood) — preserving **page breaks, headers / footers, footnotes, fonts and page geometry**, so the result looks like a real Word page. Backed by a lightweight Express server for upload / list / clear.

- 📄 **High-fidelity rendering** — docx-preview lays out real pages (size, margins, headers/footers, footnotes, embedded images & fonts) — no conversion to lossy HTML
- 📥 **Drag & drop upload** — drop `.docx` anywhere on the page; **same name overwrites**
- 🔗 **Deep links** — open any file with `?docx=<path>` (relative to the viewer, or an allow-listed absolute path); shareable & back/forward aware. Robust query parsing tolerates `+`, spaces, parentheses and unencoded `&` in filenames
- 🌗 **Light / Dark** toggle (saved in localStorage) — the **shell and the document "paper" both follow the theme** (dark mode darkens the page too); printing is always white paper / black text
- 🌐 **Multilingual UI** — 繁體中文 / English / 日本語 (default 繁體中文, saved in localStorage). Document content is data and is **never translated**
- 🛡️ **Path safety** — blocks `..`, backslashes, `javascript:` / `file:` schemes, protocol-relative `//`, and non-allow-listed absolute paths
- 🗂️ File-list sidebar, download the original file, empty folder

> Third-party front-end libraries (jQuery, Materialize, Lodash, Material Icons, JSZip, docx-preview) load from CDN — no bundling or build step. `npm install` only pulls the backend dependencies.

## Quick start

Requires Node.js 18+.

```bash
npm install
npm start
# open http://localhost:3000/apps/docx-viewer/
```

Set `PORT` to change the port: `PORT=8080 npm start`.

## Directory structure

```
docx-viewer/
├── app.js                          # Standalone Express server (static + 2 APIs)
├── package.json
├── routes/
│   ├── upload.js                   # POST /api/upload?folder=docx-viewer (multer, multi-file, overwrite)
│   └── docx-viewer.js              # GET /files, POST /clear
└── public/
    ├── apps/docx-viewer/           # Front end (served at /apps/docx-viewer/)
    │   ├── index.html              # Structure only
    │   ├── docx-viewer.css         # Theme tokens (incl. paper tokens) + page styles
    │   ├── docx-viewer.js          # Controller (glue): theme / i18n / upload / docx-preview render
    │   ├── docx-viewer-lib.js      # DocxViewerLib: query parse / path safety / server I/O (pure, no DOM)
    │   ├── materialize-dark.css    # Shared family asset (Materialize dark)
    │   ├── side-tool.css           # Right-side floating toolbar
    │   ├── thinking-dot.css        # Shared loading-dot utility
    │   ├── i18n.js                 # i18n engine
    │   └── locales/{zh-Hant,en,ja}.js
    └── upload/docx-viewer/         # Uploaded documents (contents are git-ignored; a couple of samples shipped)
```

## API

| Method / Path | Description |
|---|---|
| `POST /api/upload?folder=docx-viewer` | Upload (form field `myFiles`, multi-file; keeps the original name when `folder` is set → overwrites) |
| `GET /api/docx-viewer/files` | List visible files in `public/upload/docx-viewer/` (newest first) |
| `POST /api/docx-viewer/clear` | Delete all visible files in that folder (keeps the folder & hidden files) |

Static read: `/upload/docx-viewer/<name>`. All API responses use the `{ ok }` envelope.

`GET /api/docx-viewer/files` returns:

```jsonc
{
  "ok": true,
  "files": [
    { "name": "string", "size": 0, "mtime": 0 }   // mtime = epoch ms; sorted newest → oldest
  ]
}
```

## Core library (`DocxViewerLib`)

Pure logic, no DOM — embeddable on its own. The actual `.docx → HTML` rendering is done by docx-preview (`window.docx.renderAsync`), which writes to the DOM, so that call lives in the controller — not the library.

Helpers: `parseQuery` (robust `?docx=` parsing), `isSafeLink`, `isUploadable` (`.docx`), `basename`, `encodePath` (per-segment), `fileUrl`, `fetchBlob`, `listFiles`, `uploadFile`, `clearFolder`, `formatSize`, `timestamp`.

## Notes

- The front end calls APIs with **absolute paths** (`/api/...`, `/upload/...`), so it must be served from the **site root** by this project's Node server. **Not GitHub-Pages-compatible** (static hosting can't run the upload / list / clear APIs).
- "Dark paper" recolors the document background and inherited text, but runs that carry an **explicit author color** in the `.docx` keep that color — they may have low contrast on a dark page. Toggle to light, or print (always white paper), if a document relies heavily on hard-coded colors.
- This app belongs to the **nodeapp WebApp family**; shared conventions live in [nodeapp-webapp-family](https://github.com/scottgfhong310/nodeapp-webapp-family).

## License

[MIT](./LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
