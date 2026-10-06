const path = require('node:path');
const fs = require('node:fs');
const markdown = require('markdown-it')({ html: true });
const nunjucks = require('nunjucks');
const { tagsForNote } = require('./tagNotes');
const { isListedNote, noteCards } = require('./folderNotes');

// Parse Markdown before Nunjucks so documentation examples stay literal.
function preprocess(content, inputPath = 'note.md', lineOffset = 0) {
  const lines = content.split('\n');
  const starts = [0];
  lines.forEach(line => starts.push(starts.at(-1) + line.length + 1));
  const protectedRanges = [];
  const rawRanges = [];
  for (const m of content.matchAll(/{%-?\s*raw\s*-?%}[\s\S]*?{%-?\s*endraw\s*-?%}/g)) {
    rawRanges.push([m.index, m.index + m[0].length]);
  }
  const tokens = markdown.parse(content, {});
  for (const token of tokens) {
    if (['fence', 'code_block', 'html_block'].includes(token.type) && token.map) {
      protectedRanges.push([starts[token.map[0]], starts[token.map[1]]]);
    }
  }
  // Backtick runs must close with an equally long run, as in Markdown.
  for (const token of tokens.filter(t => t.type === 'inline' && t.map)) {
    const base = starts[token.map[0]];
    const chunk = content.slice(base, starts[token.map[1]]);
    const runs = [...chunk.matchAll(/`+/g)];
    for (let i = 0; i < runs.length; i++) {
      const opening = runs[i];
      const slashes = chunk.slice(0, opening.index).match(/\\+$/)?.[0].length || 0;
      if (slashes % 2) continue;
      let j = i + 1;
      while (j < runs.length && runs[j][0].length !== opening[0].length) j++;
      if (j < runs.length) {
        protectedRanges.push([base + opening.index, base + runs[j].index + runs[j][0].length]);
        i = j;
      }
    }
  }
  for (const m of content.matchAll(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g)) {
    protectedRanges.push([m.index, m.index + m[0].length]);
  }
  const inside = (ranges, position) => ranges.some(([a, b]) => position >= a && position < b);
  const edits = [];
  for (const candidate of content.matchAll(/\{\{\s*tags\s*=/g)) {
    const pos = candidate.index;
    if (inside(rawRanges, pos)) continue;
    if (inside(protectedRanges, pos)) {
      edits.push([pos, pos + 2, '{{ "{{" }}']);
      continue;
    }
    const line = content.slice(0, pos).split('\n').length - 1;
    const text = lines[line].replace(/\r$/, '');
    const match = text.match(/^ {0,3}\{\{ *tags *= *"([^"\\\r\n]*)" *\}\} *$/);
    const fail = reason => { throw new Error(`${inputPath}:${line + 1 + lineOffset}: ${reason}。正しい例: {{ tags = "最近" }}`); };
    if (!match) fail('タグ一覧は独立した行に半角二重引用符で記述してください');
    const tag = match[1].trim();
    if (!tag || tag.startsWith('#')) fail('空でないタグ名を # なしで指定してください');
    if (tokens.some(token => token.type === 'inline' && token.level > 1 && token.map &&
        line >= token.map[0] && line < token.map[1])) fail('引用や箇条書きの中には配置できません');
    edits.push([starts[line], starts[line] + text.length, `\n{% hyodoTagListing ${JSON.stringify(tag)} %}\n`]);
  }
  for (const [start, end, value] of edits.reverse()) content = content.slice(0, start) + value + content.slice(end);
  return content;
}

function listingNotes(data, tag) {
  const seen = new Set();
  return noteCards((data.collections?.note || []).filter(item => {
    const identity = item.inputPath || item.filePathStem || item.url;
    if (seen.has(identity) || !isListedNote(item) || !tagsForNote(item).includes(tag)) return false;
    if ((item.inputPath && item.inputPath === data.page?.inputPath) ||
        (item.filePathStem && item.filePathStem === data.page?.filePathStem)) return false;
    seen.add(identity);
    return true;
  }));
}

function renderListing(data, tag) {
  const notes = listingNotes(data, tag);
  if (!notes.length) return '<div class="tag-note-list-empty">該当するプロジェクトはありません。</div>';
  // No cache: editing the shared component is reflected in watch builds too.
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(
    path.resolve(__dirname, '../site/_includes'), { noCache: true }), { autoescape: true });
  return env.render('components/note-cards.njk', { listingNotes: notes })
    .split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

function register(eleventyConfig) {
  eleventyConfig.addPreprocessor('hyodo-tag-listings', 'md', function(data, content) {
    if (!this.inputPath.replace(/\\/g, '/').includes('/notes/')) return content;
    // Report source line numbers including frontmatter, without reading Vault.
    const source = fs.readFileSync(this.inputPath, 'utf8');
    const frontmatter = source.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/);
    const offset = frontmatter ? frontmatter[0].split('\n').length - 1 : 0;
    return preprocess(content, this.inputPath, offset);
  });
  eleventyConfig.addNunjucksShortcode('hyodoTagListing', function(tag) {
    return renderListing(this.ctx, tag);
  });
}

module.exports = { preprocess, listingNotes, renderListing, register };
