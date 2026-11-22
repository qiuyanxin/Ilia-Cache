const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function motionPromptThumbnail(resource){
  const match=/^motion-prompt-(\d{3})$/.exec(resource.id);
  return match ? `/motion-prompt/thumbnail.html#${match[1]}` : '';
}
export function componentPreviewSandbox(frame) {
  const officialThemeDemos = [
    'https://gui-challenges.web.app/theme-switch/dist/',
    'https://mahozad.ir/theme-switch/',
  ];
  return frame.startsWith('/native-preview.html') || officialThemeDemos.includes(frame)
    ? 'allow-scripts allow-same-origin'
    : 'allow-scripts';
}
export function componentLoadRank(r){if(motionPromptThumbnail(r))return 1;if(r.soundRecipe||r.localPoster)return 0;if(r.builtin||r.builtinNative||String(r.thumbnailFrame||'').startsWith('/'))return 1;if(r.previewPoster)return 2;if(r.previewVideo||r.thumbnailFrame)return 3;return 4;}
export function componentMedia(r,fallback){const motionThumbnail=motionPromptThumbnail(r);if(motionThumbnail)return `<iframe class="motion-prompt-thumb" tabindex="-1" title="${esc(r.name)}" sandbox="allow-scripts" data-src="${motionThumbnail}" loading="lazy"></iframe>`;if(r.soundRecipe)return `<span class="sound-preview"><svg viewBox="0 0 80 50" aria-hidden="true">${[12,24,38,48,31,20,35,44,26,12].map((h,i)=>`<rect x="${i*7+4}" y="${25-h/2}" width="3" height="${h}" rx="1.5"/>`).join('')}</svg><span>点击试听</span></span>`;if(r.previewVideo)return `<video class="component-video" muted loop playsinline preload="none" ${r.previewPoster?`poster="${esc(r.previewPoster)}"`:''} data-src="${esc(r.previewVideo)}" aria-label="${esc(r.name)} 动态预览"></video>`;if(r.thumbnailFrame)return `<iframe tabindex="-1" title="${esc(r.name)}" sandbox="${componentPreviewSandbox(r.thumbnailFrame)}" data-src="${esc(r.thumbnailFrame)}" loading="lazy"></iframe>`;if(r.localPoster)return `<img src="${esc(r.localPoster)}" alt="${esc(r.name)}" loading="lazy" decoding="async">`;if(r.builtin||r.builtinNative)return `<iframe tabindex="-1" title="${esc(r.name)}" sandbox="allow-scripts" data-src="/motion/${r.builtin||r.builtinNative}.html" loading="lazy"></iframe>`;return fallback(r).replace(/<a\b[^>]*>|<\/a>/g,'');}
export async function playRecipe(recipe){if(!/^[a-z]+$/.test(recipe))return;const [{playSound},{default:config}]=await Promise.all([import('./sound-engine.mjs'),import('./sounds/'+recipe+'.mjs')]);return playSound(config,{volume:-5});}
let motionPreviewListenerBound = false;
function bindMotionPreviewSizes(root) {
  if (motionPreviewListenerBound || !root.querySelector('.motion-prompt-thumb')) return;
  motionPreviewListenerBound = true;
  window.addEventListener('message', event => {
    if (event.origin !== 'null' || event.data?.type !== 'cache:motion-preview-size') return;
    const { width, height } = event.data;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096) return;
    const frame = [...document.querySelectorAll('.motion-prompt-thumb')]
      .find(candidate => candidate.contentWindow === event.source);
    if (frame) frame.style.aspectRatio = `${width} / ${height}`;
  });
}

export function bindPreviews(root){bindMotionPreviewSizes(root);const activate=element=>{if(element.dataset.src&&!element.src)element.src=element.dataset.src;};const deferred=[...root.querySelectorAll('[data-src]:not([data-lazy-bound])')];if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){activate(entry.target);observer.unobserve(entry.target);}},{rootMargin:'800px 0px'});deferred.forEach(element=>{element.dataset.lazyBound='true';observer.observe(element);});}else deferred.forEach(activate);root.querySelectorAll('.component-video:not([data-preview-bound])').forEach(video=>{video.dataset.previewBound='true';const parent=video.closest('button')||video;parent.onpointerenter=()=>{activate(video);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)video.play().catch(()=>{});};parent.onpointerleave=()=>video.pause();});root.querySelectorAll('.component-thumb:has(iframe:not(.motion-prompt-thumb)):not([data-preview-bound])').forEach(box=>{box.dataset.previewBound='true';const frame=box.querySelector('iframe');const resize=new ResizeObserver(()=>frame.style.transform=`translate(-50%,-50%) scale(${box.clientWidth/500})`);resize.observe(box);});}
