/**
 * DocxViewerLib — docx-viewer 前端核心 library（可嵌入式、純邏輯、不碰 DOM）
 *
 * 把「query string 解析」「路徑安全檢查 / 逐段編碼」「與伺服器溝通」
 * 「檔名 / 時間戳工具」等可重用邏輯抽成一支 library；
 * index.html / docx-viewer.js 只負責 DOM（呼叫 docx-preview 渲染、事件繫結、toast）。
 *
 * 設計重點：
 *   - 真正的「.docx → HTML」由 docx-preview（window.docx.renderAsync）完成，但它**直接寫 DOM**，
 *     因此渲染呼叫留在控制器 docx-viewer.js；本 lib 只裝「離開畫面仍成立」的純邏輯。
 *   - 開檔來源有二：①側欄清單（上傳進來的檔）②網址深連結 ?docx=<路徑>。
 *     深連結沿用原型的穩健解析：避開 URLSearchParams 把 '+' 變空白、容忍檔名含未編碼 '&'。
 *
 * 後端對應：
 *   - 上傳： POST /api/upload?folder=docx-viewer   （form 欄位 myFiles，多檔）
 *   - 列表： GET  /api/docx-viewer/files
 *   - 清空： POST /api/docx-viewer/clear
 *   - 靜態讀檔： /upload/docx-viewer/<name>
 *
 * 依賴：無（原生 fetch / URL / location）。建議與 jQuery / Materialize / Lodash 一起載入。
 *
 * Public API：
 *   DocxViewerLib.FOLDER                    → 'docx-viewer'
 *   DocxViewerLib.ALLOWED_ABSOLUTE_PREFIXES → string[]   放行的絕對路徑前綴
 *   DocxViewerLib.escapeHtml(s)             → string
 *   DocxViewerLib.parseQuery(search)        → { docx?:string, ... }  穩健解析 ?docx=
 *   DocxViewerLib.isSafeLink(link)          → boolean    擋 ../ \ protocol // 及非白名單絕對路徑
 *   DocxViewerLib.isUploadable(name)        → boolean    是否為 .docx
 *   DocxViewerLib.basename(link)            → string     取末段、解碼、去 query
 *   DocxViewerLib.encodePath(link)          → string     逐段 encodeURIComponent，保留 '/'
 *   DocxViewerLib.fileUrl(name)             → string     /upload/docx-viewer/<name>（原始、未編碼）
 *   DocxViewerLib.fetchBlob(link)           → Promise<Blob>   讀檔（自動逐段編碼 + cache-bust）
 *   DocxViewerLib.uploadFile(file)          → Promise<resp>
 *   DocxViewerLib.listFiles()               → Promise<Array<{name,size,mtime}>>
 *   DocxViewerLib.clearFolder()             → Promise<{ok,removed}>
 *   DocxViewerLib.timestamp(date)           → 'yyyyMMddHHmmss'
 *   DocxViewerLib.formatSize(bytes)         → 'xx KB'
 */
(function (window) {
  'use strict';

  var FOLDER = 'docx-viewer';
  var UPLOAD_API = '/api/upload?folder=' + FOLDER;
  var FILES_API = '/api/docx-viewer/files';
  var CLEAR_API = '/api/docx-viewer/clear';
  var STATIC_BASE = '/upload/' + FOLDER + '/';

  // 絕對路徑（開頭 /）只放行這些前綴；相對路徑（無開頭 /）一律相對 viewer 自身目錄、預設允許。
  // 要再開放其他資料夾就往這裡加前綴。
  var ALLOWED_ABSOLUTE_PREFIXES = [
    STATIC_BASE   // '/upload/docx-viewer/' — 上傳進來的檔
  ];

  // 可上傳 / 可檢視的副檔名
  var UPLOADABLE_RE = /\.docx$/i;

  function pad2(n) { return ('0' + n).slice(-2); }

  // 加上 cache-busting query，確保每次都讀到伺服器最新內容（上傳同名覆寫後）
  function bust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 穩健解析 query string（取代 URLSearchParams）：
  //  1) URLSearchParams 會把 '+' 變空白，檔名含 '+' 時會壞；故自行解析。
  //  2) 檔名可能含未編碼的 '&'（如 "Books & Scores.docx"），所以遇到開頭即 docx= 時
  //     把後面整段當成 value，不再依 '&' 切割。
  function parseQuery(search) {
    var out = {};
    var s = String(search || '');
    if (s.charAt(0) === '?') s = s.slice(1);
    if (!s) return out;
    if (s.indexOf('docx=') === 0) {
      var v = s.slice('docx='.length);
      try { out.docx = decodeURIComponent(v); } catch (e) { out.docx = v; }
      return out;
    }
    s.split('&').forEach(function (pair) {
      if (!pair) return;
      var i = pair.indexOf('=');
      var k = i === -1 ? pair : pair.slice(0, i);
      var val = i === -1 ? '' : pair.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(val); }
      catch (e) { out[k] = val; }
    });
    return out;
  }

  // 路徑安全：擋穿越（..）、反斜線、任意 scheme（http:/file:/javascript:）、protocol-relative（//）；
  // 絕對路徑須命中允許清單，相對路徑（相對 viewer 目錄）一律放行。
  function isSafeLink(link) {
    if (!link || typeof link !== 'string') return false;
    if (link.indexOf('..') !== -1) return false;
    if (link.charAt(0) === '\\') return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return false; // 拒絕 http: / file: / javascript: 等
    if (link.indexOf('//') === 0) return false;          // protocol-relative
    if (link.charAt(0) === '/') {
      return ALLOWED_ABSOLUTE_PREFIXES.some(function (p) { return link.indexOf(p) === 0; });
    }
    return true; // 相對 viewer 目錄
  }

  function isUploadable(name) {
    return UPLOADABLE_RE.test(String(name || ''));
  }

  // 由連結推出顯示用檔名（取末段、解碼、去掉 query）
  function basename(link) {
    var seg = String(link || '').split('?')[0].split('/').pop();
    try { seg = decodeURIComponent(seg); } catch (e) {}
    return seg || String(link || '');
  }

  // 逐段 encodeURIComponent，保留 '/' 分隔（檔名含空白 / '+' / '&' / 括號時仍可正確 fetch / 下載）。
  // 已編碼的字串重編碼會雙重編碼，故只對「原始（解碼後）」路徑使用。
  function encodePath(link) {
    return String(link || '').split('/').map(encodeURIComponent).join('/');
  }

  // 上傳檔的原始（未編碼）靜態路徑；要 fetch / 下載時再經 encodePath。
  function fileUrl(name) {
    return STATIC_BASE + name;
  }

  var DocxViewerLib = {

    FOLDER: FOLDER,
    ALLOWED_ABSOLUTE_PREFIXES: ALLOWED_ABSOLUTE_PREFIXES,

    escapeHtml: escapeHtml,
    parseQuery: parseQuery,
    isSafeLink: isSafeLink,
    isUploadable: isUploadable,
    basename: basename,
    encodePath: encodePath,
    fileUrl: fileUrl,

    /** 上傳單一檔案到 /upload/docx-viewer（同名覆寫）。回傳伺服器 JSON；失敗 reject。 */
    uploadFile: function (file) {
      var fd = new FormData();
      fd.append('myFiles', file);
      return fetch(UPLOAD_API, { method: 'POST', body: fd })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (resp) {
          if (!resp || !resp.ok) throw new Error((resp && resp.error) || '上傳失敗');
          return resp;
        });
    },

    /** 列出資料夾內檔案（依修改時間新→舊） */
    listFiles: function () {
      return fetch(bust(FILES_API), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('列表載入失敗 (' + r.status + ')');
          return r.json();
        })
        .then(function (d) { return (d && d.files) || []; });
    },

    /** 清空資料夾下所有可見檔案 */
    clearFolder: function () {
      return fetch(CLEAR_API, { method: 'POST' })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error((d && d.error) || '清空失敗');
          return d;
        });
    },

    /** 讀取連結（相對 viewer 目錄或白名單絕對路徑）的二進位內容供 docx-preview 渲染 */
    fetchBlob: function (link) {
      return fetch(bust(encodePath(link)), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.blob();
        });
    },

    /** 本地時間 yyyyMMddHHmmss */
    timestamp: function (date) {
      var d = date || new Date();
      return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
        pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    },

    /** 人類可讀的檔案大小 */
    formatSize: function (bytes) {
      bytes = Number(bytes) || 0;
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }
  };

  window.DocxViewerLib = DocxViewerLib;
})(window);
