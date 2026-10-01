const { parse } = require('node-html-parser');

// Reuse the published homepage's rendered component, including its settings.
// Reading the collection content on each render also follows HOME edits in dev.
function homeSlideshow(entries) {
  if (!Array.isArray(entries) || entries.length !== 1 || entries[0].url !== '/' || entries[0].data.hide) {
    throw new Error('404 slideshow requires one visible published homepage (gardenEntry).');
  }
  const slideshow = parse(entries[0].templateContent).querySelector('.dg-slideshow');
  if (!slideshow) {
    throw new Error('404 slideshow: the published homepage must contain a valid slideshow block.');
  }
  return slideshow.outerHTML;
}

module.exports = { homeSlideshow };
