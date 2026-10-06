import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { preprocess, listingNotes, renderListing } = require('./tagListings');
const nunjucks = require('nunjucks');
const md = require('markdown-it')({html:true});
const item = (name, tags = ['最近'], props = {}) => ({inputPath:`./src/site/notes/${name}.md`,filePathStem:`/notes/${name}`,url:`/custom/${name}/`,data:{'dg-publish':true,tags,...props}});
const data = notes => ({page:{inputPath:'./src/site/notes/self.md',filePathStem:'/notes/self'},collections:{note:notes}});

describe('tag listing author syntax', () => {
  it('expands independent lines even immediately after a heading', () => {
    expect(preprocess('## 最近\n{{tags=" 最近 "}}\n\n{{ tags = "住宅/木造" }}')).toContain('{% hyodoTagListing "最近" %}');
    expect(preprocess('{{ tags = "最近" }}\n\n{{ tags = "最近" }}').match(/hyodoTagListing/g)).toHaveLength(2);
  });
  it.each(['{{ tags = "" }}','{{ tags = "#最近" }}',"{{ tags = '最近' }}",'{{ tags = “最近” }}','{{ tags = "最近"','{{ tags = "A", "B" }}','前 {{ tags = "最近" }}','> {{ tags = "最近" }}','- {{ tags = "最近" }}','| {{ tags = "最近" }} |'])('reports source locations for %s', text => {
    expect(() => preprocess(text,'HOME.md',4)).toThrow('HOME.md:5:');
  });
  it.each(['```md\n{{ tags = "最近" }}\n```','~~~\n{{ tags = "最近" }}\n~~~','    {{ tags = "最近" }}','`{{ tags = "最近" }}`','``{{ tags = "最近" }}``','{% raw %}{{ tags = "最近" }}{% endraw %}','<!-- {{ tags = "最近" }} -->','<span title=\'{{ tags = "最近" }}\'>例</span>'])('preserves literal examples %s', source => {
    const rendered = nunjucks.renderString(preprocess(source));
    expect(rendered).toContain('{{ tags = "最近" }}');
    expect(rendered).not.toContain('hyodoTagListing');
  });
  it('leaves unrelated templates unchanged', () => {
    expect(preprocess('# {{ title }}\n{% noteTags %}')).toBe('# {{ title }}\n{% noteTags %}');
  });
});

describe('tag listing data and shared rendering', () => {
  it('filters hidden, unpublished, indexes, self and duplicates using exact tags', () => {
    const good=item('A');
    const notes=[good,good,item('self'),item('index'),item('B',['最近/住宅']),item('C',['最近'],{'dg-publish':false}),item('D',['最近'],{'dg-hide':true}),item('E',['最近'],{hide:true}),item('F',['最近'],{hideInFiletree:true})];
    expect(listingNotes(data(notes),'最近').map(n=>n.title)).toEqual(['A']);
    expect(listingNotes(data([item('x',['note','gardenEntry'])]),'note')).toEqual([]);
    expect(listingNotes(data([item('x',['Recent'])]),'recent')).toEqual([]);
  });
  it('uses property precedence, numeric ordering and fresh metadata', () => {
    const notes=[item('末尾'),item('後',['最近'],{order:-1}),item('先',['最近'],{order:'20'}),item('除外',['最近'],{'dg-note-properties':{tags:['別']}})];
    expect(listingNotes(data(notes),'最近').map(n=>n.title)).toEqual(['先','後','末尾']);
    notes[2].data.tags=[];
    expect(listingNotes(data(notes),'最近').map(n=>n.title)).toEqual(['後','末尾']);
    notes[0].data.order=100;
    expect(listingNotes(data(notes),'最近')[0].title).toBe('末尾');
  });
  it('renders valid shared cards through Nunjucks then Markdown and escapes data', () => {
    const ctx=data([item('作品',['最近'],{title:'<script>alert(1)</script>',description:'<img src=x onerror=evil>',thumbnail:'/safe.jpg'})]);
    const env=new nunjucks.Environment();
    env.addExtension('listing',new class {
      tags=['hyodoTagListing'];
      parse(parser,nodes){const t=parser.nextToken();const args=parser.parseSignature(null,true);parser.advanceAfterBlockEnd(t.value);return new nodes.CallExtension(this,'run',args);}
      run(context,tag){return new nunjucks.runtime.SafeString(renderListing(ctx,tag));}
    });
    const html=md.render(env.renderString(preprocess('## 最近\n{{ tags = "最近" }}')));
    expect(html).toContain('<article class="folder-note-card">');
    expect(html).toContain('href="/custom/作品/"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<pre>');
    expect(renderListing(data([]),'最近')).toContain('該当するプロジェクトはありません。');
  });
});
