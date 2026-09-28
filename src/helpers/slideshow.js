const { resolveImage } = require('./imageAssets');

module.exports = function slideshow(md) {
  const original = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    if (tokens[idx].info.trim() !== 'slideshow') return original(tokens, idx, options, env, self);
    const escape = value => md.utils.escapeHtml(value).replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/#/g, '&#35;');
    try {
      const images = tokens[idx].content.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(line => {
        const match = /^!\[\[([^|\]\r\n]+)(?:\|([^\]\r\n]*))?\]\]$/.exec(line);
        if (!match || !/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(match[1].trim())) throw new Error('画像を1行に1つ ![[画像パス]] で記述してください。');
        const path = match[1].trim();
        if (/[:#?\[\]\\]/.test(path) || path.startsWith('/') || path.split('/').includes('..')) throw new Error(`Unsupported local image path: ${path}`);
        return { src: resolveImage(path, true), alt: match[2] || path.split('/').pop() };
      });
      if (!images.length) throw new Error('画像が指定されていません。');
      return `<section class="dg-slideshow" aria-roledescription="カルーセル" aria-label="画像スライドショー"><div class="dg-slideshow__stage">${images.map((image, i) => `<div class="dg-slideshow__slide${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="スライド" aria-label="${i + 1} / ${images.length}" aria-hidden="${i !== 0}"><img src="${escape(image.src)}" alt="${escape(image.alt)}"></div>`).join('')}</div></section>\n`;
    } catch (error) {
      return `<p class="dg-slideshow__error" role="alert">Slideshow: ${escape(error.message)}</p>\n`;
    }
  };
};
