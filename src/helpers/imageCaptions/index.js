const MarkdownIt = require('markdown-it');
const { parseImageCaption } = require('./caption');
const { resolveImage } = require('../imageAssets');

function imageCaptions(md, options = {}) {
  const settings = { captionRegex: '', enableFilenamePlaceholders: true, ...options };
  const captionMd = new MarkdownIt({ html: false, linkify: true });
  captionMd.renderer.rules.link_open = md.renderer.rules.link_open;
  // The existing dataview-js-links transform resolves these with getAnchorAttributes.
  captionMd.inline.ruler.before('text', 'caption_wikilink', (state, silent) => {
    const match = /^<<([^<>\n]+)>>/.exec(state.src.slice(state.pos));
    if (!match) return false;
    const [target, ...alias] = match[1].split('|');
    if (!target.trim()) return false;
    if (!silent) {
      const escape = md.utils.escapeHtml;
      const token = state.push('html_inline', '', 0);
      token.content = `<a class="internal-link" data-href="${escape(target.trim())}">${escape(alias.join('|').trim() || target.trim())}</a>`;
    }
    state.pos += match[0].length;
    return true;
  });
  md.inline.ruler.before('image', 'caption_embed', (state, silent) => {
    const match = /^!\[\[([^\n]+?)\]\]/.exec(state.src.slice(state.pos));
    if (!match) return false;
    const pipe = match[1].indexOf('|');
    const source = (pipe < 0 ? match[1] : match[1].slice(0, pipe)).trim();
    if (!/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(source)) return false;
    const alias = pipe < 0 ? '' : match[1].slice(pipe + 1);
    if (!silent) {
      const token = state.push('image', 'img', 0);
      token.attrs = [['src', resolveImage(source)], ['alt', '']];
      token.content = alias;
      token.children = [{ type: 'text', content: alias || source }];
      token.meta = { captionEmbed: true, source };
      if (/^\d+(?:x\d+)?$/.test(alias)) {
        const [width, height] = alias.split('x');
        token.attrSet('width', width);
        if (height) token.attrSet('height', height);
      }
    }
    state.pos += match[0].length;
    return true;
  });
  const originalImage = md.renderer.rules.image;
  md.renderer.rules.image_caption = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    const parsed = token.meta.caption;
    const clone = Object.assign(Object.create(Object.getPrototypeOf(token)), token);
    clone.type = 'image';
    clone.attrs = token.attrs.map(attr => [...attr]);
    clone.content = parsed.imageAlt;
    clone.children = [{ type: 'text', content: parsed.imageAlt }];
    clone.attrSet('src', resolveImage(clone.attrGet('src')));
    if (parsed.width) clone.attrSet('width', parsed.width);
    if (parsed.height) clone.attrSet('height', parsed.height);
    const image = originalImage([clone], 0, opts, env, self);
    const cls = 'image-captions-figure' + (parsed.alignment ? ` image-captions-${parsed.alignment}` : '');
    const width = /^\d+$/.test(parsed.width || '') ? ` style="width:${parsed.width}px"` : '';
    return `<figure class="${cls}"${width}>${image}<figcaption class="image-captions-caption">${captionMd.renderInline(parsed.caption)}</figcaption></figure>\n`;
  };
  md.core.ruler.after('inline', 'image_captions', state => {
    for (let i = 1; i < state.tokens.length - 1; i++) {
      const inline = state.tokens[i];
      if (inline.type !== 'inline' || state.tokens[i - 1].type !== 'paragraph_open') continue;
      const meaningful = inline.children.filter(t => !['softbreak', 'hardbreak'].includes(t.type) && !(t.type === 'text' && !t.content.trim()));
      if (!meaningful.length || meaningful.some(t => t.type !== 'image')) continue;
      const parsed = meaningful.map(token => {
        if (!token.content || /^\d+(?:x\d+)?$/.test(token.content.trim())) return null;
        // Protect the alias separator inside <<Note|label>> from alignment parsing.
        const aliases = [];
        const raw = token.content.replace(/<<.*?>>/g, value => { aliases.push(value); return `\uE000${aliases.length - 1}\uE001`; });
        const result = parseImageCaption(raw, token.attrGet('src'), undefined, undefined,
          { ...settings, enableFilenamePlaceholders: options.captionRegex ? settings.enableFilenamePlaceholders : false });
        if (!options.captionRegex) {
          result.caption = result.caption.replace(/(?:^|\|)(left|center|right)(?=\||$)/g, '').trim();
          result.caption = parseImageCaption(result.caption, token.attrGet('src'), undefined, undefined, settings).caption;
        }
        result.caption = result.caption.replace(/\uE000(\d+)\uE001/g, (_, n) => aliases[Number(n)]);
        result.imageAlt = result.imageAlt.replace(/\uE000(\d+)\uE001/g, (_, n) => aliases[Number(n)]);
        return result.caption ? result : null;
      });
      // Match Quartz: only replace paragraphs consisting entirely of captioned images.
      if (parsed.some(p => !p)) continue;
      meaningful.forEach((token, j) => { token.type = 'image_caption'; token.meta = { ...token.meta, caption: parsed[j] }; });
      inline.children = meaningful;
      state.tokens[i - 1].hidden = true;
      state.tokens[i + 1].hidden = true;
    }
  });
}
module.exports = { imageCaptions };
