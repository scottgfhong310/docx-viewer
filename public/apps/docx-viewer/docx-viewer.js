/**
 * docx-viewer — 頁面控制器（glue）
 *
 * DOM 行為：主題切換、i18n（透過 I18n 引擎）、開檔（?docx= 或側欄清單）、
 * 上傳 / 拖拉 / 清空、呼叫 docx-preview 把 .docx 渲染進 #dv-container。
 * query 解析、路徑安全 / 編碼、與伺服器溝通在 docx-viewer-lib.js；
 * i18n 引擎在 i18n.js，語言字典在 locales/<code>.js。
 *
 * 依賴（皆於 index.html 先載入）：jQuery / Materialize / Lodash / JSZip / docx-preview
 *   / DocxViewerLib / I18n（+ locales）。
 *
 * 註：docx-preview（window.docx.renderAsync）會**直接寫 DOM**，故渲染呼叫留在這裡（非 lib）。
 *     輸出在 light DOM，受本頁 CSS 影響——深色主題下「紙張」由 docx-viewer.css 重新著色，
 *     切主題只翻 data-theme、不必重新渲染。
 */

(function () {
  'use strict';

  var L = window.DocxViewerLib;
  var THEME_KEY = 'docx-viewer-theme';
  // 語系由 I18n 引擎管理（localStorage 'lang'，預設 zh-Hant），不再自行保存。

  var emptyState = document.getElementById('empty-state');
  var docBox = document.getElementById('dv-doc');
  var container = document.getElementById('dv-container');
  var docName = document.getElementById('dv-doc-name');
  var docOpen = document.getElementById('dv-doc-open');
  var sideNav = document.getElementById('side-nav');
  var dropOverlay = document.getElementById('drop-overlay');
  var filePicker = document.getElementById('file-picker');

  var state = {
    theme: 'dark',
    current: null,   // 目前開啟的連結（原始 / 解碼後：相對或白名單絕對路徑）
    name: '',        // 顯示用檔名
    files: []
  };

  // docx-preview 渲染選項（沿用原型：高保真分頁 / 頁首頁尾 / 註腳 / 字型）
  var RENDER_OPTS = {
    className: 'docx',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    experimental: false,
    trimXmlDeclaration: true,
    useBase64URL: false,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true
  };

  /* ---------- 主題（light / dark） ---------- */

  function applyTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    state.theme = theme;
    var r = document.documentElement;
    r.setAttribute('data-theme', theme);
    r.classList.toggle('dark-mode', theme === 'dark');
    r.classList.toggle('light-mode', theme === 'light');
    var icon = document.querySelector('#setting-mode i');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function toggleTheme() {
    // 紙張著色由 CSS 依 data-theme 切換（docx 輸出在 light DOM）；不必重新渲染。
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  /* ---------- 顯示切換 ---------- */

  function showDoc(show) {
    // #dv-doc 預設 CSS 為 display:none，故顯示時要給明確值（設 '' 會落回 CSS 的 none）
    docBox.style.display = show ? 'block' : 'none';
    emptyState.style.display = show ? 'none' : '';
    document.body.classList.toggle('is-empty', !show);
  }

  /* ---------- loading 動畫 ---------- */
  var loadingTimer = null;
  function showLoading() {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(function () {
      var el = document.getElementById('loading');
      if (el) el.classList.add('show');
    }, 180);
  }
  function hideLoading() {
    clearTimeout(loadingTimer);
    var el = document.getElementById('loading');
    if (el) el.classList.remove('show');
  }

  /* ---------- 開檔 / 渲染 ---------- */

  // 載入並渲染某連結（不改 URL）。link：相對 viewer 目錄或白名單絕對路徑（原始 / 解碼後）。
  function loadAndShow(link, displayName) {
    if (!L.isSafeLink(link)) {
      state.current = null; state.name = '';
      M.toast({ html: I18n.t('toast.badLink'), classes: 'red' });
      showDoc(false);
      return Promise.resolve();
    }
    if (!window.docx || typeof window.docx.renderAsync !== 'function') {
      M.toast({ html: I18n.t('toast.engineMissing'), classes: 'red' });
      return Promise.resolve();
    }
    state.current = link;
    state.name = displayName || L.basename(link);
    document.title = state.name + ' | ' + I18n.t('title.suffix');
    docName.textContent = state.name;
    docName.title = state.name;
    markActive(link);
    showDoc(true);
    showLoading();
    // 下載原始檔：逐段編碼的 href + 原檔名 download
    docOpen.href = L.encodePath(link);
    docOpen.setAttribute('download', state.name);
    container.innerHTML = '';   // 切檔時清掉前一份輸出，避免堆疊
    return L.fetchBlob(link)
      .then(function (blob) {
        return window.docx.renderAsync(blob, container, null, RENDER_OPTS);
      })
      .catch(function (err) {
        container.innerHTML = '';
        M.toast({ html: I18n.t('toast.loadFail', { n: state.name, m: err.message }), classes: 'red' });
        showDoc(false);
      })
      .then(function () { hideLoading(); });
  }

  // 點擊側欄 / 開檔時：更新 URL（可分享、可上一頁）再載入
  function navigate(link, displayName) {
    try {
      history.pushState({ link: link }, '', '?docx=' + encodeURIComponent(link));
    } catch (e) {}
    loadAndShow(link, displayName);
  }

  /* ---------- 檔案清單 ---------- */

  function markActive(link) {
    $('#side-nav li').removeClass('active');
    if (!link) return;
    var esc = window.CSS && CSS.escape ? CSS.escape(link) : link;
    $('#side-nav li[data-link="' + esc + '"]').addClass('active');
  }

  function renderSideNav(files) {
    if (!files.length) {
      sideNav.innerHTML = '<li><a style="color:var(--muted)!important;">' + I18n.t('side.noFiles') + '</a></li>';
      return;
    }
    sideNav.innerHTML = files.map(function (f) {
      var link = L.fileUrl(f.name);   // 原始（未編碼）路徑，與 state.current 比對用
      return '<li data-link="' + _.escape(link) + '">' +
        '<a href="#!" class="file-item" data-name="' + _.escape(f.name) + '">' +
        '<i class="material-icons">description</i>' +
        '<span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _.escape(f.name) + '</span>' +
        '<span class="file-meta">' + L.formatSize(f.size) + '</span>' +
        '</a></li>';
    }).join('');
    markActive(state.current);
  }

  // 重新抓清單。selectName：上傳/清空後想自動開的檔名；autoOpen：清單非空且目前沒開檔時自動開最新一筆。
  function refreshFiles(selectName, autoOpen) {
    return L.listFiles().then(function (files) {
      state.files = files;
      renderSideNav(files);
      if (selectName) {
        var hit = files.filter(function (f) { return f.name === selectName; })[0];
        if (hit) return navigate(L.fileUrl(hit.name), hit.name);
      }
      if (autoOpen && !state.current && files.length) {
        return loadAndShow(L.fileUrl(files[0].name), files[0].name);
      }
    }).catch(function (err) {
      M.toast({ html: I18n.t('toast.listFail', { m: err.message }), classes: 'red' });
    });
  }

  /* ---------- 上傳 ---------- */

  function uploadFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList).filter(function (f) { return L.isUploadable(f.name); });
    if (!arr.length) {
      M.toast({ html: I18n.t('toast.notDocx'), classes: 'orange' });
      return;
    }
    var lastName = null;
    var chain = Promise.resolve();
    arr.forEach(function (file) {
      chain = chain.then(function () {
        return L.uploadFile(file).then(function () {
          lastName = file.name;
          M.toast({ html: I18n.t('toast.uploaded', { n: file.name }), classes: 'green' });
        }).catch(function (err) {
          M.toast({ html: I18n.t('toast.uploadFail', { n: file.name, m: err.message }), classes: 'red' });
        });
      });
    });
    chain.then(function () { return refreshFiles(lastName); });
  }

  /* ---------- 清空 ---------- */

  function clearFolder() {
    if (!confirm(I18n.t('confirm.clear'))) return;
    L.clearFolder().then(function (d) {
      M.toast({ html: I18n.t('toast.cleared', { n: d.removed || 0 }), classes: 'teal' });
      state.current = null; state.name = '';
      container.innerHTML = '';
      try { history.replaceState({}, '', './'); } catch (e) {}
      showDoc(false);
      document.title = I18n.t('title.suffix');
      return refreshFiles();
    }).catch(function (err) {
      M.toast({ html: I18n.t('toast.clearFail', { m: err.message }), classes: 'red' });
    });
  }

  /* ---------- 全頁拖拉 ---------- */

  function hasFiles(e) {
    var dt = e.dataTransfer;
    if (!dt || !dt.types) return false;
    for (var i = 0; i < dt.types.length; i++) if (dt.types[i] === 'Files') return true;
    return false;
  }

  function bindDragDrop() {
    var depth = 0;
    window.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth++; dropOverlay.classList.add('show');
    });
    window.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', function (e) {
      if (!hasFiles(e)) return;
      depth--; if (depth <= 0) { depth = 0; dropOverlay.classList.remove('show'); }
    });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; dropOverlay.classList.remove('show');
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) uploadFiles(dt.files);
    });
  }

  /* ---------- 語系（i18n） ---------- */

  function cycleLang() {
    var langs = I18n.langs;
    var i = langs.indexOf(I18n.lang);
    I18n.set(langs[(i + 1) % langs.length]);
    M.toast({ html: I18n.name(I18n.lang) });
  }

  function onLangChanged() {
    renderSideNav(state.files);   // 「尚無檔案」訊息隨語系
    document.title = state.current
      ? (state.name + ' | ' + I18n.t('title.suffix'))
      : I18n.t('title.suffix');
    // 文件內容是 data，永不翻譯，也不重新渲染。
  }

  /* ---------- 事件繫結 ---------- */

  function deepLink() {
    return L.parseQuery(location.search).docx || '';
  }

  function bindEvents() {
    // 側欄檔案點擊
    $(document).on('click', '#side-nav a.file-item', function (e) {
      e.preventDefault();
      var name = String($(this).data('name'));
      navigate(L.fileUrl(name), name);
      var inst = M.Sidenav.getInstance(document.getElementById('slide-out'));
      if (inst && inst.isOpen) inst.close();
    });

    // 空狀態 / 檔案選擇器
    emptyState.addEventListener('click', function () { filePicker.click(); });
    filePicker.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) uploadFiles(e.target.files);
      filePicker.value = '';
    });

    // 右側工具列
    document.getElementById('setting-menu').addEventListener('click', function () {
      var inst = M.Sidenav.getInstance(document.getElementById('slide-out'));
      if (inst) inst.open();
    });
    document.getElementById('setting-mode').addEventListener('click', toggleTheme);
    document.getElementById('setting-lang').addEventListener('click', cycleLang);
    document.getElementById('setting-clear').addEventListener('click', clearFolder);

    // 上一頁／下一頁：依 ?docx 重新載入
    window.addEventListener('popstate', function () {
      var link = deepLink();
      if (link) { loadAndShow(link); }
      else { state.current = null; state.name = ''; container.innerHTML = ''; showDoc(false); document.title = I18n.t('title.suffix'); markActive(null); }
    });
  }

  /* ---------- 初始化 ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    M.Sidenav.init(document.querySelectorAll('.sidenav'), {
      edge: 'right',
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseEnd: function () { document.body.classList.remove('sidenav-open'); }
    });

    var saved = 'dark';
    try { saved = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
    applyTheme(saved === 'light' ? 'light' : 'dark');

    // i18n：套用靜態文字 / 標題（引擎自解析初始語系：?lang → localStorage('lang') → 瀏覽器 → zh-Hant）
    I18n.apply(document);
    document.addEventListener('i18n:changed', onLangChanged);
    document.title = I18n.t('title.suffix');

    bindEvents();
    bindDragDrop();

    // ?docx= 指定檔 → 直接載入（清單照樣抓來填側欄、標記 active；param 載入優先，不自動開最新）。
    // 沒有 param → 抓清單，有檔就自動開最新一筆，沒檔就停在空狀態。
    var param = deepLink();
    if (param) {
      loadAndShow(param);
      refreshFiles(null, false);
    } else {
      refreshFiles(null, true);
    }
  });
})();
