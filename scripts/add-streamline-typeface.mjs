import { readFile, writeFile } from 'node:fs/promises';

const libraryUrl = new URL('../data/library.json', import.meta.url);
const library = JSON.parse(await readFile(libraryUrl, 'utf8'));
library.customFonts ||= [];
library.customFonts = library.customFonts.filter((item) => item.id !== 'font-resource-streamline-typeface');
const entry = {id:'website-streamline-flex-solid-free',name:'Streamline Flex Solid Free',url:'https://www.streamlinehq.com/icons/flex-solid-free',category:'组件',description:'圆润、流动的实心界面图标集，采用紧凑的 14px 网格。',finds:'499 枚免费的 Flex Solid 矢量图标，适合导航、按钮和状态提示。',use:'作为需要更强视觉重量时的备选图标集；需要署名并遵守每项目用量与再分发限制。',gets:'SVG、PNG、JSX',cost:'免费',tags:['图标','SVG','Flex Solid'],kind:'网站',source:'Streamline 官方图标库',favorite:false,note:'Streamline Free License 要求署名并链接到 Streamline；免费集不等同于开源集，不得将完整资源重新分发为可复用图标库。',prompt:'',license:'Streamline Free License（需要署名）',primarySourceUrl:'https://help.streamlinehq.com/en/articles/5354376-streamline-free-license',primarySourceKind:'license',sourcePolicy:'source-link-only',created:'2026-11-22T00:00:00.000Z'};
const index = library.resources.findIndex((item) => item.id === entry.id);
if (index >= 0) library.resources[index] = { ...library.resources[index], ...entry };
else library.resources.push(entry);
const lineEntry = {id:'website-streamline-flex-line-free',name:'Streamline Flex Line Free',url:'https://www.streamlinehq.com/icons/flex-line-free',category:'组件',description:'同属 Streamline Flex 系列的细线界面图标集，采用紧凑的 14px 网格。',finds:'499 枚免费的 Flex Line 矢量图标，适合需要轻盈视觉重量的导航与工具栏。',use:'当前 Cache 侧栏导航使用其中 11 枚；需要署名并遵守每项目用量与再分发限制。',gets:'SVG、PNG、JSX',cost:'免费',tags:['图标','SVG','Flex Line'],kind:'网站',source:'Streamline 官方图标库',favorite:false,note:'Streamline Free License 要求署名并链接到 Streamline；免费集不等同于开源集，不得将完整资源重新分发为可复用图标库。',prompt:'',license:'Streamline Free License（需要署名）',primarySourceUrl:'https://help.streamlinehq.com/en/articles/5354376-streamline-free-license',primarySourceKind:'license',sourcePolicy:'source-link-only',created:'2026-11-22T00:00:00.000Z'};
const lineIndex = library.resources.findIndex((item) => item.id === lineEntry.id);
if (lineIndex >= 0) library.resources[lineIndex] = { ...library.resources[lineIndex], ...lineEntry };
else library.resources.push(lineEntry);
library.siteOverrides = {...(library.siteOverrides||{}),'streamlinehq.com':{...(library.siteOverrides?.['streamlinehq.com']||{}),name:'Streamline Flex Solid Free',homeUrl:entry.url,finds:entry.finds,use:entry.use}};
library.updatedAt = new Date().toISOString();
await writeFile(libraryUrl, `${JSON.stringify(library, null, 2)}\n`);
console.log(index >= 0 && lineIndex >= 0 ? '已更新 Streamline 图标网站。' : '已加入 Streamline 图标网站，并从字体库撤回误加条目。');
