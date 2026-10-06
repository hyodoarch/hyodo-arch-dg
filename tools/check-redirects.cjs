const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const sectionFallbacks = new Map([
  ['/vectorworks/*', 'https://blog.hyodo-arch.com/vectorscript/'],
  ['/buryoshaki/*', 'https://blog.hyodo-arch.com/'],
  ['/progress/*', '/'],
]);

function parseRedirects(text) {
  const rules = [];
  const sources = new Set();
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const fail = message => { throw new Error(`_redirects:${index + 1}: ${message}`); };
    if (parts.length !== 3 || parts[2] !== '301') fail('Use source destination 301');
    const [source, destination] = parts;
    if (line.length > 1000) fail('Cloudflare line limit exceeded');
    if (!source.startsWith('/') || /[?#\\]/.test(source) || source.includes('//') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(source)) fail('Invalid source path');
    const wildcard = source.includes('*');
    const pagination = source.includes(':');
    const dynamic = wildcard || pagination;
    if (wildcard && (!sectionFallbacks.has(source) || sectionFallbacks.get(source) !== destination)) fail('Only approved retired-section fallbacks and targets are allowed');
    if (pagination && !/^\/buryoshaki\/archives\/(?:category|tag)\/[a-z/]+\/page\/:page\/?$/.test(source)) fail('Only existing blog pagination placeholders are allowed');
    if (!dynamic && rules.some(rule => rule.dynamic)) fail('Exact paths must precede dynamic rules');
    if (pagination && rules.some(rule => rule.source.includes('*'))) fail('Pagination rules must precede section fallbacks');
    if (sources.has(source)) fail('Duplicate source: ' + source);
    sources.add(source);
    if (destination.startsWith('/')) {
      if (/[?#:*\\]/.test(destination) || destination.includes('//') || new URL(destination, 'https://www.hyodo-arch.com').pathname !== destination) fail('Invalid local destination');
    } else {
      const url = new URL(destination);
      if (url.origin !== 'https://blog.hyodo-arch.com' || url.username || url.password || url.search || url.hash || /[^\x21-\x7e]/.test(destination)) fail('External destinations must be encoded URLs of the published blog');
    }
    rules.push({ source, destination, dynamic });
  }
  const staticCount = rules.filter(rule => !rule.dynamic).length;
  if (staticCount > 2000 || rules.length - staticCount > 100 || rules.length > 2100) throw new Error('Cloudflare redirect count limit exceeded');
  return rules;
}

function matches(rule, urlPath) {
  if (!rule.dynamic) return rule.source === urlPath;
  if (rule.source.endsWith('/*')) return urlPath.startsWith(rule.source.slice(0, -1));
  const [before, after] = rule.source.split(':page');
  return urlPath.startsWith(before) && urlPath.endsWith(after) && !urlPath.slice(before.length, after ? -after.length : undefined).includes('/') && urlPath.length > before.length + after.length;
}

function checkRedirects(project, output = path.join(project, 'dist')) {
  const source = fs.readFileSync(path.join(project, 'src/site/_redirects'), 'utf8');
  if (fs.readFileSync(path.join(output, '_redirects'), 'utf8') !== source) throw new Error('dist/_redirects is missing or differs from its source; check passthroughCopy');
  const rules = parseRedirects(source);
  const publicPaths = new Set([...fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1].replaceAll('&amp;', '&')).pathname));
  for (const rule of rules) {
    if ([...publicPaths].some(urlPath => matches(rule, urlPath))) throw new Error('A current public page would be redirected: ' + rule.source);
    if (!rule.destination.startsWith('/')) continue;
    if (!publicPaths.has(rule.destination)) throw new Error('Destination is not a public sitemap page: ' + rule.destination);
    if (rules.some(other => matches(other, rule.destination))) throw new Error('Redirect chain or loop: ' + rule.source);
    const file = path.join(output, rule.destination.endsWith('/') ? rule.destination + 'index.html' : rule.destination);
    if (!fs.existsSync(file)) throw new Error('Missing destination HTML: ' + file);
  }
  const legacyNotes = [];
  for (const file of fs.readdirSync(path.join(project, 'src/site/notes'), { recursive: true }).filter(file => file.endsWith('.md'))) {
    const data = matter(fs.readFileSync(path.join(project, 'src/site/notes', file), 'utf8')).data;
    const oldUrl = data['dg-note-properties']?.['source-url'];
    const destination = data.tags?.includes('gardenEntry') ? '/' : data.permalink;
    if (!oldUrl || !publicPaths.has(destination)) continue;
    const old = new URL(oldUrl);
    if (!['www.hyodo-arch.com', 'hyodo-arch.com'].includes(old.hostname) || old.pathname === destination) continue;
    const rule = rules.find(rule => matches(rule, old.pathname));
    if (rule && rule.destination !== destination) throw new Error('source-url and permalink disagree with redirect: ' + file);
    legacyNotes.push({ source: old.pathname, destination, mapped: Boolean(rule) });
  }
  const result = { rules, staticCount: rules.filter(rule => !rule.dynamic).length, dynamicCount: rules.filter(rule => rule.dynamic).length, publicPaths: [...publicPaths], legacyNotes };
  const missing = legacyNotes.filter(note => !note.mapped);
  if (missing.length) console.warn('[redirects] New migration URLs need rules: ' + missing.map(note => note.source).join(', '));
  return result;
}

async function checkLive(result, base) {
  const origin = new URL(base).origin;
  if (new URL(origin).protocol !== 'https:' || !['www.hyodo-arch.com', 'hyodo-arch-dg.pages.dev'].includes(new URL(origin).hostname)) throw new Error('Use the DG staging or production HTTPS origin');
  const checks = [];
  async function get(url) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(25000) });
    await response.arrayBuffer();
    return { status: response.status, location: response.headers.get('location') };
  }
  async function batch(items, callback) {
    const queue = items.slice();
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const item = queue.shift();
        try { checks.push(await callback(item)); }
        catch (error) { checks.push({ item, error: error.message, cause: error.cause?.code }); }
      }
    }));
  }
  await batch(result.rules, async rule => {
    const source = rule.source.replace(':page', '2').replace('*', 'redirect-check/deep/legacy.html');
    const response = await get(origin + source);
    const expected = new URL(rule.destination, origin).href;
    if (response.status !== 301 || !response.location || new URL(response.location, origin).href !== expected) throw new Error(`${source}: ${response.status}, Location=${response.location}; expected 301 -> ${expected}`);
    return { source, ...response, ok: true };
  });
  await batch([...new Set(result.rules.map(rule => new URL(rule.destination, origin).href))], async destination => {
    const response = await get(destination);
    if (response.status !== 200) throw new Error(`${destination}: target ${response.status}; ${response.location || ''}`);
    return { destination, status: response.status, ok: true };
  });
  await batch(result.publicPaths, async source => {
    const response = await get(origin + source);
    if (response.status !== 200) throw new Error(`${source}: public page ${response.status}`);
    return { publicPage: source, status: response.status, ok: true };
  });
  const retired = ['/arch_link.html', '/plain_hut/', '/plain_hut/about_ph.html', '/plain_hut/ph-5x7.html', '/plain_hut/ph-4x8.html', '/plain_hut/ph-spec.html', '/thankyou.html', '/projects/not-a-real-work.html', '/vectorworks-other/legacy.html', '/buryoshaki-other/legacy.html', '/progression/legacy.html'];
  await batch(retired, async source => {
    const response = await get(origin + source);
    if (response.status !== 404) throw new Error(`${source}: retired or unknown page ${response.status}`);
    return { retired: source, status: response.status, ok: true };
  });
  if (result.rules.some(rule => rule.source.includes('*'))) {
    const legacyProbes = [
      '/vectorworks/useful/angle_design/ij_move.html',
      '/vectorworks/downloads/legacy.zip',
      ...[121, 130, 155, 597, 612, 619, 622, 628, 648, 652, 659].flatMap(id => [`/buryoshaki/archives/${id}`, `/buryoshaki/archives/${id}/`]),
      '/buryoshaki/wp-content/uploads/2012/legacy.jpg',
      '/buryoshaki/archives/unknown/page/2',
      '/progress/index.html',
      '/progress/archive/legacy.html',
    ];
    await batch(legacyProbes, async source => {
      const rule = result.rules.find(rule => matches(rule, source));
      if (!rule) throw new Error('Missing retired-section redirect: ' + source);
      const response = await get(origin + source);
      const expected = new URL(rule.destination, origin).href;
      if (response.status !== 301 || !response.location || new URL(response.location, origin).href !== expected) throw new Error(`${source}: ${response.status}, Location=${response.location}; expected 301 -> ${expected}`);
      return { legacyProbe: source, ...response, ok: true };
    });
  }
  const queryChecks = [];
  for (const source of ['/projects/honbasu.html', '/contact.html', '/buryoshaki/archives/398']) {
    const rule = result.rules.find(rule => rule.source === source);
    const query = '?utm_source=redirect-check&ref=legacy';
    const response = await get(origin + source + query);
    const target = response.location && new URL(response.location, origin);
    const expected = new URL(rule.destination, origin);
    if (response.status !== 301 || !target || target.origin !== expected.origin || target.pathname !== expected.pathname) checks.push({ source, ...response, error: 'Query URL matched the wrong redirect' });
    queryChecks.push({ source, ...response, queryPreserved: target?.search === query });
  }
  return { checkedAt: new Date().toISOString(), origin, success: checks.every(check => check.ok), ruleCount: result.rules.length, checks, queryChecks };
}

module.exports = { parseRedirects, matches, checkRedirects, checkLive };
if (require.main === module) {
  (async () => {
    const project = path.resolve(__dirname, '..');
    const result = checkRedirects(project);
    console.log(`[redirects] ${result.staticCount} exact + ${result.dynamicCount} dynamic rules; ${result.legacyNotes.filter(note => note.mapped).length}/${result.legacyNotes.length} legacy note URLs mapped.`);
    const base = process.argv.find(arg => arg.startsWith('--live='))?.slice('--live='.length);
    if (base) {
      const report = await checkLive(result, base);
      const folder = path.join(project, '.cache/redirects-check');
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, new URL(base).hostname + '.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({ ...report, checks: undefined }));
      if (!report.success) throw new Error(JSON.stringify(report.checks.filter(check => check.error)));
    }
  })().catch(error => { console.error('[redirects] ' + error.message); process.exitCode = 1; });
}
