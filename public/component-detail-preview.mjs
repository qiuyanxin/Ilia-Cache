import { soundThumbnail } from './component-card.mjs';
import { referenceAspectRatio } from './reference-media-model.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function renderMotionDetailPreview({ title, ratio, poster, url, pausedAt }) {
  const src = url && Number.isFinite(pausedAt) ? `${url}&pausedAt=${pausedAt}` : url;
  const frame = src ? `<iframe data-motion-player class="component-live" title="${escape(title)} 交互预览" src="${escape(src)}" sandbox="allow-scripts"></iframe>` : '';
  return `<div class="component-motion-preview" style="--canvas-ratio:${ratio}"${frame ? ' data-motion-state="loading"' : ''}>
    ${frame}<div class="component-static-motion"><img data-preview-media src="${escape(poster)}" alt="${escape(title)}" referrerpolicy="no-referrer">
    ${frame ? '<p class="component-motion-status" role="status" hidden>动效暂时无法加载，可打开组件来源。</p>' : ''}</div></div>`;
}

export function renderSoundSourcePreview(url) {
  return `<div class="component-static-preview"><a data-sound-source href="${escape(url)}" target="_blank" rel="noopener noreferrer">${soundThumbnail('在来源试听 ↗')}</a></div>`;
}

export function renderOfficialFramePreview({ title, url }) {
  const link = `href="${escape(url)}" target="_blank" rel="noopener noreferrer"`;
  return `<div class="component-live component-official-frame" data-preview-title="${escape(title)}">
    <div class="component-official-frame-canvas" tabindex="-1">
      <a ${link} data-start-official-preview>打开交互预览</a>
    </div>
    <div class="component-official-frame-actions"><a ${link} data-open-official-preview>在新标签页打开预览 ↗</a></div>
  </div>`;
}

export function installOfficialFramePreview(dialog) {
  dialog.addEventListener('click', event => {
    const launch = event.target.closest('[data-start-official-preview]');
    if (!launch || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const stage = launch.closest('.component-official-frame');
    const canvas = stage.querySelector('.component-official-frame-canvas');
    const preserveFocus = document.activeElement === launch;
    event.preventDefault();
    const frame = document.createElement('iframe');
    frame.title = stage.dataset.previewTitle + ' 交互预览';
    frame.sandbox = 'allow-scripts';
    frame.referrerPolicy = 'no-referrer';
    frame.src = launch.href;
    canvas.replaceChildren(frame);
    if (preserveFocus) canvas.focus({ preventScroll: true });
  });
}

/** Keep the area reserved for known image dimensions or for a video player. */
export function renderDetailMediaStage(markup, reference) {
  const video = reference.kind === 'video';
  const aspect = referenceAspectRatio(reference) ?? (video ? 16 / 9 : undefined);
  if (!aspect) return `<div class="component-reference-media">${markup}</div>`;
  return `<div class="component-reference-media component-detail-media${video ? ' component-detail-media-video' : ''}" style="--detail-media-ratio:${aspect}">${markup}</div>`;
}

export function installMotionDetailPreview(dialog) {
  let player;
  let timer;
  let pausedAt;

  function clear() {
    clearTimeout(timer);
    player = undefined;
  }

  function showStatus(state) {
    const stage = player.parentElement;
    stage.dataset.motionState = state;
    stage.querySelector('.component-motion-status').hidden = state !== 'unavailable';
  }

  window.addEventListener('message', event => {
    if (event.origin !== 'null' || event.data?.type !== 'ilia:motion-preview' || !dialog.open) return;
    if (!player?.isConnected || event.source !== player.contentWindow) return;
    const { state, at } = event.data;
    if (state === 'ready' || state === 'unavailable') {
      clearTimeout(timer);
      showStatus(state);
    } else if (state === 'paused' && Number.isFinite(at) && at >= 0) {
      pausedAt = at;
    } else if (state === 'playing') {
      pausedAt = undefined;
    } else if (state === 'dismiss' && document.activeElement === player) {
      dialog.close();
    }
  });

  return {
    clear,
    reset() {
      clear();
      pausedAt = undefined;
    },
    render(root, preview) {
      clear();
      root.innerHTML = renderMotionDetailPreview({ ...preview, pausedAt });
      player = root.querySelector('[data-motion-player]');
      // A failed document or entry script cannot report its own error.
      timer = setTimeout(() => {
        if (dialog.open && player?.isConnected) showStatus('unavailable');
      }, 5000);
    },
  };
}
