const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

function noteMappings(project) {
  const file = path.join(project, 'tools/note-redirects.json');
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  const notes = new Set();
  for (const entry of entries) {
    if (!entry.note || path.isAbsolute(entry.note) || entry.note.includes('\\') ||
        entry.note.split('/').some(part => !part || part === '.' || part === '..') ||
        !entry.note.endsWith('.md') || notes.has(entry.note)) {
      throw new Error('Invalid or duplicate redirect note: ' + entry.note);
    }
    notes.add(entry.note);
    if (typeof entry.source !== 'string' || typeof entry.destination !== 'string' ||
        !entry.destination.startsWith('/')) throw new Error('Invalid note redirect: ' + entry.note);
  }
  return entries;
}

function retiredNotePaths(project) {
  return noteMappings(project).filter(entry =>
    !fs.existsSync(path.join(project, 'src/site/notes', entry.note)))
    .flatMap(entry => [entry.source, entry.destination]);
}

function renderRedirects(project, output = path.join(project, 'dist')) {
  const { parseRedirects } = require('./check-redirects.cjs');
  const fixed = fs.readFileSync(path.join(project, 'src/site/_redirects'), 'utf8');
  const mappings = noteMappings(project);
  const line = entry => `${entry.source} ${entry.destination} 301`;
  // Validate even inactive mappings, including collisions with fixed rules.
  parseRedirects(mappings.map(line).join('\n') + '\n' + fixed);
  const publicPaths = new Set([...fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8')
    .matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1].replaceAll('&amp;', '&')).pathname));
  const noteRoot = path.join(project, 'src/site/notes');
  const published = fs.readdirSync(noteRoot, { recursive: true }).filter(f => f.endsWith('.md'))
    .map(file => ({ file: file.replaceAll('\\', '/'), data: matter(fs.readFileSync(path.join(noteRoot, file), 'utf8')).data }));
  const active = [];
  for (const entry of mappings) {
    const note = published.find(note => note.file === entry.note);
    if (!note) {
      // A renamed note or mistyped registry path must not silently lose its redirect.
      if (publicPaths.has(entry.destination) || published.some(note =>
        note.data['dg-note-properties']?.['source-url']?.endsWith(entry.source))) {
        throw new Error('Redirect note path is missing but destination/source-url remains: ' + entry.note);
      }
      continue; // Publication center removed this note; retain mapping for republication.
    }
    const old = new URL(note.data['dg-note-properties']?.['source-url']);
    const destination = note.data.tags?.includes('gardenEntry') ? '/' : note.data.permalink;
    if (!['www.hyodo-arch.com', 'hyodo-arch.com'].includes(old.hostname) ||
        old.pathname !== entry.source || destination !== entry.destination) {
      throw new Error('source-url and permalink disagree with note redirect: ' + entry.note);
    }
    if (!publicPaths.has(entry.destination)) {
      throw new Error('Existing redirect note is not a public sitemap page: ' + entry.note);
    }
    active.push(line(entry));
  }
  return '# Generated from tools/note-redirects.json and src/site/_redirects.\n' +
    active.join('\n') + '\n' + fixed;
}

function generateRedirects(project, output = path.join(project, 'dist')) {
  const text = renderRedirects(project, output);
  fs.writeFileSync(path.join(output, '_redirects'), text);
}

module.exports = { renderRedirects, generateRedirects, retiredNotePaths };
