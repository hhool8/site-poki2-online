#!/usr/bin/env node
/**
 * Convert a hand-written HTML report into clean Markdown.
 *
 * WHY THIS EXISTS
 * The repo's working documents (audit reports, backlink plans, coverage
 * diagnostics) used to live as standalone HTML files. That was a trap: HTML
 * in a git repo reads like a finished deliverable, it cannot be reviewed in a
 * diff, and its rendered styling silently hides content changes from anyone
 * reading the repo as text. Every intermediate analysis file in this project
 * is Markdown from now on.
 *
 * The legacy reports were produced by hand (or by a visual editor), not by a
 * build step, so there is no generator to change -- there is only the stored
 * artefact to convert. This script does that conversion losslessly enough to
 * keep the reports useful: headings stay headings, tables stay tables, lists
 * stay lists, and inline code stays inline code.
 *
 * USAGE
 *   node scripts/html-to-markdown.js <input.html> <output.md>
 *
 * It is deliberately dependency-free, like the rest of the build system.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VOID = new Set([
  'br', 'hr', 'img', 'meta', 'link', 'input', 'source', 'area', 'base',
  'col', 'embed', 'param', 'track', 'wbr',
]);

const BLOCK = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'blockquote', 'pre', 'section', 'article',
  'header', 'footer', 'main', 'figure', 'figcaption', 'dl', 'dt', 'dd',
]);

/** Tags that flow inside a line of text rather than starting a new block. */
const INLINE = new Set([
  'span', 'strong', 'b', 'em', 'i', 'code', 'a', 'small', 'sup', 'sub',
  'mark', 'br', 'abbr', 'q', 'cite', 'time', 'kbd', 'samp', 'var',
]);

/** Sentinel for a <br> so it survives whitespace normalisation. */
const BR = '\u0000';

/* ---------------------------------------------------------------- parsing */

function decodeEntities(text) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7',
    times: '\u00d7', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c',
    rdquo: '\u201d', bull: '\u2022', copy: '\u00a9', reg: '\u00ae',
    trade: '\u2122', deg: '\u00b0', laquo: '\u00ab', raquo: '\u00bb',
    eacute: '\u00e9', egrave: '\u00e8', uuml: '\u00fc', ouml: '\u00f6',
    auml: '\u00e4', ccedil: '\u00e7', ntilde: '\u00f1', aring: '\u00e5',
    shy: '', zwnj: '', zwj: '', sol: '/', verbar: '|', percnt: '%',
  };
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    const key = body.toLowerCase();
    return Object.prototype.hasOwnProperty.call(named, key) ? named[key] : m;
  });
}

function parseAttrs(raw) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
    attrs[name] = value === undefined ? '' : decodeEntities(value);
  }
  return attrs;
}

/**
 * Minimal, forgiving HTML parser. Builds a tree of
 * { type:'el', tag, attrs, children } / { type:'text', value } nodes.
 */
function parseHTML(html) {
  const root = { type: 'root', children: [] };
  const stack = [root];
  let i = 0;
  let text = '';

  const flush = () => {
    if (text) {
      stack[stack.length - 1].children.push({ type: 'text', value: text });
      text = '';
    }
  };

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      text += html.slice(i);
      break;
    }
    text += html.slice(i, lt);

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const gt = html.indexOf('>', lt);
    if (gt === -1) {
      text += html.slice(lt);
      break;
    }

    const raw = html.slice(lt + 1, gt).trim();

    if (raw[0] === '/') {
      flush();
      const tag = raw.slice(1).split(/[\s/]/)[0].toLowerCase();
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].tag === tag) {
          stack.length = s;
          break;
        }
      }
      i = gt + 1;
      continue;
    }

    const selfClosing = raw.endsWith('/');
    const inner = selfClosing ? raw.slice(0, -1) : raw;
    const nameMatch = /^([a-zA-Z][a-zA-Z0-9-]*)/.exec(inner);
    if (!nameMatch) {
      i = gt + 1;
      continue;
    }

    flush();
    const tag = nameMatch[1].toLowerCase();
    const attrs = parseAttrs(inner.slice(nameMatch[1].length));
    const node = { type: 'el', tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && !VOID.has(tag)) stack.push(node);
    i = gt + 1;
  }

  flush();
  return root;
}

/* -------------------------------------------------------------- rendering */

function classList(node) {
  return (node.attrs.class || '').split(/\s+/).filter(Boolean);
}

function hasClass(node, name) {
  return classList(node).includes(name);
}

/** Collapse every whitespace run to a single space. */
function squish(text) {
  return text.replace(/\s+/g, ' ');
}

function inlineCode(text) {
  const fence = text.includes('`') ? '``' : '`';
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

/**
 * Render the inline children of a node into a single Markdown string.
 * Whitespace in source text nodes is normalised; <br> survives as BR.
 */
function renderInline(node, opts = {}) {
  let out = '';

  for (const child of node.children || []) {
    if (child.type === 'text') {
      out += squish(decodeEntities(child.value));
      continue;
    }

    const tag = child.tag;
    const classes = classList(child);

    if (classes.includes('dot')) continue; // decorative status dot

    if (tag === 'br') {
      out += BR;
      continue;
    }
    if (tag === 'code' || classes.includes('mono')) {
      const text = squish(renderPlain(child)).trim();
      if (!text) continue;
      out += inlineCode(text);
      continue;
    }
    if (tag === 'strong' || tag === 'b') {
      const text = squish(renderInline(child, opts)).trim();
      out += text ? `**${text}**` : '';
      continue;
    }
    if (tag === 'em' || tag === 'i') {
      const text = squish(renderInline(child, opts)).trim();
      out += text ? `*${text}*` : '';
      continue;
    }
    if (tag === 'a') {
      const text = squish(renderInline(child, opts)).trim();
      const href = (child.attrs.href || '').trim();
      out += href && !href.startsWith('#') ? `[${text || href}](${href})` : text;
      continue;
    }
    if (tag === 'span' && (classes.includes('badge') || classes.includes('tag'))) {
      const text = squish(renderInline(child, opts)).trim();
      out += text ? inlineCode(text) : '';
      continue;
    }
    if (BLOCK.has(tag)) {
      // A block element dropped inside inline flow: keep its text.
      out += squish(renderInline(child, opts));
      continue;
    }
    out += renderInline(child, opts);
  }

  return out;
}

/** Plain text of a node, ignoring markup. */
function renderPlain(node) {
  let out = '';
  for (const child of node.children || []) {
    if (child.type === 'text') {
      out += decodeEntities(child.value);
    } else if (child.tag === 'br') {
      out += ' ';
    } else {
      out += renderPlain(child);
    }
  }
  return out;
}

/**
 * Turn an inline string into paragraph text: <br> becomes a Markdown hard
 * break ("  \n"), everything else is squished onto single lines.
 */
function toParagraph(inline) {
  return inline
    .split(BR)
    .map((part) => squish(part).trim())
    .filter((part, index, arr) => part !== '' || (index > 0 && index < arr.length - 1))
    .join('  \n');
}

function tableToMarkdown(table) {
  const rows = [];
  const walk = (node) => {
    for (const child of node.children || []) {
      if (child.type !== 'el') continue;
      if (child.tag === 'tr') {
        const cells = (child.children || []).filter((c) => c.type === 'el' && (c.tag === 'td' || c.tag === 'th'));
        rows.push({
          header: cells.length > 0 && cells.every((c) => c.tag === 'th'),
          cells: cells.map((c) => ({
            colspan: Math.max(1, parseInt(c.attrs.colspan, 10) || 1),
            text: squish(renderInline(c)).replace(new RegExp(BR, 'g'), '<br>').trim(),
          })),
        });
      } else {
        walk(child);
      }
    }
  };
  walk(table);

  if (!rows.length) return [];

  const width = rows.reduce((max, row) => Math.max(max, row.cells.reduce((n, c) => n + c.colspan, 0)), 0);
  const expand = (row) => {
    const out = [];
    for (const cell of row.cells) {
      out.push(cell.text.replace(/\|/g, '\\|'));
      for (let k = 1; k < cell.colspan; k++) out.push('');
    }
    while (out.length < width) out.push('');
    return out;
  };

  const emit = (cells) => `| ${cells.join(' | ')} |`;
  const lines = [emit(expand(rows[0])), `| ${new Array(width).fill('---').join(' | ')} |`];
  for (let i = 1; i < rows.length; i++) lines.push(emit(expand(rows[i])));

  return lines;
}

function renderList(list, depth, out) {
  const ordered = list.tag === 'ol';
  const items = (list.children || []).filter((c) => c.type === 'el' && c.tag === 'li');
  const indent = '  '.repeat(depth);

  items.forEach((li, index) => {
    let head = '';
    for (const child of li.children || []) {
      if (child.type === 'el' && (child.tag === 'ul' || child.tag === 'ol')) break;
      head += child.type === 'text' ? child.value : renderInline({ children: [child] });
    }
    const headText = toParagraph(head);
    if (headText) out.push(`${indent}${ordered ? `${index + 1}.` : '-'} ${headText.replace(/\n/g, ' ')}`);

    for (const child of li.children || []) {
      if (child.type === 'el' && (child.tag === 'ul' || child.tag === 'ol')) {
        renderList(child, depth + 1, out);
      } else if (child.type === 'el' && child.tag === 'p') {
        const text = toParagraph(renderInline(child));
        if (text) out.push(`${indent}  ${text.replace(/\n/g, ' ')}`);
      }
    }
  });
}

/** Find a descendant with the given tag. */
function findTag(node, tag) {
  for (const child of node.children || []) {
    if (child.type !== 'el') continue;
    if (child.tag === tag) return child;
    const found = findTag(child, tag);
    if (found) return found;
  }
  return null;
}

/**
 * Render a container's children as blocks. Mixed content (text runs interleaved
 * with nested block elements) is split into paragraphs at the block boundaries,
 * which is how a browser would break it into anonymous blocks.
 */
function renderContainer(node) {
  const out = [];
  let run = [];

  const flushRun = () => {
    if (!run.length) return;
    const text = toParagraph(renderInline({ children: run }));
    if (text) out.push(text);
    run = [];
  };

  for (const child of node.children || []) {
    if (child.type === 'text' || (child.type === 'el' && !BLOCK.has(child.tag))) {
      run.push(child);
      continue;
    }
    flushRun();
    out.push(...renderBlocks({ children: [child] }));
  }
  flushRun();

  return out;
}

/**
 * Render a node's children as a list of Markdown block strings.
 */
function renderBlocks(node) {
  const out = [];

  for (const child of node.children || []) {
    if (child.type === 'text') {
      const text = toParagraph(renderInline({ children: [child] }));
      if (text) out.push(text);
      continue;
    }

    const tag = child.tag;
    const classes = classList(child);

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag[1]);
      const text = squish(renderInline(child)).trim();
      if (text) out.push(`${'#'.repeat(level)} ${text}`);
      continue;
    }

    if (tag === 'p') {
      const text = toParagraph(renderInline(child));
      if (text) out.push(text);
      continue;
    }

    if (tag === 'table') {
      out.push(...tableToMarkdown(child));
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const lines = [];
      renderList(child, 0, lines);
      out.push(...lines);
      continue;
    }

    if (tag === 'blockquote') {
      const inner = renderBlocks(child).join('\n\n');
      out.push(inner.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n'));
      continue;
    }

    if (tag === 'pre') {
      const code = renderPlain(child);
      out.push('```\n' + code.replace(/\n+$/, '') + '\n```');
      continue;
    }

    if (tag === 'hr') {
      out.push('---');
      continue;
    }

    // ---- styled containers ---------------------------------------------
    if (classes.includes('summary-grid') || classes.includes('cards')) {
      const cards = (child.children || []).filter((c) => c.type === 'el' && (hasClass(c, 'stat-card') || hasClass(c, 'card')));
      if (cards.length) {
        const lines = ['| Metric | Value |', '| --- | --- |'];
        for (const card of cards) {
          const num = (card.children || []).find((c) => c.type === 'el' && (hasClass(c, 'stat-num') || hasClass(c, 'num')));
          const lbl = (card.children || []).find((c) => c.type === 'el' && (hasClass(c, 'stat-label') || hasClass(c, 'lbl')));
          const value = num ? squish(renderPlain(num)).trim() : '';
          const label = lbl ? squish(renderPlain(lbl)).trim() : '';
          if (label || value) lines.push(`| ${label.replace(/\|/g, '\\|')} | ${value} |`);
        }
        out.push(...lines);
        continue;
      }
    }

    if (hasClass(child, 'issue-title') || hasClass(child, 'card-title')) {
      const text = squish(renderInline(child)).trim();
      if (text) out.push(`#### ${text}`);
      continue;
    }

    if (hasClass(child, 'step')) {
      const num = (child.children || []).find((c) => c.type === 'el' && hasClass(c, 'n'));
      const stepNo = num ? squish(renderPlain(num)).trim() : '';
      // The step number lives in its own div; drop it from the body text.
      const body = renderContainer({ children: (child.children || []).filter((c) => c !== num) })
        .join(' ')
        .trim();
      if (body) out.push(`**Step ${stepNo}.** ${body}`);
      continue;
    }

    if (hasClass(child, 'fix')) {
      const text = toParagraph(renderInline(child));
      if (text) out.push(`> **Fix** \u2014 ${text.replace(/^\*\*Fix:?\*\*\s*/i, '')}`);
      continue;
    }

    if (hasClass(child, 'box')) {
      const text = toParagraph(renderInline(child));
      if (text) out.push(`> ${text}`);
      continue;
    }

    if (hasClass(child, 'sub') || hasClass(child, 'subtitle') || hasClass(child, 'foot')) {
      const text = toParagraph(renderInline(child));
      if (text) out.push(`_${text}_`);
      continue;
    }

    // Generic container: recurse.
    out.push(...renderContainer(child));
  }

  return out;
}

/* ------------------------------------------------------------------ main */

function htmlToMarkdown(html) {
  let cleaned = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '');

  const tree = parseHTML(cleaned);

  const bodyNode = findTag(tree, 'body') || tree;

  // The document <title> becomes the H1 when the body has no H1 of its own.
  let bodyHasH1 = false;
  const scan = (node) => {
    for (const c of node.children || []) {
      if (c.type !== 'el') continue;
      if (c.tag === 'h1') bodyHasH1 = true;
      scan(c);
    }
  };
  scan(bodyNode);

  const headNode = findTag(tree, 'head');
  let title = '';
  if (headNode) {
    const t = (headNode.children || []).find((c) => c.type === 'el' && c.tag === 'title');
    if (t) title = squish(renderPlain(t)).trim();
  }

  const blocks = renderBlocks(bodyNode);

  const lines = [];
  if (!bodyHasH1 && title) lines.push(`# ${title}`, '');
  lines.push(...blocks);

  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');

  return text + '\n';
}

function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: node scripts/html-to-markdown.js <input.html> <output.md>');
    process.exit(1);
  }
  const html = fs.readFileSync(input, 'utf8');
  const md = htmlToMarkdown(html);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, md);
  console.log(`[html2md] ${input} -> ${output} (${md.length} bytes)`);
}

if (require.main === module) main();

module.exports = { htmlToMarkdown };
