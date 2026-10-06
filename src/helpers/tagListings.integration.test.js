import { it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { register } = require('./tagListings');

it('rebuilds HOME and normal pages when tags, order, visibility and files change during watch', async () => {
  const { default: Eleventy } = await import('@11ty/eleventy');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hyodo-tag-listings-'));
  const input = path.join(root, 'notes');
  const output = path.join(root, 'output');
  fs.mkdirSync(input);
  fs.writeFileSync(path.join(input,'notes.json'), JSON.stringify({templateEngineOverride:'njk,md'}));
  const write = (name, tags, order, published = true) => fs.writeFileSync(path.join(input, name + '.md'),
    `---\ntags: ${JSON.stringify(['note', ...tags])}\ndg-publish: ${published}\norder: ${order}\n---\n${name}\n`);
  fs.writeFileSync(path.join(input,'HOME.md'),'---\npermalink: /index.html\n---\n# HOME\n{{ tags = "最近" }}\n');
  fs.writeFileSync(path.join(input,'normal.md'),'---\npermalink: /normal.html\n---\n# Normal\n\n{{ tags = "最近" }}\n\n{{ tags = "空" }}\n\n```\n{{ tags = "最近" }}\n```\n');
  write('A',['最近'],10); write('B',['最近'],20);
  const eleventy = new Eleventy(input, output, {runMode:'watch',configPath:false,quietMode:true,config(config) {
    register(config);
    return { markdownTemplateEngine:'njk', htmlTemplateEngine:false };
  }});
  const read = name => fs.readFileSync(path.join(output,name),'utf8');
  const waitFor = async condition => {
    const deadline = Date.now()+12000;
    while(Date.now()<deadline) {if(condition()) return; await new Promise(r=>setTimeout(r,100));}
    throw new Error('Watch output did not update');
  };
  try {
    await eleventy.init();
    require('../../tools/watch-eleventy.cjs').rebuildDeletedNotes(eleventy, await eleventy.watch());
    await new Promise(r=>setTimeout(r,600));
    expect(read('index.html').indexOf('/B/')).toBeLessThan(read('index.html').indexOf('/A/'));
    expect(read('normal.html')).toContain('folder-note-card');
    expect(read('normal.html')).toContain('該当するプロジェクトはありません。');
    expect(read('normal.html')).toContain('{{ tags = &quot;最近&quot; }}');
    write('A',['最近'],30);
    await waitFor(()=>read('index.html').indexOf('/A/')<read('index.html').indexOf('/B/'));
    write('A',[],30);
    await waitFor(()=>!read('index.html').includes('/A/'));
    write('A',['最近'],30);
    await waitFor(()=>read('index.html').includes('/A/'));
    write('A',['最近'],30,false);
    await waitFor(()=>!read('index.html').includes('/A/'));
    fs.unlinkSync(path.join(input,'B.md'));
    await waitFor(()=>read('index.html').includes('該当するプロジェクトはありません。'));
    expect(read('normal.html')).not.toContain('folder-note-card');
  } finally {
    if (eleventy.eleventyServe) await eleventy.stopWatch();
    // Only remove the unique temporary fixture created by this test.
    if(path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('hyodo-tag-listings-')) fs.rmSync(root,{recursive:true,force:true});
  }
}, 60000);
