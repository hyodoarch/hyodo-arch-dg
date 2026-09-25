function userMarkdownSetup(md) {
  // The md parameter stands for the markdown-it instance used throughout the site generator.
  // Feel free to add any plugin you want here instead of /.eleventy.js
  md.use(require('./imageCaptions').imageCaptions);
  md.use(require('./imageGridCaptions').imageGridCaptions);
}
function userEleventySetup(eleventyConfig) {
  const { noteTags } = require('./noteTemplate');
  eleventyConfig.addNunjucksShortcode('noteTags', function () {
    return noteTags(this.ctx, eleventyConfig.getFilter('tagSlug'));
  });
  // The eleventyConfig parameter stands for the the config instantiated in /.eleventy.js.
  // Feel free to add any plugin you want here instead of /.eleventy.js
  eleventyConfig.on('eleventy.before', require('./imageAssets').clearImageIndex);
  // Opt-in fixture: normal builds publish neither the page nor these images.
  if (process.env.IMAGE_CAPTIONS_FIXTURE === 'true') {
    eleventyConfig.addTemplate('image-captions-fixture.md',
      require('fs').readFileSync('test/fixtures/image-captions/demo.md', 'utf8'), {
        layout: 'layouts/note.njk', title: 'Image Captions / Grid fixture',
        permalink: '/__image-captions-fixture/', eleventyExcludeFromCollections: true,
      });
    eleventyConfig.addPassthroughCopy({ 'test/fixtures/image-captions/images': 'img/user/__image-captions-fixture' });
  }
}
exports.userMarkdownSetup = userMarkdownSetup;
exports.userEleventySetup = userEleventySetup;
