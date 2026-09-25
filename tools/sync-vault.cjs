// Local-only, one-way sync of existing DG notes from the Obsidian vault.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const matter = require('gray-matter');
const YAML = require(require.resolve('js-yaml', { paths: [require.resolve('gray-matter')] }));
const project = path.resolve(__dirname, '..');
const notes = path.join(project, 'src/site/notes');
const vault = path.resolve(process.env.DG_VAULT_PATH || path.join(project, '..'));
const seen = new Map();
const options = { engines: { yaml: text => YAML.load(text.replace(/\\\|/g, '|')) } };

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file);
    else if (entry.name.endsWith('.md')) yield file;
  }
}

function sync() {
  if (!fs.existsSync(path.join(vault, '.obsidian'))) return;
  for (const target of files(notes)) {
    const relative = path.relative(notes, target);
    const source = path.join(vault, relative);
    if (!fs.existsSync(source)) continue;
    try {
      const raw = fs.readFileSync(source, 'utf8');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      const parsed = matter(raw, options);
      if (parsed.data['dg-publish'] !== true) continue;
      // Keep the public image paths used by the existing DG renderer.
      // Include frontmatter thumbnails and filenames containing spaces.
      for (const match of raw.matchAll(/images\/[^\r\n|\]\)"<>]+?\.(?:jpe?g|png|webp|gif|svg|avif)/gi)) {
        const imagePath = match[0];
        const from = path.resolve(vault, imagePath);
        if (!from.startsWith(vault + path.sep) || !fs.existsSync(from)) continue;
        const to = path.join(project, 'src/site/img/user', imagePath);
        if (!fs.existsSync(to) || !fs.readFileSync(from).equals(fs.readFileSync(to))) {
          fs.mkdirSync(path.dirname(to), { recursive: true });
          fs.copyFileSync(from, to);
        }
      }
      if (seen.get(source) === hash) continue;
      const previous = matter(fs.readFileSync(target, 'utf8'), options);
      const data = parsed.data;
      const tags = Array.isArray(data.tags) ? [...data.tags] : data.tags ? [data.tags] : [];
      if (data['dg-home'] === true && !tags.includes('gardenEntry')) tags.push('gardenEntry');
      const meta = {
        ...data,
        permalink: data['dg-home'] === true ? '/' : data['dg-permalink'] || data.permalink || previous.data.permalink,
        tags,
        'dg-note-properties': { ...data },
      };
      const content = parsed.content.replace(/(!\[[^\]\n]*\]\()(?:(?:\.\/)?)(images\/[^)\n]+)(\))/g, '$1/img/user/$2$3');
      const output = '---\n' + JSON.stringify(meta) + '\n---\n' + content;
      if (output !== fs.readFileSync(target, 'utf8')) {
        const backup = path.join(project, '.cache/vault-sync-backup', relative);
        if (!fs.existsSync(backup)) {
          fs.mkdirSync(path.dirname(backup), { recursive: true });
          fs.copyFileSync(target, backup);
        }
        fs.writeFileSync(target, output);
        console.log('[vault-sync] ' + relative);
      }
      seen.set(source, hash);
    } catch (error) {
      console.error('[vault-sync] Could not sync ' + relative + ': ' + error.message);
      if (!process.argv.includes('--watch')) process.exitCode = 1;
    }
  }
}

sync();
if (process.argv.includes('--watch')) {
  if (!fs.existsSync(path.join(vault, '.obsidian'))) {
    console.log('[vault-sync] No local vault found; set DG_VAULT_PATH to enable source sync.');
  } else {
    console.log('[vault-sync] Watching source notes in ' + vault);
    setInterval(sync, 1000);
  }
}
