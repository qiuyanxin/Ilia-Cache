import fs from 'node:fs';

const metadata=JSON.parse(fs.readFileSync('/tmp/google-fonts-metadata.json','utf8'));
const all=metadata.familyMetadataList.filter(f=>f.isOpenSource&&!f.isBrandFont);
const chinese=all.filter(f=>f.subsets?.some(s=>s.startsWith('chinese-')));
const popular=all.slice().sort((a,b)=>(a.popularity??9999)-(b.popularity??9999));
const curatedNames=['Princess Sofia','Bonbon','Lavishly Yours','Birthstone Bounce','Henny Penny','Mystery Quest','UnifrakturCook','Rubik Puddles','Rubik Glitch','Nabla','Monoton','Fascinate Inline','Climate Crisis','Foldit'];
const base=[...chinese,...popular].filter((f,i,a)=>a.findIndex(x=>x.family===f.family)===i).slice(0,200);
const curated=curatedNames.map(name=>all.find(font=>font.family===name)).filter(Boolean).filter(font=>!base.some(item=>item.family===font.family));
const picked=[...base,...curated];
const category={"Sans Serif":'无衬线',Serif:'衬线',Display:'展示',Handwriting:'手写',Monospace:'等宽'};
const rows=picked.map(f=>({
 id:'google-'+f.family.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''),
 name:f.family,
 source:'Google Fonts',
 sourceUrl:curatedNames.includes(f.family)?`https://github.com/google/fonts/tree/main/ofl/${f.family.toLowerCase().replace(/[^a-z0-9]+/g,'')}`:`https://fonts.google.com/specimen/${encodeURIComponent(f.family).replace(/%20/g,'+')}`,
 cssFamily:f.family,
 category:category[f.category]||'其他',
 chinese:f.subsets.some(s=>s.startsWith('chinese-')),
 scripts:f.subsets.filter(s=>!['menu','latin','latin-ext'].includes(s)),
 designers:f.designers||[],
 license:'SIL Open Font License / Apache / UFL，以字体详情页为准',
 commercial:'免费商用',
 previewUrl:`https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g,'+')}&display=swap`
}));

rows.unshift(
 {id:'guange-kai',name:'館閣楷 GuanGe Kai',source:'wainshine/guangeti',sourceUrl:'https://github.com/wainshine/guangeti',category:'中文',chinese:true,license:'SIL Open Font License 1.1',commercial:'免费商用'},
 {id:'xiangcui-chaoxisong',name:'香萃潮汐宋',source:'Miiiller/Xiangcui-Chaoxisong',sourceUrl:'https://github.com/Miiiller/Xiangcui-Chaoxisong',category:'中文',chinese:true,license:'SIL Open Font License 1.1',commercial:'免费商用'},
 {id:'qiji-font',name:'齊伋體 Qiji',source:'LingDong-/qiji-font',sourceUrl:'https://github.com/LingDong-/qiji-font',category:'中文',chinese:true,license:'SIL Open Font License 1.1',commercial:'免费商用'},
 {id:'nonflowers',name:'Nonflowers',source:'LingDong-/nonflowers',sourceUrl:'https://github.com/LingDong-/nonflowers',category:'实验项目',chinese:false,license:'MIT',commercial:'代码可商用',note:'这是工笔花卉程序生成项目，不是字体家族。'}
);
fs.writeFileSync('public/font-catalog.json',JSON.stringify(rows,null,2));
console.log(`font catalog: ${rows.length}`);
