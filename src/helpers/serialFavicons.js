const faviconsPlugin = require('eleventy-plugin-gen-favicons');

// The upstream plugin caches after writing. Concurrent pages can all miss
// that cache and write the same favicon files, producing EBUSY on Windows.
function serializeAsync(callback) {
  let pending = Promise.resolve();
  return function (...args) {
    const result = pending.then(() => callback.apply(this, args));
    pending = result.catch(() => {});
    return result;
  };
}

module.exports = (eleventyConfig, options) => {
  faviconsPlugin({
    addAsyncShortcode(name, callback) {
      eleventyConfig.addAsyncShortcode(name, serializeAsync(async function (source, opts) {
        const html = await callback.call(this, source, opts);
        if (!opts || !opts.iconVersion) return html;
        const version = encodeURIComponent(opts.iconVersion);
        return html.replace(/(href="\/(?:favicon\.(?:svg|ico)|apple-touch-icon\.png))"/g, '$1?v=' + version + '"');
      }));
    },
  }, options);
};
module.exports.serializeAsync = serializeAsync;
