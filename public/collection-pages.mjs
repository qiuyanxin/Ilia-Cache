import { referencesByStyle, renderVisualReferenceTabs } from './visual-reference-view.mjs';
import {STYLE_REFERENCE_SUBCATEGORIES,styleReferenceGroup,styleReferenceSubcategory} from './component-categories.mjs';
import {isComponent} from './extensions.js';
import {mountFileDrop,uploadFile,filesFromDataTransfer} from './native-controls.mjs';
import {mountGlassFolder} from './glass-folders.mjs';
import {parseCapture,CAPTURE_TYPES,detectCaptureInput} from './capture-model.mjs';
import {icon} from './icons.mjs';
import {bindButtonPress} from './springs.mjs';
import {compareFavoriteNames} from './favorite-button.mjs';
import {captureType,filterByWorkbenchType,workbenchTabs,workbenchTypeTabs} from './workbench-taxonomy.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const publicLink=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const assetLink=s=>/^\/api\/assets\/[a-f0-9-]+\.[a-z0-9]+$/.test(s||'')?s:publicLink(s);
const ACCEPTED_FILE=/\.(?:png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav|woff2?|ttf|otf|txt|md|html|css|js|mjs|json|tsx|jsx|ts|vue|svelte)$/i;
const usableFile=f=>Boolean(f&&f.size<=100*1024*1024&&ACCEPTED_FILE.test(f.name)&&!/(^|\/)\.(?:DS_Store|git|svn)(?:\/|$)/i.test(f.webkitRelativePath||f.name));
export function installCollectionPages(h,styleSeed){
 const {getState,save,toast,copy}=h;let current='',styleTab='设计风格',referenceQuery='',referenceCategory='全部',styleQuery='',styleGroup='全部',captureState='pending',captureFilter='all',folderController=null,preset={},pendingFiles=[],saving=false,dropController=null;
 const pages=document.createElement('main');pages.id='collection-pages';pages.hidden=true;document.querySelector('#component-library').after(pages);
 const capture=document.createElement('dialog');capture.id='capture-dialog';document.body.append(capture);
 const detail=document.createElement('dialog');detail.id='collection-detail';document.body.append(detail);
 const allStyles=()=>{const map=new Map(styleSeed.map(s=>[s.id,s]));for(const s of getState().styles||[])map.set(s.id,{...map.get(s.id),...s,references:[...new Map([...(map.get(s.id)?.references||[]),...(s.references||[])].map(r=>[r.image,r])).values()]});return [...map.values()].map(s=>({...s,references:(s.references||[]).filter(r=>!(s.removedReferences||[]).includes(r.image))})).filter(s=>!s.archived);};
 const styleReferences=()=>getState().resources.filter(item=>isComponent(item)&&styleReferenceGroup(item));
 const styleCount=()=>{
  const styles=allStyles(),refs=styleReferences();
  return styles.length+refs.length-referencesByStyle(styles,refs).size;
 };
 const entries=()=>(getState().inbox||[]).filter(r=>!r.archived);
 const coverOf=s=>assetLink(entries().filter(r=>r.styleId===s.id).flatMap(r=>r.attachments||[]).find(a=>a.type?.startsWith('image/')||a.type==='image')?.url)||publicLink(s.references?.[0]?.image);
 function closeDetail(){detail.close();detail.replaceChildren();}
 function heading(title,actions=''){return `<div class="page-heading"><h1>${title}</h1><div class="page-heading-actions">${actions}</div></div>`;}
 function wireWorkbenchTabs(){pages.querySelectorAll('[data-workbench-view]').forEach(button=>button.onclick=()=>h.switchView(button.dataset.workbenchView));}
 function imageMarkup(a,title=''){const url=assetLink(a.url);if(!url)return '';return a.type?.startsWith('video/')||a.type==='video'?`<video src="${esc(url)}" controls playsinline preload="metadata" ${a.poster?`poster="${esc(assetLink(a.poster))}"`:''}></video>`:a.type?.startsWith('image/')||a.type==='image'?`<img src="${esc(url)}" alt="${esc(title)}" loading="lazy" referrerpolicy="no-referrer" ${a.width&&a.height?`width="${Number(a.width)}" height="${Number(a.height)}"`: ''}> `:`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('download')}${esc(a.name||'附件')}</a>`;}
 function wireClose(){detail.querySelector('[data-close]').onclick=closeDetail;}
 function leave(){if(current==='styles')h.stopComponentCards?.();current='';pages.hidden=true;folderController?.destroy();folderController=null;}
 function show(kind){current=kind;document.querySelector('#library').hidden=true;document.querySelector('#learning').hidden=true;document.querySelector('#component-library').hidden=true;pages.hidden=false;document.querySelector('#breadcrumb').textContent=kind==='styles'?'视觉参考':'工作台';render();}
 function render(){if(!current)return;if(current==='styles')renderStyles();if(current==='capture')renderCapture();}
 function bindStyleTabs(){
  pages.querySelectorAll('[data-style-tab]').forEach(button=>button.onclick=event=>{
   styleTab=button.dataset.styleTab;
   referenceQuery='';
   referenceCategory='全部';
   renderStyles();
   if(event.detail===0)pages.querySelector('[data-style-tab][aria-pressed="true"]')?.focus();
  });
 }
 function renderStyles(){
  folderController?.destroy();folderController=null;
  h.stopComponentCards?.();
  const catalog=allStyles(),references=styleReferences();
  const matched=referencesByStyle(catalog,references);
  const standalone=references.filter(item=>!matched.has(item.id));
  const tabs=renderVisualReferenceTabs(styleTab,catalog.length,standalone);
  if(styleTab!=='设计风格'){
   const referencesInTab=standalone.filter(item=>styleReferenceGroup(item)===styleTab)
    .map(item=>({item,category:styleReferenceSubcategory(item)}));
   const availableCategories=new Set(referencesInTab.map(({category})=>category));
   const groups=['全部',...Object.keys(STYLE_REFERENCE_SUBCATEGORIES[styleTab]),'其他']
    .filter(name=>name==='全部'||availableCategories.has(name));
   if(!groups.includes(referenceCategory))referenceCategory='全部';
   pages.innerHTML=heading('视觉参考')+tabs+`<div class="collection-toolbar style-reference-toolbar">
    <input id="style-reference-search" data-command-search aria-label="搜索${styleTab}" placeholder="搜索${styleTab}" value="${esc(referenceQuery)}">
    <nav class="collection-chips" aria-label="${styleTab}细分分类">${groups.map(name=>`<button type="button" data-style-reference-category="${name}" class="${name===referenceCategory?'active':''}" aria-pressed="${name===referenceCategory}">${name}</button>`).join('')}</nav>
   </div><div class="component-grid style-reference-grid"></div>`;
   const input=pages.querySelector('#style-reference-search'),grid=pages.querySelector('.style-reference-grid');
   const renderReferences=()=>{
    const query=referenceQuery.trim().toLowerCase();
    const items=referencesInTab.filter(({item,category})=>(referenceCategory==='全部'||category===referenceCategory)
     &&(!query||[item.name,item.originalName,item.note,item.description,...(item.tags||[]),category].join(' ').toLowerCase().includes(query)))
     .map(({item})=>item);
    h.renderComponentCards(grid,items);
   };
   input.oninput=()=>{referenceQuery=input.value;renderReferences();};
   const categoryButtons=pages.querySelectorAll('[data-style-reference-category]');
   categoryButtons.forEach(button=>button.onclick=()=>{
    referenceCategory=button.dataset.styleReferenceCategory;
    for(const option of categoryButtons){
     option.classList.toggle('active',option===button);
     option.setAttribute('aria-pressed',String(option===button));
    }
    renderReferences();
   });
   bindStyleTabs();
   renderReferences();
   return;
  }
  const styles=catalog.filter(s=>(styleGroup==='全部'||styleGroup==='常用风格'?styleGroup==='全部'||s.frequent:(s.group==='常用风格'?'视觉风格':s.group)===styleGroup)&&(!styleQuery||[s.name,s.english,s.prompt].join(' ').toLowerCase().includes(styleQuery.toLowerCase()))).sort((a,b)=>compareFavoriteNames(a,b,s=>s.english||s.name,s=>s.frequent));const order=['全部','常用风格','视觉风格','艺术史','设计史'],groups=[...order,...new Set(catalog.map(s=>s.group==='常用风格'?'视觉风格':s.group||'自建风格'))].filter((v,i,a)=>a.indexOf(v)===i);pages.innerHTML=heading('视觉参考')+tabs+`<div class="collection-toolbar"><input id="style-search" data-command-search aria-label="搜索风格" placeholder="搜索风格" value="${esc(styleQuery)}"><div class="collection-chips">${groups.map(g=>`<button data-style-group="${esc(g)}" class="${g===styleGroup?'active':''}">${esc(g)}</button>`).join('')}</div></div><div id="style-folders"></div>`;const host=pages.querySelector('#style-folders');folderController=mountGlassFolder(host,{folders:styles.map(s=>({id:s.id,label:s.name,subtitle:s.english,cover:coverOf(s),files:[{name:'素材',meta:String(entries().filter(r=>r.styleId===s.id).length+(s.references?.length||0))+' 项',id:1,image:coverOf(s)},{name:'提示词',meta:'',id:0}],tone:document.documentElement.dataset.theme,action:'add'})),onSelect:(id,f)=>openStyle(id,f.name==='素材'?'素材':'提示词'),onFolderOpen:id=>setTimeout(()=>{if(current==='styles'&&!detail.open)openStyle(id);},220)});
  host.querySelectorAll('.gf-key--add').forEach((button,index)=>{
   const style=styles[index],slot=button.closest('.gf-demo-slot');
   if(!style||!slot)return;
   slot.classList.add('favorite-surface');
   button.className='card-action card-action--cart';
   slot.append(button);
   h.projects?.bindReferenceButton(button,{id:'style:'+style.id,type:'style',name:style.name,image:coverOf(style),url:`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(style.pinterestQuery||style.english||style.name)}`});
  });bindStyleTabs();pages.querySelectorAll('[data-style-group]').forEach(b=>b.onclick=()=>{styleGroup=b.dataset.styleGroup;renderStyles();});pages.querySelector('#style-search').oninput=e=>{styleQuery=e.target.value;const at=e.target.selectionStart;renderStyles();const next=pages.querySelector('#style-search');next.focus();next.setSelectionRange(at,at);};}
 function openStyle(id,tab='素材',language='zh'){
  const styles=allStyles(),s=styles.find(s=>s.id===id);if(!s)return;
  const refs=styleReferences(),matches=referencesByStyle(styles,refs),related=refs.filter(item=>matches.get(item.id)===id);
 detail.innerHTML=`<div class="dialog-heading"><div><h2>${esc(s.name)}</h2>${s.english?`<p class="style-english">${esc(s.english)}</p>`:''}</div><button data-close aria-label="关闭">${icon('close')}</button></div><div class="detail-tabs"><button data-stab="素材" class="${tab==='素材'?'active':''}">素材</button><button data-stab="提示词" class="${tab==='提示词'?'active':''}">提示词</button></div><div class="style-detail-actions"><button class="quiet" id="toggle-frequent" aria-pressed="${Boolean(s.frequent)}">${s.frequent?'取消常用':'设为常用'}</button><button class="quiet" id="style-project">${icon('plus')}加入项目</button><button class="quiet" id="style-edit">${icon('edit')}编辑风格</button>${related.map(item=>`<button class="quiet" type="button" data-style-example="${esc(item.id)}">查看 Motion Prompt 示例</button>`).join('')}<a class="pinterest-style-link" href="https://www.pinterest.com/search/pins/?q=${encodeURIComponent(s.pinterestQuery||s.english||s.name)}" target="_blank" rel="noopener noreferrer">Pinterest ↗</a>${tab==='素材'?`<button id="add-style-material" class="primary">${icon('plus')}添加素材</button>`:''}</div><div id="style-detail-body"></div>`;const body=detail.querySelector('#style-detail-body');wireClose();detail.querySelectorAll('[data-style-example]').forEach(button=>button.onclick=()=>h.openComponent(button.dataset.styleExample));const addMaterial=detail.querySelector('#add-style-material');if(addMaterial){bindButtonPress(addMaterial);addMaterial.onclick=()=>{closeDetail();openCapture({styleId:id,category:'设计风格'});};}detail.querySelectorAll('[data-stab]').forEach(b=>b.onclick=()=>openStyle(id,b.dataset.stab));detail.querySelector('#style-edit').onclick=()=>editStyle(s);detail.querySelector('#style-project').onclick=()=>h.projects?.addReference({id:'style:'+s.id,type:'style',name:s.name,image:coverOf(s),url:`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(s.pinterestQuery||s.english||s.name)}`});detail.querySelector('#toggle-frequent').onclick=()=>{upsertStyle({...s,frequent:!s.frequent});openStyle(id,tab,language);};if(tab==='提示词'){body.innerHTML=`${s.promptEn?`<div class="language-tabs"><button data-lang="zh" class="${language==='zh'?'active':''}">中文</button><button data-lang="en" class="${language==='en'?'active':''}">English</button></div>`:''}<textarea id="style-prompt" rows="9" aria-label="风格提示词"></textarea><div class="dialog-actions"><button id="copy-style-prompt" class="outline">复制提示词</button><button id="save-style-prompt" class="primary">保存提示词</button></div>`;body.querySelector('textarea').value=language==='en'?s.promptEn:s.prompt;body.querySelector('#copy-style-prompt').onclick=()=>copy(body.querySelector('textarea').value);bindButtonPress(body.querySelector('#save-style-prompt'));body.querySelector('#save-style-prompt').onclick=()=>{const next={...s,[language==='en'?'promptEn':'prompt']:body.querySelector('textarea').value};upsertStyle(next);toast('已保存');};body.querySelectorAll('[data-lang]').forEach(b=>b.onclick=()=>openStyle(id,tab,b.dataset.lang));}else{const saved=entries().filter(r=>r.styleId===id);body.innerHTML=`<div class="style-material-grid">${saved.map(r=>entryMarkup(r)).join('')}${(s.references||[]).map((ref,index)=>`<article><button type="button" class="saved-entry-media" data-open-style-ref="${index}" aria-label="查看素材 ${esc(s.name)}"><img src="${esc(publicLink(ref.image))}" alt="${esc(s.name)}" loading="lazy" referrerpolicy="no-referrer"></button></article>`).join('')}</div>`;
   body.querySelectorAll('[data-open-style-ref]').forEach(button=>button.onclick=()=>{
    const ref=s.references[Number(button.dataset.openStyleRef)];
    if(!ref)return;
    openMaterial(s.name,{type:'image',url:ref.image},ref.source,()=>{
     s.removedReferences=[...new Set([...(s.removedReferences||[]),ref.image])];
     upsertStyle(s);
     openStyle(id,'素材');
    },()=>openStyle(id,'素材'));
   });
   wireEntries(body);}if(!detail.open)detail.showModal();}
 function upsertStyle(s){getState().styles||=[];const i=getState().styles.findIndex(x=>x.id===s.id);if(i<0)getState().styles.push(s);else getState().styles[i]=s;save();render();}
 function editStyle(style=null){detail.innerHTML=`<form id="style-form"><div class="dialog-heading"><h2>${style?'编辑风格':'添加风格'}</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div><input name="name" required placeholder="中文名称" aria-label="中文名称" value="${esc(style?.name||'')}"><input name="english" placeholder="英文名称" aria-label="英文名称" value="${esc(style?.english||'')}"><select name="group" aria-label="风格分类">${['视觉风格','艺术史','设计史','自建风格'].map(g=>`<option ${g===(style?.group||'自建风格')?'selected':''}>${g}</option>`).join('')}</select><input name="source" type="url" placeholder="参考链接或 Pinterest 链接" aria-label="参考链接" value="${esc(style?.source||'')}"><textarea name="prompt" rows="9" required placeholder="粘贴完整风格提示词" aria-label="风格提示词">${esc(style?.prompt||'')}</textarea><div class="dialog-actions"><div class="style-file-actions"><label class="compact-file-control" aria-label="选择素材文件" title="选择素材文件">${icon('upload')}<input name="files" type="file" multiple hidden accept="image/*,video/*"></label><label class="compact-file-control" aria-label="选择素材文件夹" title="选择素材文件夹">${icon('folder')}<input name="folder" type="file" multiple webkitdirectory hidden></label></div><button class="primary" type="submit">保存风格</button></div></form>`;bindButtonPress(detail.querySelector('button[type="submit"]'));wireClose();if(!detail.open)detail.showModal();detail.querySelector('form').onsubmit=e=>{e.preventDefault();const form=e.currentTarget,f=new FormData(form),prompt=f.get('prompt');const s={...style,id:style?.id||crypto.randomUUID(),name:f.get('name').trim()||prompt.split('\n')[0].slice(0,24),english:f.get('english').trim(),prompt,group:f.get('group'),source:f.get('source'),references:style?.references||[]};upsertStyle(s);const files=[...form.elements.files.files,...form.elements.folder.files];if(files.length){closeDetail();openCapture({styleId:s.id,category:'设计风格',initialFiles:files});}else openStyle(s.id);};}
 function entryMarkup(r,aesthetic=false,attachmentIndex=null){const media=attachmentIndex===null?r.attachments||[]:[r.attachments?.[attachmentIndex]].filter(Boolean),visual=(aesthetic?media:media.slice(0,1)).map(a=>imageMarkup(a,r.title)).join('');if(aesthetic){return `<article class="saved-entry aesthetic-entry favorite-surface" data-entry="${esc(r.id)}">
  <button type="button" class="saved-entry-media" data-open-material="${esc(r.id)}" ${attachmentIndex===null?'':`data-attachment-index="${attachmentIndex}"`} aria-label="查看素材 ${esc(r.title||r.collection||'')}">${visual}</button>
  <button type="button" class="card-action card-action--cart" data-project-entry="${esc(r.id)}" aria-label="加入项目 ${esc(r.title||r.collection||'')}">${icon('plus')}</button>
 </article>`;}return `<article class="saved-entry" data-entry="${esc(r.id)}"><div class="saved-entry-media">${visual}<button type="button" class="inbox-edit-trigger" data-open-entry="${esc(r.id)}" aria-label="编辑 ${esc(r.title||r.collection||r.category)}"></button></div><button type="button" class="card-action card-action--cart" data-project-entry="${esc(r.id)}" aria-label="加入项目 ${esc(r.title||r.collection||'')}">${icon('plus')}</button>${r.text?`<button data-open-entry="${esc(r.id)}" class="entry-text"><h3>${esc(r.title)}</h3><p>${esc(r.text.slice(0,180))}</p></button>`:''}<div class="saved-entry-actions"><button data-open-entry="${esc(r.id)}">${esc(r.collection||r.category)}</button>${r.source?`<a href="${esc(publicLink(r.source))}" target="_blank" rel="noopener noreferrer" aria-label="打开来源">${icon('link')}</a>`:''}</div></article>`;}
 function waterfallMarkup(rows){return rows.flatMap(r=>(r.attachments||[]).length>1?r.attachments.map((_,index)=>entryMarkup(r,true,index)):[entryMarkup(r,true)]).join('');}
 function removeAttachment(id,index){const r=entries().find(x=>x.id===id);if(!r||!r.attachments?.[index])return;r.attachments.splice(index,1);if(!r.attachments.length)r.archived=true;save();render();toast('已删除素材');}
 function removeEntry(id){const r=entries().find(x=>x.id===id);if(!r)return;r.archived=true;save();render();toast('已删除素材');}
 function openMaterial(title,attachment,source,remove,back=closeDetail){
  const url=publicLink(source);
  detail.innerHTML=`<div class="dialog-heading"><h2>${esc(title)}</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>
   <div class="detail-assets">${imageMarkup(attachment,title)}</div>
   <div class="dialog-actions"><button type="button" class="quiet" data-delete-material>删除素材</button>${url?`<a class="outline" href="${esc(url)}" target="_blank" rel="noopener noreferrer">打开来源 ↗</a>`:''}</div>`;
  detail.querySelector('[data-close]').onclick=back;
  detail.querySelector('[data-delete-material]').onclick=remove;
  if(!detail.open)detail.showModal();
 }
 function wireEntries(root){
  root.querySelectorAll('[data-open-entry]').forEach(button=>button.onclick=()=>openEntry(button.dataset.openEntry,button.closest('.saved-entry')||button));
  root.querySelectorAll('[data-open-material]').forEach(button=>button.onclick=()=>{
   const entry=entries().find(item=>item.id===button.dataset.openMaterial);
   if(!entry)return;
   const index=button.dataset.attachmentIndex;
   const attachment=entry.attachments?.[Number(index??0)];
   if(!attachment){openEntry(entry.id,button);return;}
   openMaterial(entry.title||entry.collection||'素材',attachment,entry.source||entry.urls?.[0],()=>{
    if(index===undefined)removeEntry(entry.id);else removeAttachment(entry.id,Number(index));
    closeDetail();
   });
  });
  root.querySelectorAll('[data-project-entry]').forEach(button=>{
   const entry=entries().find(item=>item.id===button.dataset.projectEntry);
   if(entry)h.projects?.bindReferenceButton(button,{id:'entry:'+entry.id,type:captureType(entry),name:entry.title||entry.collection,image:entry.attachments?.[0]?.url||'',url:entry.source||entry.urls?.[0]||''});
  });
  root.querySelectorAll('img').forEach(img=>img.onerror=()=>{img.classList.add('image-failed');img.alt='图片暂不可用';});
 }

 function renderCapture(){const all=entries(),stateRows=captureState==='pending'?all.filter(r=>!r.inboxDone):all,rows=filterByWorkbenchType(stateRows,captureFilter,captureType),empty=captureState==='pending'?'待整理是空的，可以放心去采集。':'还没有这一类采集。';pages.innerHTML=heading('工作台',`<button id="pinterest-connect">${icon('link')}Pinterest</button>`)+workbenchTabs('capture')+`<nav class="collection-chips capture-state-tabs" aria-label="采集状态"><button data-capture-state="pending" class="${captureState==='pending'?'active':''}" aria-pressed="${captureState==='pending'}">待整理 <small>${all.filter(r=>!r.inboxDone).length}</small></button><button data-capture-state="all" class="${captureState==='all'?'active':''}" aria-pressed="${captureState==='all'}">全部采集 <small>${all.length}</small></button></nav>`+workbenchTypeTabs(captureFilter,stateRows,captureType,'data-capture-type')+`<div class="capture-grid">${rows.map(r=>entryMarkup(r)).join('')||`<p class="empty">${empty}</p>`}</div>`;wireWorkbenchTabs();pages.querySelector('#pinterest-connect').onclick=openPinterest;pages.querySelectorAll('[data-capture-state]').forEach(button=>button.onclick=()=>{captureState=button.dataset.captureState;renderCapture();});pages.querySelectorAll('[data-capture-type]').forEach(button=>button.onclick=()=>{captureFilter=button.dataset.captureType;renderCapture();});wireEntries(pages);}
 function animateEntryOpen(opener){if(!opener||matchMedia("(prefers-reduced-motion: reduce)").matches)return;const start=opener.getBoundingClientRect(),target=detail.getBoundingClientRect();detail.classList.add("t-resize");detail.style.width=Math.min(start.width,target.width)+"px";detail.style.height=Math.min(start.height,target.height)+"px";detail.getBoundingClientRect();requestAnimationFrame(()=>{detail.style.width=target.width+"px";detail.style.height=target.height+"px";});setTimeout(()=>{detail.classList.remove("t-resize");detail.style.removeProperty("width");detail.style.removeProperty("height");},320);}
 function openEntry(id,opener){const r=entries().find(x=>x.id===id);if(!r)return;const collections=[...new Set([...(getState().aestheticCategories||[]),...entries().map(x=>x.collection).filter(Boolean),r.collection||'未分类'])];detail.innerHTML=`<div class="dialog-heading"><h2>${esc(r.title||r.collection||'采集')}</h2><button data-close aria-label="关闭">${icon('close')}</button></div><div class="detail-assets">${(r.attachments||[]).map(a=>imageMarkup(a,r.title)).join('')}</div><textarea id="entry-original" rows="3" aria-label="备注与提示词" placeholder="补充提示词、来源说明或收藏原因"></textarea><div class="entry-links">${(r.urls||[]).map(u=>`<a href="${esc(publicLink(u))}" target="_blank" rel="noopener noreferrer">${esc(new URL(u).hostname)} ${icon('link')}</a>`).join('')}</div><div class="entry-classifiers"><label><span>内容类型</span><select id="entry-category" aria-label="内容类型">${[...CAPTURE_TYPES,'审美素材'].map(c=>`<option ${c===r.category?'selected':''}>${c}</option>`).join('')}</select></label><label><span>保存位置</span><select id="entry-collection" aria-label="保存位置">${collections.map(c=>`<option ${c===(r.collection||'未分类')?'selected':''}>${esc(c)}</option>`).join('')}</select></label></div><div class="dialog-actions"><button id="entry-remove" class="quiet">移除采集</button><div class="dialog-actions-group"><button id="entry-inbox" class="quiet">${r.inboxDone?'标为待整理':'完成整理'}</button><button id="entry-copy" class="outline">复制提示词</button><button id="entry-save" class="primary">保存修改</button></div></div>`;bindButtonPress(detail.querySelector('#entry-save'));wireClose();const original=detail.querySelector('#entry-original');const resizeOriginal=()=>{original.style.height='auto';original.style.height=`${Math.min(original.scrollHeight,180)}px`;original.style.overflowY=original.scrollHeight>180?'auto':'hidden';};original.value=r.text||'';original.oninput=resizeOriginal;resizeOriginal();detail.querySelector('#entry-copy').onclick=()=>copy(original.value);detail.querySelector('#entry-save').onclick=()=>{r.text=original.value;r.category=detail.querySelector('#entry-category').value;r.collection=detail.querySelector('#entry-collection').value;r.aesthetic=r.category==='审美素材';save();render();toast('已保存');};detail.querySelector('#entry-inbox').onclick=()=>{r.inboxDone=!r.inboxDone;save();h.nav();closeDetail();render();toast(r.inboxDone?'已完成整理':'已标为待整理');};detail.querySelector('#entry-remove').onclick=()=>{r.archived=true;save();closeDetail();render();toast('已移除');const undo=document.createElement('button');undo.textContent='撤销';undo.onclick=()=>{r.archived=false;save();render();toast('已恢复');};document.querySelector('#toast').append(undo);};if(!detail.open)detail.showModal();animateEntryOpen(opener);}
 function openCapture(options={}){
  preset=options;pendingFiles=[];const quick=!options.aesthetic&&!options.styleId;
  const fileInput='<input id="capture-files" type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/*,.txt,.md,.html,.css,.js,.mjs,.json,.tsx,.jsx,.ts,.vue,.svelte">';
  capture.innerHTML=quick?`<form id="capture-form" class="quick-capture"><div class="dialog-heading"><div><h2>添加到资料库</h2><p>网址、组件命令、代码、文字或文件都可以</p></div><button type="button" id="close-capture" aria-label="关闭">${icon('close')}</button></div><div class="quick-capture-composer"><textarea id="capture-text" rows="7" aria-label="添加内容" placeholder="粘贴网址、组件命令、代码或文字…"></textarea><div id="capture-attachments"></div><div class="quick-capture-tools">${fileInput}<div id="material-file-drop"></div><label class="attachment-button folder-button" title="导入文件夹" aria-label="导入文件夹">${icon('folder')}<input id="capture-folder" type="file" multiple webkitdirectory hidden></label></div></div><div class="capture-actions dialog-actions quick-capture-actions"><span id="capture-state">等待输入</span><button class="primary" type="submit" id="capture-submit">继续</button></div></form>`:`<form id="capture-form"><div class="dialog-heading"><h2>添加素材</h2><button type="button" id="close-capture" aria-label="关闭">${icon('close')}</button></div><div id="material-file-drop"></div><textarea id="capture-text" rows="9" aria-label="添加内容" placeholder="粘贴提示词、链接，或拖入图片和视频"></textarea><div id="capture-attachments"></div><div class="capture-actions dialog-actions"><label class="attachment-button" title="添加附件">${icon('plus')}${fileInput}</label><label class="attachment-button folder-button" title="导入文件夹">${icon('folder')}<input id="capture-folder" type="file" multiple webkitdirectory hidden></label><span id="capture-state"></span><button class="primary" type="submit" id="capture-submit">保存</button></div></form>`;
  bindButtonPress(capture.querySelector('#capture-submit'));capture.querySelector('#close-capture').onclick=()=>{if(!saving)capture.close();};const dropHost=capture.querySelector('#material-file-drop');dropController=mountFileDrop(dropHost,capture.querySelector('#capture-files'),files=>{addFiles(files);});if(quick)dropHost.classList.add('quick-file-drop');capture.querySelector('#capture-folder').onchange=e=>{addFiles([...e.target.files]);e.target.value='';};const box=capture.querySelector('textarea');const updateDetected=()=>{if(!quick)return;const detected=detectCaptureInput(box.value,pendingFiles,preset.expected);capture.querySelector('#capture-state').textContent=box.value.trim()||pendingFiles.length?`识别为：${detected.label}`:'等待输入';capture.querySelector('#capture-submit').textContent=detected.kind==='component'?'预览并确认':'保存';};box.oninput=updateDetected;box.onpaste=e=>{const files=[...e.clipboardData.files];if(files.length){e.preventDefault();addFiles(files);}};capture.ondragover=e=>{e.preventDefault();capture.classList.add('is-dragging');};capture.ondragleave=()=>capture.classList.remove('is-dragging');capture.ondrop=async e=>{e.preventDefault();e.stopPropagation();capture.classList.remove('is-dragging');addFiles(await filesFromDataTransfer(e.dataTransfer));};capture.querySelector('form').onsubmit=submitCapture;if(options.initialFiles?.length)addFiles(options.initialFiles);updateDetected();if(!capture.open)capture.showModal();box.focus();
 }
 function addFiles(files){let skipped=0;const known=new Set(pendingFiles.map(f=>`${f.webkitRelativePath||f.name}:${f.size}:${f.lastModified}`));for(const f of files){if(!usableFile(f)){skipped++;continue;}const key=`${f.webkitRelativePath||f.name}:${f.size}:${f.lastModified}`;if(known.has(key))continue;known.add(key);pendingFiles.push(f);}if(skipped)toast(`已跳过 ${skipped} 个系统文件或不支持的格式`);capture.querySelector('#capture-attachments').innerHTML=pendingFiles.map((f,i)=>`<span>${esc(f.webkitRelativePath||f.name)}<button type="button" data-remove-file="${i}" aria-label="移除 ${esc(f.name)}">${icon('close')}</button></span>`).join('');capture.querySelectorAll('[data-remove-file]').forEach(b=>b.onclick=()=>{pendingFiles.splice(Number(b.dataset.removeFile),1);addFiles([]);});capture.querySelector('textarea')?.dispatchEvent(new Event('input'));}
 async function saveDetectedLink(kind,parsed,attachments,files){
  const url=parsed.source;
  if(!url)throw Error('没有识别到可用的网址');
  if(getState().resources.some(item=>!item.archived&&item.url===url))throw Error('这个网址已经收藏过了');
  let metadata={};
  try{metadata=await h.readMetadata(url);}catch{}
  const created=new Date().toISOString();
  const name=(metadata.title||parsed.title||new URL(url).hostname).split(/[|｜]/)[0].trim();
  const media=[...(metadata.media||[]),...attachments.map(item=>({...item,type:item.type?.startsWith('video/')?'video':'image'}))];
  const record=kind==='page'?{
   id:crypto.randomUUID(),name,url,category:'页面模板',kind:'案例',caseType:'网页参考',pageCategory:'内容与行业',
   prompt:'',promptKind:'user',promptStatus:'我的提示词',source:'手动收藏',sourceShort:'我的收藏',media,files,
   tags:['内容与行业'],cost:'',gets:'参考',created,
  }:{
   id:crypto.randomUUID(),name,url,kind:'网站',category:'工具',description:metadata.description||'',tags:[],gets:'网站',cost:'待核实',
   source:'手动收藏',favorite:false,note:'',prompt:'',license:'待核实',media,created,
  };
  getState().resources.unshift(record);save();h.nav();capture.close();h.switchView(kind==='page'?'pages':'all');toast(kind==='page'?'已加入页面库':'已加入网站库');
 }
 async function submitCapture(e){e.preventDefault();if(saving)return;const text=capture.querySelector('textarea').value.trim();if(!text&&!pendingFiles.length){toast('先放一点内容进来');return;}const detected=detectCaptureInput(text,pendingFiles,preset.expected);if(detected.kind==='component'){
  if(!h.openComponentImporter){toast('组件预览暂时不可用');return;}
  capture.close();h.openComponentImporter({mode:detected.mode,text,files:[...pendingFiles]});return;
 }saving=true;capture.querySelector('#capture-submit').disabled=true;capture.querySelector('#capture-state').textContent='保存中';try{const attachments=[],files=[],failed=[];for(const f of pendingFiles){try{dropController?.start(f.size);const a=await uploadFile(f,(loaded,total)=>dropController?.progress(loaded,total));attachments.push(a);if(/\.(?:html|css|[cm]?js|tsx?|jsx|vue|svelte|json|md|txt)$/i.test(f.name)&&f.size<3*1024*1024)files.push({name:f.name,content:await f.text()});}catch{failed.push(f.name);}}if(!text&&!attachments.length)throw Error('文件夹里没有可保存的支持文件');const parsed=parseCapture(text,attachments);if(detected.kind==='page'||detected.kind==='website'){await saveDetectedLink(detected.kind,parsed,attachments,files);return;}const category=preset.aesthetic?'审美素材':preset.category||parsed.category;const r={id:crypto.randomUUID(),title:parsed.title,text,urls:parsed.urls,source:parsed.source,category,attachments,aesthetic:Boolean(preset.aesthetic),collection:preset.collection||'',styleId:preset.styleId||'',inboxDone:Boolean(preset.aesthetic||preset.styleId),created:new Date().toISOString()};getState().inbox||=[];getState().inbox.unshift(r);if(category==='组件'&&parsed.source){const existing=getState().resources.find(x=>!x.archived&&x.url===parsed.source);if(existing){existing.promptHistory||=[];if(existing.prompt&&existing.prompt!==text)existing.promptHistory.push(existing.prompt);if(text)existing.prompt=text;if(files.length)existing.files=[...(existing.files||[]),...files];}else{getState().resources.unshift({id:crypto.randomUUID(),name:parsed.title,url:parsed.source,category:'组件',kind:'案例',caseType:'组件',componentCategory:/copy|command|input|button|cord/i.test(text)?'按钮与输入':/nav|sidebar|bar|panel/i.test(text)?'菜单与导航':/word|roll/i.test(text)?'文字':'卡片',prompt:text,files,tags:['采集'],description:'',note:'',cost:'',gets:files.length?'源码、提示词':'提示词',created:r.created});}}save();dropController?.done();h.nav();capture.close();captureState=r.inboxDone?'all':'pending';show('capture');toast(failed.length?`已保存，${failed.length} 个文件未导入`:r.inboxDone?'已保存采集':'已进入待整理');if(!attachments.length&&parsed.source)readCaptureMedia(r);h.refreshComponents?.();}catch(error){dropController?.fail();toast(error.message||'保存失败');}finally{saving=false;const b=capture.querySelector('#capture-submit');if(b)b.disabled=false;const status=capture.querySelector('#capture-state');if(status)status.textContent='';}}
 async function readCaptureMedia(r){try{const d=await h.readMetadata(r.source);if(!r.text||r.text===r.source)r.title=d.title?.split(/[|｜]/)[0].slice(0,55)||r.title;r.attachments=(d.media||[]).map(m=>({...m,type:m.type==='video'?'video/mp4':'image/jpeg'}));save();render();}catch{}}
 function openPinterest(){detail.innerHTML=`<form><div class="dialog-heading"><h2>Pinterest</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div><input name="url" type="url" required aria-label="Pinterest 链接" placeholder="粘贴 Pin 或收藏夹链接" value="https://pin.it/1WDu0BkAb"><button class="primary">导入</button></form>`;wireClose();detail.showModal();detail.querySelector('form').onsubmit=e=>{e.preventDefault();importPinterest(new FormData(e.currentTarget).get('url'),e.currentTarget.querySelector('.primary'));};}
 async function importPinterest(url,button){if(button){button.disabled=true;button.textContent='读取中';}try{const response=await fetch('/api/pinterest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});const board=await response.json();if(!response.ok)throw Error(board.error);getState().inbox||=[];let added=0;for(const p of board.pins){const id='pinterest-'+board.id+'-'+p.id;if(getState().inbox.some(r=>r.id===id))continue;getState().inbox.push({id,title:p.title,text:'',source:p.url,urls:[p.url],category:'审美素材',aesthetic:true,inboxDone:true,collection:board.name,boardId:board.id,attachments:[{type:p.video?'video/mp4':'image/jpeg',url:p.video||p.image,poster:p.image,width:p.width,height:p.height}],created:new Date().toISOString()});added++;}getState().pinterestBoards||=[];const row={id:board.id,name:board.name,url:board.url,imported:getState().inbox.filter(r=>!r.archived&&r.boardId===board.id).length,total:board.total,complete:board.complete,updated:new Date().toISOString()};const i=getState().pinterestBoards.findIndex(b=>b.id===board.id);if(i<0)getState().pinterestBoards.push(row);else getState().pinterestBoards[i]=row;save();detail.close();captureState='all';captureFilter='visual';show('capture');toast(`已导入 ${added} 张`);}catch(error){toast(error.message);}finally{if(button){button.disabled=false;button.textContent='导入';}}}
 return {show,leave,render,openCapture,openPinterest,openStyleForm:()=>editStyle(),allStyles,styleCount};
}
