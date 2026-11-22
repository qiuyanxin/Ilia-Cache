import {icon} from './icons.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SOURCES=[
 {name:'MotionSites',url:'https://motionsites.ai',match:'MotionSites',type:'页面设计与提示词',note:'已收录 281 个免费页面参考；3 个为 MCP 原始提示词，其余明确标为复刻任务。'},
 {name:'Motion Prompt',url:'https://showheyohtaki.github.io/motion-prompt/',match:'Motion Prompt',type:'动效、镜头与提示词',note:'MIT 许可的 240 条动效词典，已保存中文名、运动规格、Canvas 参考代码与可复制提示词。'},
 {name:'DesignPrompts',url:'https://designprompts.dev',match:'designprompts.dev',type:'页面提示词生成器',note:'免费 Builder 提供 12 种页面类型和 48 种视觉风格；代码与完整系统属于 Pro，未冒充免费模板导入。'},
 {name:'21st.dev',url:'https://21st.dev/community/templates',match:'21st.dev',type:'开源组件与模板索引',note:'可查看预览、源码和许可；部分批量下载能力需要付费，本站只保留原始链接与许可明确的内容。'},
 {name:'Aceternity UI',url:'https://ui.aceternity.com',match:'ui.aceternity.com',type:'界面与动效组件',note:'免费区是组件；完整页面与模板属于付费产品，因此没有整页复制进来。'},
 {name:'DesignBookmark',url:'https://designbookmark.com/motion',secondary:'https://designbookmark.com/bookmarks',match:'designbookmark.com/motion',type:'Motion 动效与 Bookmarks',note:'Motion 的公开组件已经完整收录；Bookmarks 是个人账号收藏入口。'},
 {name:'React Bits',url:'https://reactbits.dev',match:'reactbits.dev',type:'React 组件',note:'免费仓库是组件库；Pro 页面模板未导入。私人学习库对外发布前须逐项核对许可。'},
 {name:'LeiBox',url:'https://leibox.pantoria.cn',match:'leibox.pantoria.cn',type:'组件收录',note:'已安装 LeiBox Skill；未把组件卡片冒充为完整页面模板。详情页有更早来源时，以第一来源为准。'},
 {name:'Transitions.dev',url:'https://github.com/Jakubantalik/transitions.dev',match:'transitions.dev',type:'转场与微交互',note:'33 个免费转场规范留在组件库，并保留原许可、来源和再分发限制。'},
 {name:'Paper Shaders',url:'https://github.com/paper-design/shaders',match:'paper-shaders',type:'背景与材质',note:'通过 @paper-design/shaders-react 安装的实时着色器。'},
 {name:'Kokonut UI',url:'https://kokonutui.com',match:'kokonutui.com',type:'React 组件',note:'按具体组件页标注的许可使用。'},
 {name:'SmoothUI',url:'https://smoothui.dev',match:'smoothui.dev',type:'React 组件',note:'按具体组件页标注的许可使用。'}
];
export function installSourcesPage(h){const page=document.createElement('main');page.id='sources-page';page.hidden=true;document.querySelector('#font-library').after(page);let showing=false;
 const count=s=>h.getState().resources.filter(r=>!r.archived&&[r.url,r.primarySourceUrl,r.collectionSource?.url,r.sourceShort].join(' ').includes(s.match)).length;
 function render(){page.innerHTML=`<div class="page-heading"><h1>来源说明</h1></div><section class="rights-note"><h2>仅供学习使用。</h2><p>第三方设计、代码与素材的权利归原权利人所有，使用须遵守其许可。</p><p>本站是个人学习与交互实验项目，不代表第三方作者或项目的背书。公开链接、免费提供或改写实现，都不等于获得复制、分发或商用权利。</p><p>代码许可不一定包含照片、插画、字体、商标与参考设计。对外发布前应替换为自有或已授权素材。</p></section><section class="source-list"><h2>组件与资源站</h2>${SOURCES.map(s=>`<article><div><h3>${esc(s.name)}</h3><p>${esc(s.type)} · ${count(s)} 项</p></div><p>${esc(s.note)}</p><div><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">打开来源 ↗</a>${s.secondary?`<a href="${esc(s.secondary)}" target="_blank" rel="noopener noreferrer">Bookmarks ↗</a>`:''}</div></article>`).join('')}</section><section class="connection-list"><h2>工具连接</h2><article><div><h3>MotionSites MCP</h3><p>让 Agent 查找动效参考。</p></div><code>codex mcp add motionsites --url https://motionsites.ai/api/mcp</code><button data-copy-command="codex mcp add motionsites --url https://motionsites.ai/api/mcp">${icon('copy')}复制命令</button></article><article><div><h3>LeiBox Skill</h3><p>让 Agent 查找已收录组件的源码、许可与来源。</p></div><code>npx skills add https://leibox.pantoria.cn --skill leibox</code><button data-copy-command="npx skills add https://leibox.pantoria.cn --skill leibox">${icon('copy')}复制命令</button></article></section>`;page.querySelectorAll('[data-copy-command]').forEach(b=>b.onclick=()=>h.copy(b.dataset.copyCommand));}
 function show(){showing=true;for(const id of ['library','learning','component-library','collection-pages','projects-page','page-library','font-library','home-page'])document.getElementById(id)?.setAttribute('hidden','');page.hidden=false;document.querySelector('#breadcrumb').textContent='来源说明';render();}
 function leave(){showing=false;page.hidden=true;}
 return {show,leave,get showing(){return showing;}};
}
