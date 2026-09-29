const fs = require('node:fs');
const path = require('node:path');

function readManifest(project) {
  const images = JSON.parse(fs.readFileSync(path.join(project, 'tools/common-images.json'), 'utf8'));
  if (!Array.isArray(images) || !images.length || images.some(image =>
    typeof image !== 'string' || !/^images\/common\/[^/\\]+\.(png|jpe?g|gif|svg|webp|avif)$/i.test(image) || image.includes('..')) ||
    new Set(images).size !== images.length) {
    throw new Error('Invalid tools/common-images.json: use unique images/common/<filename> paths.');
  }
  return images;
}

function requireImages(root, images) {
  const missing = images.filter(image => {
    const file = path.join(root, image);
    return !fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size === 0;
  });
  if (missing.length) throw new Error(`Missing or empty common images in ${root}:\n${missing.join('\n')}\nRestore from the vault with npm run sync:common, then commit the public images.`);
}

function syncCommonImages(project, vault) {
  const images = readManifest(project);
  // Validate every source before copying; a missing source never removes a public image.
  requireImages(vault, images);
  const changed = [];
  for (const image of images) {
    const from = path.join(vault, image);
    const to = path.join(project, 'src/site/img', path.basename(image));
    if (!fs.existsSync(to) || !fs.readFileSync(from).equals(fs.readFileSync(to))) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      changed.push(image);
    }
  }
  return changed;
}

function checkCommonImages(project) {
  const images = readManifest(project);
  const unregistered = new Set();
  const publicNames = images.map(image => path.basename(image));
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (entry.name.endsWith('.njk')) {
        const text = fs.readFileSync(file, 'utf8');
        // Template assets must stay outside the plugin-managed img/user directory.
        if (/\/img\/user\/images\/common\//.test(text)) {
          throw new Error(`Use /img/<filename> for template common images: ${file}`);
        }
        for (const match of text.matchAll(/\/img\/([^/\s"'<>?#]+\.(?:png|jpe?g|gif|svg|webp|avif))(?=[\s"'<>?#]|$)/gi)) {
          if (!publicNames.includes(match[1])) unregistered.add(match[1]);
        }
      }
    }
  }
  scan(path.join(project, 'src/site/_includes'));
  if (unregistered.size) throw new Error(`Register template images in tools/common-images.json:\n${[...unregistered].join('\n')}`);
  requireImages(path.join(project, 'src/site/img'), publicNames);
  return images;
}

module.exports = { syncCommonImages, checkCommonImages };
if (require.main === module) {
  try {
    const images = checkCommonImages(path.resolve(__dirname, '..'));
    console.log(`[common-images] Verified ${images.length} public images and template references.`);
  } catch (error) {
    console.error(`[common-images] ${error.message}`);
    process.exitCode = 1;
  }
}
