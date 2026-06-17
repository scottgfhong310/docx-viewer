/**
 * docx-viewer — 獨立執行的 Express 伺服器
 *
 * 提供：
 *   - 靜態檔（public/）→ 應用在 /apps/docx-viewer/
 *   - 上傳 API：/api/upload?folder=docx-viewer（routes/upload.js）
 *   - 列表 / 清空 API：/api/docx-viewer（routes/docx-viewer.js）
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/docx-viewer/
 */

const express = require('express');
const path = require('path');
const logger = require('morgan');

const uploadRouter = require('./routes/upload');
const docxViewerRouter = require('./routes/docx-viewer');

const app = express();

app.use(logger('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/upload', uploadRouter);
app.use('/api/docx-viewer', docxViewerRouter);

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/docx-viewer/'));

// 404（API 回 JSON，其餘回純文字）
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).type('text/plain').send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`docx-viewer →  http://localhost:${PORT}/apps/docx-viewer/`);
});
