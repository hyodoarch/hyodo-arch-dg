// Content is published exclusively by the Obsidian Digital Garden plugin.
// Retain the explicit template-image sync without rewriting plugin-owned notes.
const path = require('node:path');
const { syncCommonImages } = require('./common-images.cjs');
if (!process.argv.includes('--common-only')) {
  console.error('[vault-sync] Note sync is retired. Publish content with Obsidian Digital Garden. Use sync:common only for template images.');
  process.exitCode = 1;
} else {
  try {
    const project = path.resolve(__dirname, '..');
    if (!process.env.DG_VAULT_PATH) throw new Error('Set DG_VAULT_PATH before syncing template images.');
    for (const image of syncCommonImages(project, path.resolve(process.env.DG_VAULT_PATH))) console.log('[vault-sync] ' + image);
  } catch (error) {
    console.error('[vault-sync] ' + error.message);
    process.exitCode = 1;
  }
}
