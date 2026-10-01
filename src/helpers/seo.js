const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('node-html-parser');
const { thumbnailUrl } = require('./folderNotes');

const siteRoot = path.resolve(__dirname, '../site');
const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';

// Inspect only the rendered note, before layouts add navigation or listing cards.
// A heading or paragraph before an image means that image is not at the beginning.
function leadingImage(content) {
  const block = parse(content || '').childNodes.find(node =>
    node.nodeType === 1 || (node.nodeType === 3 && node.text.trim()));
  if (!block || block.nodeType !== 1) return '';
  if (block.tagName === 'IMG') return block.getAttribute('src') || '';
  const classes = (block.getAttribute('class') || '').split(/\s+/);
  const imageBlock = ['FIGURE', 'PICTURE'].includes(block.tagName) ||
    (block.tagName === 'P' && !block.text.trim()) ||
    classes.includes('dg-slideshow') || classes.includes('image-grid-captions');
  return imageBlock ? block.querySelector('img')?.getAttribute('src') || '' : '';
}

function imageUrl(value, base) {
  const source = thumbnailUrl(value);
  if (!source) throw new Error(`Invalid image reference: ${String(value)}`);
  const url = new URL(source, base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported image URL: ${source}`);
  if (!/^https?:\/\//i.test(source)) {
    if (!source.startsWith('/img/')) throw new Error(`Image not found: ${String(value)}`);
    const decoded = decodeURIComponent(url.pathname);
    if (!decoded.startsWith('/img/') || /[\\\0]/.test(decoded) ||
      decoded.split('/').some(part => part === '..' || part === '.')) {
      throw new Error(`Unsupported local image path: ${source}`);
    }
    const file = path.join(siteRoot, decoded.slice(1));
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0) {
      throw new Error(`Image not found or empty: ${source}`);
    }
  }
  return url.href;
}

// Supply values to DG's existing metatag loop instead of adding a second renderer.
function seoMetatags(content, noteProps, metatags, title, pageUrl, siteBaseUrl, defaultImage) {
  const manual = Object.fromEntries(Object.entries(metatags || {})
    .filter(([, value]) => value != null && String(value).trim())
    .map(([name, value]) => [name, String(value).replace(/\s+/g, ' ').trim()]));
  // Keep DG's original behavior when its optional site URL has not been configured.
  if (!text(siteBaseUrl)) return manual;
  try {
    const base = new URL(siteBaseUrl.trim());
    if (!['http:', 'https:'].includes(base.protocol)) throw new Error('SITE_BASE_URL must use HTTP or HTTPS');
    if (!pageUrl?.startsWith('/') || pageUrl.startsWith('//')) throw new Error('A site-relative page URL is required');
    const props = noteProps || {};
    const description = manual.description || text(props.description);
    const hasImage = props['og-image'] != null &&
      (typeof props['og-image'] !== 'string' || props['og-image'].trim() !== '');
    const selected = hasImage ? props['og-image'] :
      manual['og:image'] || leadingImage(content) || defaultImage;
    const image = imageUrl(selected, base);
    const pageTitle = manual['og:title'] || text(title);
    const tags = {
      'og:title': pageTitle,
      'og:url': new URL(pageUrl, base).href,
      'og:type': 'website',
      'twitter:card': 'summary_large_image',
      'twitter:title': pageTitle,
      ...(description ? { description, 'og:description': description, 'twitter:description': description } : {}),
      ...manual,
      'og:image': image,
      'twitter:image': manual['twitter:image'] ? imageUrl(manual['twitter:image'], base) : image,
    };
    if (manual['og:url']) tags['og:url'] = new URL(manual['og:url'], base).href;
    return tags;
  } catch (error) {
    throw new Error(`SEO ${pageUrl || title || 'page'}: ${error.message}`, { cause: error });
  }
}

module.exports = { seoMetatags };
