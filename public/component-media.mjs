import { referenceMedia } from './component-workspace.mjs';
import { renderDetailMediaStage } from './component-detail-preview.mjs';
import { cardImage, cardPlaceholder, soundThumbnail } from './component-card.mjs';
import { isMotionPromptRecord, motionPreviewForRecord } from './motion-prompt-preview/index.mjs';
import { officialPreviewForRecord } from './official-component-previews.mjs';
import { componentReferencePoster } from './component-reference-posters.mjs';
import { hasOriginalMotionBundle } from './component-taxonomy.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function iframeThumbnail(name, url, permissions = 'allow-scripts') {
  return `<iframe tabindex="-1" title="${escape(name)}" sandbox="${permissions}" src="${escape(url)}" loading="lazy"></iframe>`;
}

function staticPreview(markup) {
  return `<div class="component-static-preview">${markup}</div>`;
}

function renderLegacyComponentMedia(previews, title, detail) {
  const markup = previews?.map(preview => referenceMedia(preview, title, { card: !detail, savedImage: true })).join('');
  if (!markup || !detail) return markup || '';
  return previews[0].kind === 'video' ? renderDetailMediaStage(markup, previews[0])
    : staticPreview(markup);
}

function knownComponentThumbnail(record, motionAssetPrefix) {
  const { name, referencePreview, preview, soundRecipe, previewVideo, previewPoster,
    thumbnailFrame, localPoster, builtin, builtinNative } = record;
  const reference = referenceMedia(referencePreview, name, { card: true });
  if (reference) return reference;
  if (preview?.kind === 'html' || hasOriginalMotionBundle(record)) return cardPlaceholder('interaction');
  const official = officialPreviewForRecord(record);
  if (official?.kind === 'image') return referenceMedia(official, name, { card: true });
  if (official?.kind === 'html') return cardPlaceholder('interaction');
  const motion = motionPreviewForRecord(record, { assetPrefix: motionAssetPrefix });
  if (motion) return cardImage(motion.poster, name, motion.ratio);
  if (isMotionPromptRecord(record)) return cardPlaceholder();
  if (soundRecipe) return soundThumbnail('点击试听');
  const video = previewVideo && referenceMedia({ kind: 'video', url: previewVideo, poster: previewPoster }, name, { card: true });
  if (video) return video;
  if (thumbnailFrame) {
    const permissions = thumbnailFrame.startsWith('/native-preview.html')
      ? 'allow-scripts allow-same-origin' : 'allow-scripts';
    return iframeThumbnail(name, thumbnailFrame, permissions);
  }
  if (localPoster) return cardImage(localPoster, name);
  if (builtin || builtinNative) return iframeThumbnail(name, '/motion/' + (builtin || builtinNative) + '.html');
  if (record.componentCategory === '音效') return cardPlaceholder('sound');
  return '';
}

export function componentMedia(record, { motionAssetPrefix, legacyPreviews, detail = false } = {}) {
  const known = knownComponentThumbnail(record, motionAssetPrefix);
  if (!known) {
    const legacy = renderLegacyComponentMedia(legacyPreviews?.(record), record.name, detail);
    if (legacy) return legacy;
  }
  const poster = !known && componentReferencePoster(record.id);
  const thumbnail = known || (poster && cardImage(poster.url, `${record.name} · ${poster.label}`)) || cardPlaceholder();
  return detail ? staticPreview(thumbnail) : thumbnail;
}

function recoverPreview(media) {
  const poster = media instanceof HTMLVideoElement && media.getAttribute('poster');
  if (poster) {
    const image = document.createElement('img');
    image.dataset.previewMedia = '';
    image.alt = media.getAttribute('aria-label') || '';
    image.referrerPolicy = 'no-referrer';
    if (!media.closest('.component-thumb')) image.className = 'component-preview-poster';
    media.replaceWith(image);
    image.src = poster;
    return;
  }
  const fallback = document.createElement('span');
  fallback.className = 'component-source-preview component-preview-error';
  fallback.textContent = '预览暂时无法加载';
  media.replaceWith(fallback);
}

export function installPreviewRecovery(root) {
  const selector = 'img[data-preview-media], video[data-preview-media]';
  root.addEventListener('error', event => {
    if (event.target.matches?.(selector)) recoverPreview(event.target);
  }, true);
  // Server-rendered media can fail before the browser module has loaded.
  for (const media of root.querySelectorAll(selector)) {
    const failed = media instanceof HTMLImageElement ? media.complete && media.naturalWidth === 0 && media.src : media.error;
    if (failed) recoverPreview(media);
  }
}

function pauseMedia(media) {
  media.autoplay = false;
  media.pause();
}

export function pauseDetailMedia(root) {
  root?.querySelectorAll('video,audio').forEach(pauseMedia);
}

export function hasAdjustedVideoAudio(video) {
  return video.volume !== 1 || video.muted !== video.defaultMuted;
}

/** Pause detail media on backgrounding and require a fresh play action on return. */
export function installDetailMediaPlayback(root) {
  const events = new AbortController();
  const { signal } = events;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const videos = 'video[data-preview-media][src]';
  const remembered = new Map();
  const interacted = new WeakSet();
  const restoring = new WeakMap();
  const resumed = new WeakSet();
  let panel = new AbortController();

  function mayPlay() {
    return !document.hidden && !reduceMotion.matches;
  }

  function stopRestore() {
    panel.abort();
    panel = new AbortController();
  }

  function suppressResume() {
    for (const entry of remembered.values()) entry.playing = false;
  }

  function pause() {
    suppressResume();
    pauseDetailMedia(root);
  }

  function track(event) {
    if (event.target.matches?.(videos)) interacted.add(event.target);
  }

  root.addEventListener('play', event => {
    track(event);
    if (event.target instanceof HTMLMediaElement &&
      (document.hidden || !root.isConnected || (root instanceof HTMLDialogElement && !root.open))) {
      pauseMedia(event.target);
    }
  }, { capture: true, signal });
  for (const type of ['seeking', 'volumechange']) root.addEventListener(type, track, { capture: true, signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, { signal });
  window.addEventListener('pagehide', pause, { signal });
  reduceMotion.addEventListener('change', event => {
    if (!event.matches) return;
    suppressResume();
    for (const video of root.querySelectorAll(videos)) {
      if (video.hasAttribute('data-autoplay-preview') || resumed.has(video)) pauseMedia(video);
    }
  }, { signal });
  if (document.hidden) pause();

  function reset() {
    stopRestore();
    remembered.clear();
    pauseDetailMedia(root);
  }

  return {
    canAutoplay(url) {
      const key = url && URL.canParse(url, document.baseURI) ? new URL(url, document.baseURI).href : undefined;
      return mayPlay() && !remembered.has(key);
    },
    remember(scope = root) {
      const visible = new Map();
      for (const video of scope.querySelectorAll(videos)) {
        const pending = restoring.get(video);
        if (video.error || (!pending && !video.currentTime && !interacted.has(video) && !hasAdjustedVideoAudio(video))) continue;
        const state = pending || {
          time: video.currentTime, playing: !video.paused && !video.ended && !document.hidden,
          muted: video.muted, volume: video.volume,
        };
        if (!visible.has(video.src) || state.playing) visible.set(video.src, state);
      }
      for (const [url, state] of visible) remembered.set(url, state);
      stopRestore();
      pauseDetailMedia(scope);
    },
    restore(scope) {
      // One panel may list multiple local reference videos. Resume at most one.
      let canResume = true;
      for (const video of scope.querySelectorAll(videos)) {
        const state = remembered.get(video.src);
        if (!state) continue;
        const resume = canResume && state.playing;
        if (resume) canResume = false;
        video.autoplay = false;
        video.muted = state.muted;
        video.volume = state.volume;
        restoring.set(video, state);
        const apply = () => {
          if (!root.contains(video)) return;
          video.currentTime = Number.isFinite(video.duration) ? Math.min(state.time, video.duration) : state.time;
          restoring.delete(video);
          if (resume && state.playing && mayPlay()) {
            resumed.add(video);
            video.play().catch(() => {});
          }
        };
        if (video.readyState > 0) apply();
        else video.addEventListener('loadedmetadata', apply, { once: true, signal: panel.signal });
      }
    },
    reset,
    dispose() {
      events.abort();
      reset();
    },
  };
}

/** Manage video hover and iframe scaling for the lifetime of a directory grid. */
export function installCardPreviews(root) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const positions = new WeakMap();
  let active;
  const intersection = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.target === active?.card && !entry.isIntersecting)) pause();
  });
  function pause() {
    if (!active) return;
    const { video, stage, card } = active;
    active = undefined;
    intersection.unobserve(card);
    if (video.currentTime > 0) positions.set(stage, video.currentTime);
    stage.removeAttribute('data-preview-playing');
    video.pause();
    video.remove();
    video.removeAttribute('src');
    video.load();
  }
  root.addEventListener('pointerenter', event => {
    const card = event.target;
    if (!card.matches('.component-thumb') || event.pointerType === 'touch' || document.hidden || reduceMotion.matches) return;
    const stage = card.querySelector('[data-card-video]');
    if (!stage || active?.stage === stage) return;
    pause();
    const video = document.createElement('video');
    video.className = 'component-video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'none';
    video.setAttribute('aria-hidden', 'true');
    active = { video, stage, card };
    intersection.observe(card);
    video.addEventListener('playing', () => {
      if (active?.video === video) stage.setAttribute('data-preview-playing', '');
    }, { once: true });
    const recover = () => { if (active?.video === video) pause(); };
    video.addEventListener('error', recover, { once: true });
    stage.append(video);
    video.src = stage.dataset.cardVideo;
    video.currentTime = positions.get(stage) || 0;
    video.play().catch(recover);
  }, true);
  root.addEventListener('pointerleave', event => {
    if (event.target === active?.card) pause();
  }, true);
  reduceMotion.addEventListener('change', event => { if (event.matches) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('pagehide', pause);

  const resize = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const frame = target.querySelector('iframe');
      if (!frame?.offsetWidth || !frame.offsetHeight) continue;
      const scale = Math.min(target.clientWidth / frame.offsetWidth, target.clientHeight / frame.offsetHeight);
      frame.style.transform = `translate(-50%,-50%) scale(${scale})`;
    }
  });
  function refresh() {
    if (active && !root.contains(active.card)) pause();
    resize.disconnect();
    for (const box of root.querySelectorAll('.component-thumb:has(iframe)')) resize.observe(box);
  }
  installPreviewRecovery(root);
  return { refresh, pause };
}
