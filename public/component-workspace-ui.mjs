import { componentBrowseCategory } from './component-categories.mjs';
import { isMotionPromptRecord, motionPreviewForRecord } from './motion-prompt-preview/index.mjs';
import { officialPreviewForRecord } from './official-component-previews.mjs';
import {
  COMPONENT_CATEGORIES, allowsComponentSource, canDistributeSource, componentCategory,
  isComponentRecord as isComponent, sourcePage,
} from './component-taxonomy.mjs';
import {componentMedia,installDetailMediaPlayback,installPreviewRecovery} from './component-media.mjs';
import {installComponentDirectory} from './component-directory.mjs';
import {installComponentDetailTabs} from './component-detail-tabs.mjs';
import {componentDetailTabs} from './component-directory-url.mjs';
import {renderComponentDetailChrome,renderComponentPrompt} from './component-detail-chrome.mjs';
import {installMotionDetailPreview,installOfficialFramePreview,renderDetailMediaStage,renderOfficialFramePreview} from './component-detail-preview.mjs';
import {createComponentPackageCache} from './component-package-cache.mjs';
import {mountComponentSourceFiles,renderComponentSourceContent,renderComponentSourcePanel} from './component-source-panel.mjs';
import {installWorkspaceTheme} from './workspace-theme.mjs';
import {componentWebUrl,referenceMedia,renderPreviewReferences} from './component-workspace.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Mount the shared component directory, detail and theme controls for a host. */
export function installComponentWorkspace(h, { local, pullCordUrl = '/motion/pull-cord.html', motionAssetPrefix, directoryInstaller = installComponentDirectory } = {}){
 const readonly=!local;
 const {getState,toast,copy}=h;
 const packages=createComponentPackageCache(local?.loadComponentPackage||h.loadComponentPackage);
 const distributable=r=>readonly?allowsComponentSource(r):canDistributeSource(r);
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
 function thumbnail(record){return componentMedia(record,mediaOptions);}
 const directory=directoryInstaller(sheet,{
  getRecords:()=>getState().resources,
  readonly,thumbnail,toast,playRecipe:h.playRecipe,
  hasInCart:id=>h.projects?.has(id),
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
 function workspaceForm(record){
  motionPreview.clear();
  playback.remember();
  local.openComponentForm(dialog,{
   record,categories:COMPONENT_CATEGORIES,category:record?componentCategory(record):directory.getCategory(),
   onSaved:async(saved,formOpen)=>{
    local.adopt(saved);
    if(!formOpen)return;
    if(!record&&h.openComponentRoute)h.openComponentRoute(saved.id);
    else await openComponent(saved.id,{fetchSource:false,tab});
   },
  });
 }
 function addComponent(){workspaceForm();}
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
  dialog.querySelector('#copy-agent').disabled=false;
  if(tab==='源码'||(tab==='预览'&&body.hasAttribute('data-awaiting-source-preview')&&entry.files.some(file=>file.name.endsWith('.html'))))renderDetailPanel(body,active);
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
  const reference=selected?`\n\n参考${selected.kind==='video'?'视频':'图片'}：${previewUrl(selected.url)}\n素材出处：${selected.sourcePageUrl}${selected.poster?'\n视频封面：'+previewUrl(selected.poster):''}${selected.width&&selected.height?'\n素材尺寸：'+selected.width+' × '+selected.height:''}`:'';
  let source=r.captureMethod==='link'&&!r.filePackage&&!r.files?.length
   ?'\n\n请按已选参考素材和原页交互实现。若来源提供源码，先核对许可。'
   :'\n\n源码获取：\n请从第一来源页面直接获取，不要由 Ilia Cache 或其 MCP 转发完整源码。';
  if(distributable(r)){
   const files=componentFiles(r);
   source=files.length?`\n\n源码文件：\n${files.map(f=>`--- ${f.name} ---\n${f.content}`).join('\n\n')}`:
    `\n\n${packages.read(r)?.status==='error'?'源码包加载失败，请在 Ilia 的源码标签重试。':'当前没有已收录的源码文件。'}`;
  }
  const author=r.primarySourceAuthor?`\n作者：${r.primarySourceAuthor}`:'';
  return `请在当前项目中使用收藏的组件 ${r.name}。\n来源：${sourcePage(r)}${author}\n许可：${r.license||"待确认"}\n分类：${componentCategory(r)}\n查找 ID：${r.id}\n先读取已有项目，再按项目技术栈适配；保留动效参数，使用项目字体、颜色和圆角。\n\n提示词原文：\n${r.prompt||"原站尚未提供提示词。"}${reference}${source}`;
 }
 function renderDetail({preserveMedia=true}={}){
  const r=active,sourceUrl=componentWebUrl(sourcePage(r)),showSource=distributable(r);
  const note = readonly ? r.description : r.note || r.description;
  const hasLocalReference=Boolean(r.referencePreview||r.previewCandidates?.length||r.componentRevision);
  const tabs=componentDetailTabs({references:readonly?Boolean(sourceUrl):hasLocalReference,source:showSource});
  if(!tabs.includes(tab))tab='预览';
  const chrome=renderComponentDetailChrome({
   title:r.name,category:readonly?componentCategory(r):componentBrowseCategory(r),
   description:readonly&&typeof note==='string'?note:undefined,
   author:readonly?undefined:r.primarySourceAuthor,license:readonly?undefined:r.license,
   headingId:'component-dialog-title',
   source:sourceUrl?{href:sourceUrl,label:(r.sourcePageKind==='collection'?'打开收录页':'打开组件来源')+' ↗'}:undefined,
  });
  if(preserveMedia)playback.remember();
  dialog.innerHTML=`${chrome}
   <div class="detail-tabs" role="tablist" aria-label="组件详情"></div><div id="component-detail-content" role="tabpanel" tabindex="0"></div>`;
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  const copyAgent=dialog.querySelector('#copy-agent');
  copyAgent.disabled=showSource&&packages.read(r)?.status==='loading';
  copyAgent.onclick=event=>copy(handoff(active),event.currentTarget);
  refreshDownload=local?.mountManage(dialog.querySelector('.component-detail-actions'),r,{
   read:()=>readSource(active),
   edit:()=>active.componentRevision?workspaceForm(active):local.openLegacyEditor(dialog,active,renderDetail),
   getFiles:()=>componentFiles(active),
   canDownload:()=>distributable(active),
  });
  const body=dialog.querySelector('#component-detail-content');
  selectDetailTab=installComponentDetailTabs(dialog.querySelector('.detail-tabs'),body,{tabs,selected:tab,onSelect:h.onComponentDetailTab,render:name=>{
   tab=name;
   renderDetailPanel(body,active);
  }});
 }
 function renderDetailPanel(body,r){
  motionPreview.clear();
  playback.remember(body);
  const files=componentFiles(r);
  body.removeAttribute('data-awaiting-source-preview');
  fileIndex=Math.min(fileIndex,Math.max(0,files.length-1));
  if(tab==='预览'){
   const built=local?.generatedPreview(r),official=officialPreviewForRecord(r),src=sourceDocument(r);
   let reference=r.referencePreview;
   let referenceMarkup=referenceMedia(reference,r.name);
   if(!referenceMarkup){reference=official;referenceMarkup=referenceMedia(reference,r.name);}
   const video={kind:'video',url:r.previewVideo,poster:r.previewPoster};
   const videoMarkup=referenceMedia(video,r.name,{loop:true,autoplay:playback.canAutoplay(video.url)});
   const status=r.previewStatus?.message,motion=motionPreviewForRecord(r,{assetPrefix:motionAssetPrefix});
   if(built)body.innerHTML=(r.preview.stale?`<p class="component-workspace-status">${esc(status||'当前展示上次成功生成的预览。')}</p>`:'')+built;
   else if(referenceMarkup)body.innerHTML=renderDetailMediaStage(referenceMarkup,reference);
   else if(official?.kind==='html')body.innerHTML=renderOfficialFramePreview({title:r.name,url:official.url});
   else if(motion)motionPreview.render(body,{title:r.name,...motion});
   else if(isMotionPromptRecord(r)){
    if(!readonly&&r.customFiles&&src)appendSourceFrame(body,r,src);
    else if(status&&r.previewStatus.status!=='ready')body.innerHTML=`<p class="component-workspace-status" role="status">${esc(status)}</p>`;
    else body.innerHTML='<div class="empty">请在组件原站查看这个条目的预览。</div>';
    if(!readonly&&r.customFiles&&!src)body.setAttribute('data-awaiting-source-preview','');
   }
   else if(r.captureMethod==='link'&&!r.thumbnailFrame&&!r.previewVideo&&!r.externalPreview&&!src){
    body.innerHTML='<div class="empty">待补预览。<button type="button" data-open-references>查看参考素材</button></div>';
    body.setAttribute('data-awaiting-source-preview','');
   }
   else if(status&&r.previewStatus.status!=='ready')body.innerHTML=`<p class="component-workspace-status" role="status">${esc(status)}</p>`;
   else if(r.thumbnailFrame)body.innerHTML=`<iframe class="component-live" title="${esc(r.name)}" src="${esc(r.thumbnailFrame)}" sandbox="allow-scripts${r.thumbnailFrame.startsWith('/native-preview.html')?' allow-same-origin':''}"></iframe>`;
   else if(r.soundRecipe&&h.playRecipe){
    body.innerHTML=thumbnail(r)+'<button class="primary" id="play-sound">试听音效</button>';
    body.querySelector('#play-sound').onclick=()=>h.playRecipe(r.soundRecipe).catch(()=>toast('音效加载失败'));
   }
   else if(videoMarkup)body.innerHTML=renderDetailMediaStage(videoMarkup,video);
   else if(r.externalPreview)body.innerHTML=`<iframe class="component-live" title="${esc(r.name)} 交互预览" src="${esc(r.externalPreview)}" sandbox="allow-scripts"></iframe>`;
   else if(src)appendSourceFrame(body,r,src);
   else{
    body.innerHTML=componentMedia(r,{...mediaOptions,detail:true});
    body.setAttribute('data-awaiting-source-preview','');
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
     dialog.querySelector('#copy-agent').disabled=true;
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
 }
 function appendSourceFrame(body,r,src){
  const frame=document.createElement('iframe');
  frame.title=r.name+' 交互预览';frame.sandbox='allow-scripts';frame.className='component-live';
  if(/glass-folder/.test(r.url))frame.dataset.tall='true';
  frame.srcdoc=src;body.append(frame);
 }
 function renderPrompt(body,r){
  body.innerHTML=renderComponentPrompt({value:promptDraft??r.prompt,editable:!readonly,interactive:true});
  const input=body.querySelector('textarea');
  const copyButton=body.querySelector('#copy-component-prompt');
  copyButton.onclick=event=>copy(input.value,event.currentTarget);
  if(!local)return;
  input.addEventListener('input',()=>{promptDraft=input.value;});
  local.mountPromptActions(dialog,copyButton,input,r);
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
