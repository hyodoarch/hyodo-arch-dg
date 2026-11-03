const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_ADS_TXT = 'google.com, pub-0569052513940110, DIRECT, f08c47fec0942fa0';

function checkAdsTxt(project) {
  const read = (file) => {
    try {
      return fs.readFileSync(path.join(project, file));
    } catch (error) {
      throw new Error(`[ads.txt] Cannot read ${file}: ${error.code}`);
    }
  };
  const source = read('src/site/ads.txt');
  // Accept a single optional final newline (LF or CRLF), but no BOM,
  // extra lines, surrounding whitespace, or changes to the publisher record.
  const record = source.toString('utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
  if (record !== EXPECTED_ADS_TXT) {
    throw new Error('[ads.txt] src/site/ads.txt must contain exactly: ' + EXPECTED_ADS_TXT);
  }
  const output = read('dist/ads.txt');
  if (!output.equals(source)) {
    throw new Error('[ads.txt] dist/ads.txt must be a byte-for-byte copy of src/site/ads.txt. Check .eleventy.js and rebuild.');
  }
}

if (require.main === module) {
  try {
    checkAdsTxt(path.resolve(__dirname, '..'));
    console.log('[ads.txt] Source record and dist/ads.txt verified.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkAdsTxt, EXPECTED_ADS_TXT };
