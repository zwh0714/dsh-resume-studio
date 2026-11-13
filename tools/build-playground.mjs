/**
 * 把四个纯浏览器模块（model / templates / lint / render-html）打成一个
 * 自包含的在线试用页：docs/index.html
 *
 * 这四个文件都不 import Node 内置模块，因此可以直接在浏览器执行。
 * 构建方式是按依赖顺序拼接 + 去掉 import/export，产物零依赖、可离线打开，
 * 可直接由 GitHub Pages 从 /docs 提供。
 *
 * 产物与 Node 渲染器的逐字节一致性由 tools/verify-playground.mjs 校验。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const lib = path.join(root, 'lib')

// 依赖顺序：theme → locale → model → templates → lint → render-html
const ORDER = ['theme.js', 'locale.js', 'model.js', 'templates.js', 'lint.js', 'render-html.js']

function strip(src) {
  return src
    // 去掉 import 行（这些模块之间只互相引用，拼接后无意义）
    .replace(/^import\s+[^\n]*\n/gm, '')
    // 去掉 export 关键字，保留声明
    .replace(/^export\s+(const|function|class|async function)/gm, '$1')
}

function buildBundle() {
  const parts = []
  for (const f of ORDER) {
    const src = fs.readFileSync(path.join(lib, f), 'utf8')
    parts.push(`// ===== ${f} =====\n${strip(src).trim()}`)
  }
  return parts.join('\n\n')
}

const bundle = buildBundle()
const sample = fs.readFileSync(path.join(root, 'examples', 'zh-backend.json'), 'utf8')

const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>简历工坊 · 在线试用</title>
<meta name="description" content="粘贴 JSON 实时预览简历：三套版式、A4/Letter、自动压页、写作检查。无需安装。">
<style>
  :root {
    --bg: #f6f7f9;
    --panel: #fff;
    --line: #e3e6ea;
    --text: #1f2329;
    --muted: #6b7280;
    --accent: #1a5fb4;
    --ok: #2f6f4f;
    --warn: #a06000;
    --err: #b3261e;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font: 14px/1.6 -apple-system, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    color: var(--text); background: var(--bg); height: 100vh; display: flex; flex-direction: column;
  }
  header {
    padding: 14px 20px; background: var(--panel); border-bottom: 1px solid var(--line);
    display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
  }
  header h1 { font-size: 16px; font-weight: 700; }
  header .tag { color: var(--muted); font-size: 13px; }
  header .links { margin-left: auto; display: flex; gap: 12px; font-size: 13px; }
  header a { color: var(--accent); text-decoration: none; }
  header a:hover { text-decoration: underline; }

  .bar {
    padding: 10px 20px; background: var(--panel); border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .bar .group { display: flex; gap: 6px; align-items: center; }
  .bar label { color: var(--muted); font-size: 13px; }
  button {
    font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 6px;
    border: 1px solid var(--line); background: #fff; color: var(--text); cursor: pointer;
  }
  button:hover { border-color: var(--accent); color: var(--accent); }
  button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  select, input[type=number] {
    font: inherit; font-size: 13px; padding: 5px 8px; border-radius: 6px;
    border: 1px solid var(--line); background: #fff;
  }
  input[type=number] { width: 64px; }
  .swatches { display: inline-flex; gap: 4px; }
  .swatch {
    width: 20px; height: 20px; padding: 0; border-radius: 50%;
    border: 2px solid transparent; box-shadow: 0 0 0 1px var(--line) inset;
  }
  .swatch:hover { border-color: var(--muted); }
  .swatch.active { border-color: var(--text); }

  main { flex: 1; display: grid; grid-template-columns: minmax(280px, 1fr) minmax(320px, 1.15fr); gap: 1px; background: var(--line); overflow: hidden; }
  .pane { background: var(--panel); display: flex; flex-direction: column; overflow: hidden; }
  .pane > .hd {
    padding: 8px 14px; font-size: 12px; color: var(--muted); border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 8px;
  }
  textarea {
    flex: 1; width: 100%; border: 0; resize: none; padding: 14px;
    font: 12.5px/1.65 ui-monospace, "Cascadia Code", Consolas, monospace;
    color: var(--text); background: var(--panel); tab-size: 2;
  }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: -2px; }
  iframe { flex: 1; width: 100%; border: 0; background: #e9ebee; }

  #report {
    border-top: 1px solid var(--line); padding: 10px 14px; max-height: 168px; overflow: auto;
    font-size: 12.5px; background: var(--panel);
  }
  #report .sum { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 6px; color: var(--muted); }
  #report .sum b { color: var(--text); font-weight: 600; }
  #report ul { list-style: none; display: flex; flex-direction: column; gap: 3px; }
  #report li { display: flex; gap: 8px; align-items: baseline; }
  #report .lv { flex: none; width: 44px; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  #report .lv.error { color: var(--err); }
  #report .lv.warn { color: var(--warn); }
  #report .lv.info { color: var(--muted); }
  #report .where { color: var(--muted); flex: none; }
  #report .empty { color: var(--ok); }

  .toast {
    position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
    background: #1f2329; color: #fff; padding: 8px 16px; border-radius: 8px;
    font-size: 13px; opacity: 0; pointer-events: none; transition: opacity .18s;
  }
  .toast.show { opacity: 1; }

  @media (max-width: 860px) {
    main { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  }
</style>
</head>
<body>

<header>
  <h1>简历工坊</h1>
  <span class="tag">粘贴 JSON 实时预览简历：三套版式、主题微调、A4 / Letter、写作检查</span>
  <span class="links">
    <a href="https://github.com/zwh0714/dsh-resume-studio" target="_blank" rel="noopener">GitHub</a>
    <a href="https://github.com/deepseek-ai/deepseek-harness" target="_blank" rel="noopener">DeepSeek Harness</a>
  </span>
</header>

<div class="bar">
  <div class="group">
    <label>版式</label>
    <button data-tpl="classic" class="active">classic 经典蓝线</button>
    <button data-tpl="minimal">minimal 极简黑白</button>
    <button data-tpl="sidebar">sidebar 侧栏信息带</button>
  </div>
  <div class="group">
    <label>纸张</label>
    <select id="pageSize">
      <option value="A4">A4</option>
      <option value="Letter">Letter</option>
    </select>
    <label>页数</label>
    <input type="number" id="maxPages" min="1" max="5" value="2">
  </div>
  <div class="group">
    <label>主色</label>
    <span class="swatches" id="swatches">
      <button class="swatch" data-color="#1A5FB4" style="background:#1A5FB4" title="经典蓝"></button>
      <button class="swatch" data-color="#0F766E" style="background:#0F766E" title="墨青"></button>
      <button class="swatch" data-color="#8C2F39" style="background:#8C2F39" title="酒红"></button>
      <button class="swatch" data-color="#2F6F4F" style="background:#2F6F4F" title="松绿"></button>
      <button class="swatch" data-color="#5B4BB7" style="background:#5B4BB7" title="靛紫"></button>
      <button class="swatch" data-color="#111111" style="background:#111111" title="墨黑"></button>
    </span>
    <label>字号</label>
    <input type="number" id="bodySize" min="8" max="16" step="0.5" placeholder="默认">
    <label>分区</label>
    <select id="sectionStyle">
      <option value="">默认</option>
      <option value="rule">下划线</option>
      <option value="tracked">字距线</option>
      <option value="bar">竖线</option>
    </select>
    <button id="btnThemeReset">重置主题</button>
  </div>
  <div class="group" style="margin-left:auto">
    <button id="btnSample">载入示例</button>
    <button id="btnHtml">下载 HTML</button>
    <button id="btnPrint" class="primary">打印 / 存为 PDF</button>
  </div>
</div>

<main>
  <section class="pane">
    <div class="hd">简历 JSON（支持 <b>**加粗**</b>）；kind: timeline / project / list / paragraph，未知 kind 按结构自动识别</div>
    <textarea id="src" spellcheck="false" aria-label="简历 JSON"></textarea>
  </section>
  <section class="pane">
    <div class="hd">实时预览</div>
    <iframe id="preview" title="简历预览"></iframe>
    <div id="report"></div>
  </section>
</main>

<div class="toast" id="toast"></div>

<script>
// ============================================================================
// 以下为 lib/model.js · lib/templates.js · lib/lint.js · lib/render-html.js
// 的浏览器打包产物（tools/build-playground.mjs 生成，请勿手改）
// ============================================================================
${bundle}
// ============================================================================
// 页面逻辑
// ============================================================================
(function () {
  var SAMPLE = ${JSON.stringify(sample)};

  var src = document.getElementById('src');
  var preview = document.getElementById('preview');
  var report = document.getElementById('report');
  var maxPagesEl = document.getElementById('maxPages');
  var pageSizeEl = document.getElementById('pageSize');
  var bodySizeEl = document.getElementById('bodySize');
  var sectionStyleEl = document.getElementById('sectionStyle');
  var swatchesEl = document.getElementById('swatches');
  var toastEl = document.getElementById('toast');
  var currentTpl = 'classic';
  var currentAccent = '';
  var lastHtml = '';
  var timer = null;

  function theme() {
    var t = {};
    if (currentAccent) t.accent = currentAccent;
    var bs = parseFloat(bodySizeEl.value);
    if (bs > 0) t.bodySize = bs;
    if (sectionStyleEl.value) t.sectionStyle = sectionStyleEl.value;
    return Object.keys(t).length ? t : null;
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

  function parse() {
    var raw = src.value.trim();
    if (!raw) throw new Error('JSON 为空');
    var obj = JSON.parse(raw);
    obj.meta = obj.meta || {};
    obj.meta.template = currentTpl;
    obj.meta.pageSize = pageSizeEl.value;
    var mp = parseInt(maxPagesEl.value, 10);
    if (mp > 0) obj.meta.maxPages = mp;
    return normalize(obj);
  }

  function esc2(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderReport(stats, issues) {
    var out = [];
    out.push('<div class="sum">');
    out.push('<span>字数 <b>' + stats.chars + '</b></span>');
    out.push('<span>加粗占比 <b>' + Math.round(stats.boldRatio * 100) + '%</b></span>');
    out.push('<span>数字覆盖 <b>' + Math.round(stats.numberedRatio * 100) + '%</b></span>');
    out.push('<span>模块 <b>' + stats.sections + '</b></span>');
    out.push('</div>');

    if (!issues.length) {
      out.push('<div class="empty">检查通过，无提示项</div>');
    } else {
      out.push('<ul>');
      issues.forEach(function (i) {
        out.push(
          '<li><span class="lv ' + i.level + '">' + i.level + '</span>' +
          '<span class="where">' + esc2(i.where || i.rule) + '</span>' +
          '<span>' + esc2(i.message) + '</span></li>'
        );
      });
      out.push('</ul>');
    }
    report.innerHTML = out.join('');
  }

  function update() {
    try {
      var data = parse();
      var t = getTemplate(currentTpl, { pageSize: pageSizeEl.value, theme: theme() });
      lastHtml = renderHTML(data, t);
      preview.srcdoc = lastHtml;

      var res = lint(data, { pages: null, maxPages: parseInt(maxPagesEl.value, 10) || 0, compression: null });
      renderReport(res.stats, res.issues);
    } catch (e) {
      report.innerHTML = '<div class="empty" style="color:var(--err)">✗ ' + esc2(e.message) + '</div>';
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(update, 220);
  }

  src.addEventListener('input', schedule);
  maxPagesEl.addEventListener('input', schedule);
  pageSizeEl.addEventListener('change', update);
  bodySizeEl.addEventListener('input', schedule);
  sectionStyleEl.addEventListener('change', update);

  Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (btn) {
    btn.addEventListener('click', function () {
      var c = btn.getAttribute('data-color');
      currentAccent = currentAccent === c ? '' : c;
      Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (b) {
        b.classList.toggle('active', b.getAttribute('data-color') === currentAccent);
      });
      update();
    });
  });

  document.getElementById('btnThemeReset').addEventListener('click', function () {
    currentAccent = '';
    bodySizeEl.value = '';
    sectionStyleEl.value = '';
    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (b) {
      b.classList.remove('active');
    });
    update();
    toast('主题已重置');
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-tpl]'), function (btn) {
    btn.addEventListener('click', function () {
      currentTpl = btn.getAttribute('data-tpl');
      Array.prototype.forEach.call(document.querySelectorAll('[data-tpl]'), function (b) {
        b.classList.toggle('active', b === btn);
      });
      update();
    });
  });

  document.getElementById('btnSample').addEventListener('click', function () {
    src.value = SAMPLE;
    update();
    toast('已载入示例');
  });

  document.getElementById('btnHtml').addEventListener('click', function () {
    if (!lastHtml) return toast('还没有可下载的内容');
    var name = 'resume-' + currentTpl + '.html';
    var blob = new Blob([lastHtml], { type: 'text/html;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('已下载 ' + name);
  });

  document.getElementById('btnPrint').addEventListener('click', function () {
    var win = preview.contentWindow;
    if (!win) return toast('预览尚未就绪');
    win.focus();
    win.print();
  });

  src.value = SAMPLE;
  update();
})();
</script>
</body>
</html>
`

const outDir = path.join(root, 'docs')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'index.html')
fs.writeFileSync(outFile, page, 'utf8')
console.log('built', outFile, fs.statSync(outFile).size, 'bytes')
