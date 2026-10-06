// Eleventy 3.1 removes unlinked files from its index but does not rebuild.
// Reuse the normal watch queue after its unlink handler has updated the index.
function rebuildDeletedNotes(eleventy, watchRun) {
  eleventy.watcher.on('unlink', file => {
    if (file.replace(/\\/g, '/').includes('/notes/') && /\.md$/i.test(file)) {
      // Windows watchers can report absolute paths while the glob index is relative.
      const path = require('node:path');
      const deleted = path.resolve(file);
      for (const entries of Object.values(eleventy.fileSystemSearch.outputs)) {
        for (const entry of entries) {
          if (path.resolve(entry) === deleted) entries.delete(entry);
        }
      }
      void watchRun(file);
    }
  });
}

async function main() {
  const { default: Eleventy } = await import('@11ty/eleventy');
  const eleventy = new Eleventy(undefined, undefined, { runMode: 'serve' });
  await eleventy.init();
  rebuildDeletedNotes(eleventy, await eleventy.watch());
  await eleventy.serve();
  const stop = async () => { await eleventy.stopWatch(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { rebuildDeletedNotes };
