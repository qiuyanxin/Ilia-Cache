import { componentBrowseCategory } from './component-categories.mjs';
import { isMotionPromptRecord, motionPreviewForRecord } from './motion-prompt-preview/index.mjs';
import { officialPreviewForRecord, transitionDemoForRecord } from './official-component-previews.mjs';
import {
  allowsComponentSource, canDistributeSource, componentCategory,
  hasOriginalMotionBundle, isComponentRecord as isComponent, sourcePage,
} from './component-taxonomy.mjs';
import {componentFramePermissions,componentMedia,installDetailMediaPlayback,installPreviewRecovery} from './component-media.mjs';
import {installComponentDirectory} from './component-directory.mjs';
import {installComponentDetailTabs} from './component-detail-tabs.mjs';
import {componentDetailTabs} from './component-directory-url.mjs';
import {renderComponentDetailChrome,renderComponentPrompt,renderPreviewOrigin} from './component-detail-chrome.mjs';
import {installMotionDetailPreview,installOfficialFramePreview,renderDetailMediaStage,renderOfficialFramePreview,renderSoundSourcePreview} from './component-detail-preview.mjs';
import {createComponentPackageCache} from './component-package-cache.mjs';
import {mountComponentSourceFiles,renderComponentSourceContent,renderComponentSourcePanel} from './component-source-panel.mjs';
import {installWorkspaceTheme} from './workspace-theme.mjs';
import {componentWebUrl,referenceMedia,renderPreviewReferences} from './component-workspace.mjs';
import {portableComponentPrompt} from './component-agent-prompt.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function originalMotionNotes(record, files) {
 let pattern=record.motionPattern;
 if(!pattern){
  try{pattern=JSON.parse(files.find(file=>file.name==='pattern.json')?.content||'null');}
  catch{return '';}
 }
 if(!pattern||!Array.isArray(pattern.specs)||!pattern.uses)return '';
 const text=value=>esc(String(value??'').replaceAll(/<\/?strong>/g,''));
 const rows=entries=>entries.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${text(value)}</dd></div>`).join('');
 return `<section class="component-motion-notes">
  <h3>原理</h3><p>${text(pattern.principle)}</p>
  <h3>参数</h3><dl>${rows(pattern.specs)}</dl>
  <h3>三种用法</h3><dl>${rows([
   ['短视频',pattern.uses.video],['落地页',pattern.uses.page],['UI 组件',pattern.uses.ui],
  ])}</dl>
 </section>`;
}

/** Mount the shared component directory, detail and theme controls for a host. */
export function installComponentWorkspace(h, { local, pullCordUrl = '/motion/pull-cord.html', motionAssetPrefix, directoryInstaller = installComponentDirectory } = {}){
 const readonly=!local;
 const {getState,toast,copy}=h;
 const packages=createComponentPackageCache(local?.loadComponentPackage||h.loadComponentPackage);
 const distributable=r=>readonly?allowsComponentSource(r):canDistributeSource(r)||Boolean(r.filePackage&&r.localSource?.kind==='leibox');
 const componentFiles=r=>{
  if(readonly&&!distributable(r))return [];
  return r.filePackage?(packages.read(r)?.files||[]):r.files||[];
 };
 let componentMode=false,active=null,detailSession,tab='预览',fileIndex=0,promptDraft,selectDetailTab,refreshDownload;
 const sheet=document.createElement('main');sheet.id='component-library';sheet.hidden=true;document.querySelector('#library').after(sheet);
 const dialog=document.createElement('dialog');dialog.id='component-dialog';dialog.className='component-detail-panel';dialog.setAttribute('aria-labelledby','component-dialog-title');document.body.append(dialog);
 installPreviewRecovery(dialog);
 const motionPreview=installMotionDetailPreview(dialog);
 installOfficialFramePreview(dialog);
 const playback=installDetailMediaPlayback(dialog);
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  active=null;detailSession=undefined;
  motionPreview.reset();
  const preview=dialog.querySelector('#component-detail-content');
  playback.reset();
  preview?.replaceChildren();
 });
 installWorkspaceTheme(pullCordUrl);
 h.leaveComponents=()=>{directory.pausePreviews();componentMode=false;sheet.hidden=true;};
 function showComponents(soundMode = false){
  componentMode=true;
  document.querySelector('#library').hidden=true;
  document.querySelector('#learning').hidden=true;
  sheet.hidden=false;
  document.querySelector('#breadcrumb').textContent=soundMode?'音效库':'组件库';
  directory.setSoundMode?.(soundMode);
  directory.refresh(h.readComponentFilters?.());
 }
 const mediaOptions={motionAssetPrefix,legacyPreviews:local?.legacyPreviews, workbench: Boolean(local), fallbackMedia: h.cardMedia};
 function thumbnail(record){return local?.generatedPreview(record,{card:true})||componentMedia(record,mediaOptions);}
 const directory=directoryInstaller(sheet,{
  getRecords:()=>getState().resources,
  readonly,thumbnail,toast,playRecipe:h.playRecipe,
  async loadOriginalMotion(record){
   if(!record||!hasOriginalMotionBundle(record))return;
   const entry=packages.load(record);
   await entry?.settled;
   return entry?.files.find(file=>file.name==='index.html')?.content;
  },
  hasInCart:id=>h.projects?.has(id),
  getCollection:h.componentCollection,
  onAdd:local ? addComponent : undefined,
  onOpen:id=>h.openComponentRoute?h.openComponentRoute(id):openComponent(id),
  onFiltersChanged:h.writeComponentFilters,
  onRender:()=>{if(!readonly)h.projects?.update();},
 });
 function renderComponents(){directory.refresh();}
 async function saveComponent(fields){
  const record=await local.saveRecord(fields);
  local.adopt(record);
  return record;
 }
 async function refreshReferences(id,candidateId){
  const session=detailSession;
  const record=await local.readReferences(id,candidateId);
  local.adopt(record);
  const body=dialog.querySelector('#component-detail-content');
  if(detailSession===session && active?.id===id && dialog.open && body){
   active=record;
   if(tab==='参考素材'||(tab==='预览'&&candidateId)){
    const restoreFocus=body.contains(document.activeElement)||document.activeElement===document.body;
    renderDetailPanel(body,record);
    if(tab==='参考素材'&&restoreFocus)body.querySelector(candidateId?'[data-current-reference]':'[data-refresh-references]')?.focus({preventScroll:true});
   }
  }
 }
 function workspaceForm(record,initialInput){
  motionPreview.clear();
  playback.remember();
  local.openComponentForm(dialog,{
   record,initialInput,category:directory.getCategory(),
   onSaved:async(saved,formOpen)=>{
    local.adopt(saved);
    if(!formOpen)return;
    if(!record&&h.openComponentRoute)h.openComponentRoute(saved.id);
    else await openComponent(saved.id,{fetchSource:false,tab});
   },
  });
 }
 function addComponent(){
  if(h.openCapture)h.openCapture({expected:'component'});
  else workspaceForm();
 }
 h.openComponentImporter=initialInput=>workspaceForm(undefined,initialInput);
 async function readSource(record){
  const session=detailSession;
  await local.readSource(dialog,record);
  if(detailSession===session && active===record && dialog.open && dialog.querySelector('#component-detail-content'))renderDetail();
 }
 async function refreshAfterPackage(entry,session){
  if(entry?.status!=='loading')return;
  await entry.settled;
  const body=dialog.querySelector('#component-detail-content');
  if(detailSession!==session||!active||!dialog.open||!body||packages.read(active)!==entry)return;
  refreshDownload?.();
  if(tab==='提示词'||tab==='源码'||(tab==='预览'&&body.hasAttribute('data-awaiting-source-preview')&&
   (hasOriginalMotionBundle(active)||entry.files.some(file=>file.name.endsWith('.html')))))renderDetailPanel(body,active);
 }
 async function openComponent(id,{fetchSource=true,tab:initialTab='预览'}={}){
  const resource=getState().resources.find(r=>r.id===id);
  if(!resource||(readonly&&!isComponent(resource)))return;
  motionPreview.reset();
  playback.reset();
  const session={};
  detailSession=session;
  const entry=(!readonly||distributable(resource))?packages.load(resource):undefined;
  directory.pausePreviews();
  active=resource;tab=initialTab;fileIndex=0;promptDraft=undefined;renderDetail({preserveMedia:false});if(!dialog.open)dialog.showModal();
  if(entry)await refreshAfterPackage(entry,session);
  if(detailSession===session&&dialog.open&&fetchSource&&local?.shouldReadSource(resource))readSource(resource);
 }
 function sourceDocument(r){const file=componentFiles(r).find(f=>f.name.endsWith('.html'));if(!file)return '';let html=file.content;for(const f of componentFiles(r)){if(f.name.endsWith('.css'))html=html.replace(new RegExp('<link[^>]*href=["\'][^"\']*'+f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\'][^>]*>','g'),()=>`<style>${f.content}</style>`);if(/\.m?js$/.test(f.name))html=html.replace(new RegExp('<script[^>]*src=["\'][^"\']*'+f.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\'][^>]*>\\s*</script>','g'),()=>`<script>${f.content}<\/script>`);}return html.replace('<head>',`<head><base href="${esc(r.previewUrl||r.url)}">`);}
 function handoff(r){
  const selected=r.referencePreview;
  const previewUrl=value=>value?.startsWith('/api/assets/')?new URL(value,location.origin).href:value;
  const reference=selected?{...selected,url:previewUrl(selected.url)}:undefined;
  return portableComponentPrompt(r,{
   sourceUrl:sourcePage(r),category:componentCategory(r),
   files:distributable(r)?componentFiles(r):[],reference,
  });
 }
 function renderDetail({preserveMedia=true}={}){
  const r=active,sourceUrl=componentWebUrl(sourcePage(r)),showSource=distributable(r);
  const note = readonly ? r.description : r.note || r.description;
  const hasLocalReference=Boolean(r.referencePreview||r.previewCandidates?.length);
  const tabs=componentDetailTabs({references:readonly?Boolean(sourceUrl):hasLocalReference,source:showSource});
  if(!tabs.includes(tab))tab='预览';
  const chrome=renderComponentDetailChrome({
   title:r.name,category:readonly?componentCategory(r):componentBrowseCategory(r),
   description:readonly&&typeof note==='string'?note:undefined,
   author:readonly?undefined:r.primarySourceAuthor,license:readonly?undefined:r.license,
   headingId:'component-dialog-title',
   source:sourceUrl?{href:sourceUrl,label:(readonly&&componentCategory(r)==='音效'?'打开音效来源':r.sourcePageKind==='collection'?'打开收录页':r.captureMethod==='registry'?'打开原组件':'打开组件来源')+' ↗'}:undefined,
  });
  const install=r.captureMethod==='registry'&&r.installCommand?`<div class="component-install-command"><code>${esc(r.installCommand)}</code><button type="button" data-copy-install>复制命令</button></div>`:'';
  if(preserveMedia)playback.remember();
  dialog.innerHTML=`${chrome}${install}
   <div class="component-detail-tabbar">
    <div class="detail-tabs" role="tablist" aria-label="组件详情"></div>
    <button type="button" class="component-detail-replay" data-replay-detail hidden>↻ 重播</button>
   </div><div id="component-detail-content" role="tabpanel" tabindex="0"></div>`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-copy-install]')?.addEventListener('click',event=>copy(r.installCommand,event.currentTarget));
  refreshDownload=local?.mountManage(dialog.querySelector('.component-detail-actions'),r,{
   read:()=>readSource(active),
   edit:()=>active.componentRevision?workspaceForm(active):local.openLegacyEditor(dialog,active,renderDetail),
   getFiles:()=>componentFiles(active),
   canDownload:()=>distributable(active),
  });
  const body=dialog.querySelector('#component-detail-content');
  const replay=dialog.querySelector('[data-replay-detail]');
  replay.onclick=()=>{
   const media=body.querySelector('video[src],audio[src]');
   if(media){media.currentTime=0;media.play().catch(()=>toast('重播失败，请打开组件来源。'));return;}
   const audio=body.querySelector('#play-sound');
   if(audio){audio.click();return;}
   motionPreview.reset();
   playback.reset();
   renderDetailPanel(body,active,{replay:true});
   body.querySelector('[data-start-official-preview]')?.click();
  };
  selectDetailTab=installComponentDetailTabs(dialog.querySelector('.detail-tabs'),body,{tabs,selected:tab,onSelect:h.onComponentDetailTab,render:name=>{
   tab=name;
   renderDetailPanel(body,active);
  }});
 }
 function syncReplay(body) {
  const control=dialog.querySelector('[data-replay-detail]');
  if(!control)return;
  control.hidden=tab!=='预览';
  control.disabled=!body.querySelector('iframe,video[src],audio[src],[data-start-official-preview],#play-sound');
  control.title=control.disabled?'当前没有可重播的动效预览':'从头播放预览';
 }
 async function embedSourcePreview(body,r){
  const url=componentWebUrl(sourcePage(r));
  if(!url){body.innerHTML='<div class="empty">当前没有可用预览。</div>';return;}
  const session=detailSession;
  body.innerHTML='<p class="component-workspace-status" role="status">正在检查原网站是否允许嵌入…</p>';
  let result;
  try{result=await fetch('/api/embed-check?url='+encodeURIComponent(url)).then(response=>response.json());}
  catch{result={available:null,blocked:null};}
  if(detailSession!==session||active?.id!==r.id||tab!=='预览'||!dialog.open||!body.isConnected)return;
  if(result.available&&result.blocked===false){
   body.innerHTML=`<iframe class="component-live" title="${esc(r.name)} 原网站预览" src="${esc(result.url||url)}" sandbox="allow-scripts allow-forms allow-popups allow-same-origin" referrerpolicy="no-referrer"></iframe>`;
  }else body.innerHTML='<div class="empty">原网站不允许嵌入，请使用上方的组件来源打开。</div>';
  syncReplay(body);
 }
 function renderDetailPanel(body,r,{replay=false}={}){
  motionPreview.clear();
  if(!replay)playback.remember(body);
  syncReplay(body);
  const files=componentFiles(r);
  body.removeAttribute('data-awaiting-source-preview');
  fileIndex=Math.min(fileIndex,Math.max(0,files.length-1));
  if(tab==='预览'){
   if(readonly&&r.catalogPreview&&!hasOriginalMotionBundle(r)){
    const approved=r.catalogPreview;
    if(approved.kind==='html'&&approved.poster&&approved.ratio&&approved.url.includes('/motion-prompt-preview/')){
     motionPreview.render(body,{title:r.name,...approved});
    }else if(approved.kind==='html'){
     body.innerHTML=renderOfficialFramePreview({title:r.name,url:approved.url});
    }else{
     const markup=referenceMedia(approved,r.name,{loop:true,autoplay:playback.canAutoplay(approved.url)});
     body.innerHTML=markup?renderDetailMediaStage(markup,approved):componentMedia(r,{...mediaOptions,detail:true});
    }
    const url=componentWebUrl(sourcePage(r));
    const label=r.sourcePageKind==='collection'?'打开收录页 ↗':'打开原组件 ↗';
    if(url)body.insertAdjacentHTML('beforeend',renderPreviewOrigin({href:url,label}));
    playback.restore(body);
    syncReplay(body);
    return;
   }
   const built=local?.generatedPreview(r),official=r.soundRecipe?null:officialPreviewForRecord(r),src=sourceDocument(r);
   let reference=r.referencePreview;
   let referenceMarkup=referenceMedia(reference,r.name,{loop:true,autoplay:playback.canAutoplay(reference?.url)});
   if(!referenceMarkup){
    reference=official;
    referenceMarkup=referenceMedia(reference,r.name,{loop:true,autoplay:playback.canAutoplay(reference?.url)});
   }
   const transition=!readonly&&transitionDemoForRecord(r);
   const nativePath=r.thumbnailFrame?.startsWith('/motion/')?r.thumbnailFrame:
    r.builtin||r.builtinNative?'/motion/'+(r.builtin||r.builtinNative)+'.html':'';
   const localLeiBox=!readonly&&r.localSource?.kind==='leibox'&&
    /^https:\/\/leibox\.pantoria\.cn\/assets\/motion\/[\w.-]+\.html$/.test(r.localSource.preview)&&r.localSource.preview;
   const video={kind:'video',url:r.previewVideo,poster:r.previewPoster};
   const videoMarkup=referenceMedia(video,r.name,{loop:true,autoplay:playback.canAutoplay(video.url)});
   const status=r.previewStatus?.message,motion=motionPreviewForRecord(r,{assetPrefix:motionAssetPrefix});
   if(built)body.innerHTML=(r.preview.stale?`<p class="component-workspace-status">${esc(status||'当前展示上次成功生成的预览。')}</p>`:'')+built;
   else if(transition||nativePath||localLeiBox&&!r.referencePreview&&!r.previewVideo&&official?.kind!=='video'){
    const url=transition||nativePath||localLeiBox;
    body.innerHTML=`<iframe class="component-live" title="${esc(r.name)} 交互预览" src="${esc(url)}" sandbox="${componentFramePermissions(url)}" referrerpolicy="no-referrer"></iframe>`;
   }
   else if(referenceMarkup)body.innerHTML=renderDetailMediaStage(referenceMarkup,reference);
   else if(official?.kind==='html')body.innerHTML=renderOfficialFramePreview({title:r.name,url:official.url});
   else if(motion)motionPreview.render(body,{title:r.name,...motion});
   else if(hasOriginalMotionBundle(r)){
    body.replaceChildren();
    const documentFile=files.find(file=>file.name==='index.html');
    const entry=packages.read(r);
    if(documentFile)appendSourceFrame(body,r,documentFile.content);
    else if(entry?.status==='loading'){
     body.setAttribute('data-awaiting-source-preview','');
     body.innerHTML='<p class="component-workspace-status" role="status">正在加载交互预览…</p>';
    }else{
     body.innerHTML='<p class="component-workspace-status" role="status">预览暂时无法加载。<button type="button" data-retry-motion-preview>重试</button></p>';
     body.querySelector('[data-retry-motion-preview]').onclick=()=>{
      const pending=packages.load(r);
      renderDetailPanel(body,r);
      refreshAfterPackage(pending,detailSession);
     };
    }
    body.insertAdjacentHTML('beforeend',originalMotionNotes(r,files));
   }
   else if(isMotionPromptRecord(r)){
    if(!readonly&&r.customFiles&&src)appendSourceFrame(body,r,src);
    else if(status&&r.previewStatus.status!=='ready')body.innerHTML=`<p class="component-workspace-status" role="status">${esc(status)}</p>`;
    else body.innerHTML='<div class="empty">请在组件原站查看这个条目的预览。</div>';
    if(!readonly&&r.customFiles&&!src)body.setAttribute('data-awaiting-source-preview','');
   }
   else if(r.captureMethod==='link'&&!r.thumbnailFrame&&!r.previewVideo&&!r.externalPreview&&!src){
    embedSourcePreview(body,r);
   }
   else if(status&&r.previewStatus.status!=='ready')body.innerHTML=`<p class="component-workspace-status" role="status">${esc(status)}</p>`;
   else if(r.thumbnailFrame)body.innerHTML=`<iframe class="component-live" title="${esc(r.name)}" src="${esc(r.thumbnailFrame)}" sandbox="${componentFramePermissions(r.thumbnailFrame)}"></iframe>`;
   else if(r.soundRecipe&&h.playRecipe){
    body.innerHTML=thumbnail(r)+'<button class="primary" id="play-sound">试听音效</button>';
    body.querySelector('#play-sound').onclick=()=>h.playRecipe(r.soundRecipe).catch(()=>toast('音效加载失败'));
   }
   else if(readonly&&componentCategory(r)==='音效'&&componentWebUrl(sourcePage(r)))body.innerHTML=renderSoundSourcePreview(componentWebUrl(sourcePage(r)));
   else if(videoMarkup)body.innerHTML=renderDetailMediaStage(videoMarkup,video);
   else if(r.externalPreview)body.innerHTML=`<iframe class="component-live" title="${esc(r.name)} 交互预览" src="${esc(r.externalPreview)}" sandbox="allow-scripts"></iframe>`;
   else if(src)appendSourceFrame(body,r,src);
   else{
    const media=componentMedia(r,{...mediaOptions,detail:true});
    if(media)body.innerHTML=media;
    else embedSourcePreview(body,r);
   }
   body.querySelector('[data-open-references]')?.addEventListener('click',()=>selectDetailTab('参考素材',{focus:true,notify:true}));
  }else if(tab==='参考素材'){
   const source=sourcePage(r);
   const inCandidates=local && Array.isArray(r.previewCandidates) && r.previewCandidates.some(candidate=>candidate.id===r.referencePreview?.id);
   renderPreviewReferences(body,r,source,inCandidates?null:r.referencePreview);
   local?.mountReferenceCandidates(body,r,source,{
    refresh:()=>refreshReferences(r.id),select:candidateId=>refreshReferences(r.id,candidateId),
   });
  }else if(tab==='提示词'){
   renderPrompt(body,r);
  }else{
   let sourceContent=body.querySelector(':scope > .component-source-panel > [data-source-content]');
   if(!sourceContent){
    const download=readonly&&distributable(r)?h.sourcePackageUrl?.(r):undefined;
    body.innerHTML=renderComponentSourcePanel(download);
    sourceContent=body.querySelector('[data-source-content]');
   }
   const status=packages.read(r)?.status;
   const names=status==='loading'||status==='error'?(readonly?r.sourceFileNames??[]:[]):files.map(file=>file.name);
   sourceContent.innerHTML=renderComponentSourceContent({names,selected:fileIndex,state:status});
   if(status==='loading')return;
   if(status==='error'){
    sourceContent.querySelector('[data-retry-source]').onclick=()=>{
     const entry=packages.load(r);
     renderDetailPanel(body,r);
     body.focus();
     refreshAfterPackage(entry,detailSession);
    };
    return;
   }
   if(files.length)mountComponentSourceFiles(sourceContent,files,{
    selected:fileIndex,copy,onSelect:index=>{fileIndex=index;},
   });
  }
  playback.restore(body);
  syncReplay(body);
 }
 function appendSourceFrame(body,r,src){
  const frame=document.createElement('iframe');
  frame.title=r.name+' 交互预览';frame.sandbox='allow-scripts';frame.className='component-live';
  if(/glass-folder/.test(r.url))frame.dataset.tall='true';
  frame.srcdoc=src;body.append(frame);
 }
 function renderPrompt(body,r){
  const agentPrompt=handoff(r);
  body.innerHTML=renderComponentPrompt({value:promptDraft??agentPrompt,editable:!readonly,interactive:true,label:''});
  const input=body.querySelector('textarea');
  const copyButton=body.querySelector('#copy-component-prompt');
  copyButton.textContent='复制给 Agent';
  copyButton.onclick=event=>copy(input.value,event.currentTarget);
  if(!local)return;
  input.addEventListener('input',()=>{promptDraft=input.value;});
 }
 if(local){h.saveComponent=saveComponent;h.addComponent=addComponent;}
 h.componentMedia=thumbnail;
 h.openComponent=openComponent;
 h.selectComponentDetailTab=name=>{
  const buttons=dialog.querySelectorAll('.detail-tabs [data-tab]');
  if(buttons.length)selectDetailTab([...buttons].some(button=>button.dataset.tab===name)?name:'预览');
 };
 h.showComponents=showComponents;
 h.renderComponentCards=directory.renderCollection;
 h.stopComponentCards=directory.stopCollection;
 h.getComponentFilters=directory.getFilters;
 h.restoreDirectoryFocus=directory.restoreFocus;
 h.focusDirectoryFilter=directory.focusFilter;
 h.syncComponentFilters=()=>{if(componentMode)directory.setFilters(h.readComponentFilters?.());};
 h.refreshComponents=()=>{if(componentMode)renderComponents();};
 return h;
}
