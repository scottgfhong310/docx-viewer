# docx-viewer

[English](README.md) · [中文](README.zh-Hant.md) · **日本語**

**Microsoft Word（`.docx`）文書をブラウザで忠実に表示**する単一ページ Web アプリ。[docx-preview](https://github.com/VolodymyrBaydalka/docxjs)（内部で JSZip を使用）で各文書を描画し、**改ページ・ヘッダー／フッター・脚注・フォント・ページ寸法**を保持するため、本物の Word ページのように表示されます。バックエンドは軽量な Express（アップロード / 一覧 / クリア）。

- 📄 **高忠実度レンダリング** — docx-preview が実際のページ（サイズ・余白・ヘッダー／フッター・脚注・埋め込み画像とフォント）を組版。劣化する HTML 変換ではありません
- 📥 **ドラッグ＆ドロップ** — `.docx` をページ上にドロップ；**同名は上書き**
- 🔗 **ディープリンク** — `?docx=<パス>` で任意のファイルを開く（ビューア相対、または許可リストの絶対パス）；共有可・戻る／進む対応。堅牢なクエリ解析でファイル名中の `+`・空白・括弧・未エンコードの `&` にも対応
- 🌗 **ライト / ダーク**切替（localStorage 保存）——**外殻と文書「用紙」の両方がテーマに追従**（ダーク時はページも暗くなる）；印刷は常に白紙・黒字
- 🌐 **多言語 UI** — 繁體中文 / English / 日本語（既定は繁體中文、localStorage 保存）。文書の内容はデータであり**翻訳されません**
- 🛡️ **パス安全性** — `..`・バックスラッシュ・`javascript:` / `file:` スキーム・protocol-relative `//`・許可リスト外の絶対パスを遮断
- 🗂️ ファイル一覧サイドバー、元ファイルをダウンロード、フォルダを空にする

> サードパーティのフロントエンドライブラリ（jQuery、Materialize、Lodash、Material Icons、JSZip、docx-preview）は CDN から読み込み——バンドルもビルドも不要。`npm install` はバックエンド依存のみを取得します。

## クイックスタート

Node.js 18+ が必要です。

```bash
npm install
npm start
# http://localhost:3000/apps/docx-viewer/ を開く
```

ポート変更は `PORT`：`PORT=8080 npm start`。

## ディレクトリ構成

```
docx-viewer/
├── app.js                          # スタンドアロン Express サーバ（static + API 2 本）
├── package.json
├── routes/
│   ├── upload.js                   # POST /api/upload?folder=docx-viewer（multer・複数・上書き）
│   └── docx-viewer.js              # GET /files、POST /clear
└── public/
    ├── apps/docx-viewer/           # フロントエンド（/apps/docx-viewer/ で配信）
    │   ├── index.html              # 構造のみ
    │   ├── docx-viewer.css         # テーマ token（用紙 token 含む）+ ページスタイル
    │   ├── docx-viewer.js          # コントローラ（グルー）：テーマ / i18n / アップロード / docx-preview 描画
    │   ├── docx-viewer-lib.js      # DocxViewerLib：クエリ解析 / パス安全性 / サーバ通信（純ロジック・DOM 非依存）
    │   ├── materialize-dark.css    # ファミリー共有アセット（Materialize ダーク）
    │   ├── side-tool.css           # 右側フローティングツールバー
    │   ├── thinking-dot.css        # 共有ローディングドット utility
    │   ├── i18n.js                 # i18n エンジン
    │   └── locales/{zh-Hant,en,ja}.js
    └── upload/docx-viewer/         # アップロードされた文書（内容は git 管理外；サンプルを数点同梱）
```

## API

| Method / Path | 説明 |
|---|---|
| `POST /api/upload?folder=docx-viewer` | アップロード（form フィールド `myFiles`・複数；`folder` 指定時は元の名前を保持 → 上書き）|
| `GET /api/docx-viewer/files` | `public/upload/docx-viewer/` 内の可視ファイルを一覧（新しい順）|
| `POST /api/docx-viewer/clear` | そのフォルダ内の可視ファイルをすべて削除（フォルダと隠しファイルは保持）|

静的読み取り：`/upload/docx-viewer/<name>`。すべての API は `{ ok }` エンベロープ。

`GET /api/docx-viewer/files` の戻り値：

```jsonc
{
  "ok": true,
  "files": [
    { "name": "string", "size": 0, "mtime": 0 }   // mtime = epoch ms；新→旧でソート
  ]
}
```

## コアライブラリ（`DocxViewerLib`）

純ロジック・DOM 非依存で単体組み込み可能。実際の「`.docx → HTML`」描画は docx-preview（`window.docx.renderAsync`）が行い DOM に書き込むため、その呼び出しはライブラリではなくコントローラ側にあります。

ヘルパ：`parseQuery`（堅牢な `?docx=` 解析）、`isSafeLink`、`isUploadable`（`.docx`）、`basename`、`encodePath`（セグメント単位）、`fileUrl`、`fetchBlob`、`listFiles`、`uploadFile`、`clearFolder`、`formatSize`、`timestamp`。

## 備考

- フロントエンドは API を**絶対パス**（`/api/...`、`/upload/...`）で呼ぶため、本プロジェクトの Node サーバが**サイトルート**から配信する必要があります。**GitHub Pages 非対応**（静的ホスティングではアップロード / 一覧 / クリア API を実行できません）。
- 「ダーク用紙」は文書の背景と**継承された**テキストを再着色しますが、`.docx` 内で**明示的な色**を持つテキストはその色を保持し、暗いページ上でコントラストが低くなる場合があります。色指定に大きく依存する文書は、ライトに切り替えるか印刷（常に白紙）してください。
- 本アプリは **nodeapp WebApp ファミリー**に属します。共通規約は [nodeapp-webapp-family](https://github.com/scottgfhong310/nodeapp-webapp-family) を参照。

## ライセンス

[MIT](./LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
