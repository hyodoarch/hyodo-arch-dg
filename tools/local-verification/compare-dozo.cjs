const fs=require('fs');
const {chromium}=require('C:/Users/hyodo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const results={};
 for(const width of [1440,390]) for(const [name,url] of [['local','http://127.0.0.1:8765/projects/ushibori_dozo/'],['public',(process.env.COMPARE_BASE || 'https://hyodo-arch-dg.pages.dev') + '/projects/ushibori_dozo/']]) {
  const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1}); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(url,{waitUntil:'networkidle',timeout:60000});
  await page.locator('img').evaluateAll(xs=>xs.forEach(x=>x.loading='eager'));
  await page.waitForTimeout(2000);
  const data=await page.evaluate(()=>{
   const main=document.querySelector('main.content')||document.querySelector('main');
   const rect=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,font:s.font,fontSize:s.fontSize,lineHeight:s.lineHeight,margin:s.margin,padding:s.padding,float:s.float}};
   const images=[...main.querySelectorAll('img')].map(e=>({alt:e.alt,src:e.getAttribute('src'),natural:[e.naturalWidth,e.naturalHeight],rect:rect(e),parent:e.parentElement.className,figure:e.closest('figure')?.className,caption:e.closest('figure')?.querySelector('figcaption')?.innerText}));
   return {title:document.title,text:main.innerText,bodyText:document.body.innerText,main:rect(main),html:main.innerHTML,headings:[...main.querySelectorAll('h1,h2,h3,h4')].map(e=>({text:e.innerText,tag:e.tagName,rect:rect(e)})),images,links:[...main.querySelectorAll('a')].map(e=>({text:e.innerText,href:e.getAttribute('href')})),styles:[...document.querySelectorAll('link[rel=stylesheet]')].map(e=>e.href),scripts:[...document.scripts].map(e=>e.src).filter(Boolean),grids:[...main.querySelectorAll('.image-grid-captions')].map(e=>({rect:rect(e),text:e.innerText,html:e.outerHTML})),bodyClass:document.body.className,overflow:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight};
  });
  await page.screenshot({path:`.cache/dozo-${name}-${width}-full.png`,fullPage:true});
  await page.screenshot({path:`.cache/dozo-${name}-${width}-top.png`});
  fs.writeFileSync(`.cache/dozo-${name}-${width}.json`,JSON.stringify({...data,status:response.status(),errors},null,2));
  results[`${name}-${width}`]={status:response.status(),title:data.title,main:data.main,headings:data.headings.map(x=>x.text),images:data.images.length,grids:data.grids.length,height:data.height,errors,brokenImages:data.images.filter(x=>!x.natural[0]).map(x=>x.src)};
  await page.close();
 }
 await browser.close();console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
