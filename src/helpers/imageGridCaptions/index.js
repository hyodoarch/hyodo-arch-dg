const { LANGUAGE, parseGrid, parseCaptionBlocks, errorText } = require('./shared/parser');
const { resolveImage } = require('../imageAssets');
function imageGridCaptions(md) {
  const original = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    if (tokens[idx].info.trim() !== LANGUAGE) return original(tokens, idx, options, env, self);
    const escape = md.utils.escapeHtml;
    // Later Digital Garden template filters recognize wikilinks and hashtags.
    // Encode their delimiters so Grid captions stay literal through those filters.
    const literal = value => escape(value).replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/#/g, '&#35;');
    try {
      const grid = parseGrid(tokens[idx].content);
      const items = grid.images.map(image => {
        const src = resolveImage(image.path, true);
        const caption = parseCaptionBlocks(image.caption).map(block => {
          const text = literal(block.text);
          if (!block.headingLevel && !image.caption.includes('\n')) return text;
          const tag = block.headingLevel ? `h${block.headingLevel}` : 'p';
          return `<${tag}>${text}</${tag}>`;
        }).join('');
        return `<figure class="image-grid-captions__item"><img class="image-grid-captions__image" src="${escape(src)}" alt="${literal(image.alt)}" data-image-path="${escape(image.path)}">${image.caption ? `<figcaption class="image-grid-captions__caption">${caption}</figcaption>` : ''}</figure>`;
      });
      return `<div class="image-grid-captions" data-columns="${grid.columns}" data-gap="${grid.gap}">${items.join('')}</div>\n`;
    } catch (error) {
      return `<div class="image-grid-captions__error" role="alert">${literal(errorText(error))}</div>\n`;
    }
  };
}
module.exports = { imageGridCaptions };
