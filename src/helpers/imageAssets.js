// Digital Garden adapter: use the same published-image index as Bases.
const { createImageIndex, scanImageDir } = require('./bases-engine/imageIndex');
let index;
function clearImageIndex() { index = undefined; }
function resolveImage(source, required = false) {
  // Already published Markdown URLs and external images retain standard behavior.
  if (/^(?:\/|[a-z][a-z0-9+.-]*:)/i.test(source)) {
    if (required) throw new Error(`Unsupported local image path: ${source}`);
    return source;
  }
  let decoded;
  try { decoded = decodeURIComponent(source); } catch { decoded = source; }
  if (decoded.split('/').includes('..') || /[\\\0]/.test(decoded)) {
    if (!required) return source;
    throw new Error(`Unsupported local image path: ${source}`);
  }
  index ||= createImageIndex([
    ...scanImageDir('src/site/img/user'),
    ...(process.env.IMAGE_CAPTIONS_FIXTURE === 'true'
      ? scanImageDir('test/fixtures/image-captions/images').map(p => '__image-captions-fixture/' + p) : []),
  ]);
  const found = index.resolve(decoded.replace(/^\.\//, ''));
  if (!found && required) throw new Error(`Image not found: ${source}`);
  return found ? '/img/user/' + found.split('/').map(encodeURIComponent).join('/') : source;
}
module.exports = { resolveImage, clearImageIndex };
