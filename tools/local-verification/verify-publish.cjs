const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('C:/Users/hyodo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve('dist');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json'};
const server = http.createServer((req,res) => {
  let file = path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  if (!fs.existsSync(file)) {res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=process.env.VERIFY_BASE || `http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}});
  for(const route of ['/','/マンションリノベーション/','/projects/yamashita/','/tags/和風/']) {
   const response=await page.goto(base+encodeURI(route),{waitUntil:'networkidle',timeout:60000});
   await page.locator('img').evaluateAll(imgs=>imgs.forEach(i=>i.loading='eager'));
   await page.waitForTimeout(1500);
   const result=await page.evaluate(()=>({title:document.title,css:[...document.querySelectorAll('link[rel=stylesheet]')].map(x=>x.getAttribute('href')).filter(x=>x.includes('/user/')),contact:!!document.querySelector('.hyodo-contact-button'),cards:document.querySelectorAll('.folder-note-card').length,grid:document.querySelectorAll('.image-grid').length,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src')),unrendered:/\{%\s*noteTags|\{\{\s*title\s*\}\}/.test(document.body.innerText)}));
   results.push({width,route,status:response.status(),...result});
   if(route==='/'||route==='/マンションリノベーション/') await page.screenshot({path:'.cache/'+(process.env.VERIFY_BASE?'live-':'local-')+width+(route==='/'?'-home':'-category')+'.png',fullPage:false});
  }
  await page.close();
 }
 await browser.close();server.close();
 console.log(JSON.stringify(results,null,2));
 if(results.some(x=>x.status!==200||!x.contact||x.brokenImages.length||x.unrendered||x.css.length<3)) process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exit(1)});
