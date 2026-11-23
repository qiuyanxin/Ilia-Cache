/* Render a single cell from the original Motion Prompt pack. */
(() => {
  const canvas = document.getElementById('preview');
  const control = document.getElementById('play');
  const origin = document.getElementById('origin');
  const status = document.getElementById('status');
  const query = new URLSearchParams(location.search);
  const id = query.get('id') || '';
  const pack = query.get('pack') || '';
  const packs = ['motion', 'camera', 'ui', 'lp', 'photo', 'motion2', 'lp2', 'camera2', null, 'diagram'];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'motion:theme') return;
    const theme = event.data.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  });

  function report(state, at) {
    if (parent !== window) parent.postMessage({ type: 'ilia:motion-preview', state, at }, '*');
  }

  if (parent !== window) addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    report('dismiss');
  });

  function unavailable() {
    canvas.hidden = true;
    control.disabled = true;
    status.hidden = false;
    report('unavailable');
  }
  if (!/^\d{3}$/.test(id) || packs[Math.floor((Number(id) - 1) / 24)] !== pack) {
    unavailable();
    return;
  }
  origin.href += '#' + id;
  canvas.setAttribute('aria-label', 'Motion Prompt #' + id + ' 动效');
  const script = document.createElement('script');
  script.src = 'packs/' + pack + '/pack.js';
  script.onerror = unavailable;
  script.onload = () => {
    const scene = window.MotionPrompt?.packs[pack];
    const cell = scene?.cells[(Number(id) - 1) % 24];
    const ctx = canvas.getContext('2d');
    if (!cell || !ctx) {
      unavailable();
      return;
    }
    const { width, height, cycle } = scene;
    canvas.width = width;
    canvas.height = height;

    const start = query.has('pausedAt') ? Number(query.get('pausedAt')) : NaN;
    const initiallyPaused = Number.isFinite(start) && start >= 0;
    let elapsed = initiallyPaused ? start % cycle : cycle * 0.4;
    let playing = false;
    let last = 0;
    let pending;
    function draw(time) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      try {
        cell(ctx, width, height, time);
        return true;
      } catch {
        unavailable();
        return false;
      } finally {
        ctx.restore();
      }
    }
    function frame(now) {
      if (last) elapsed = (elapsed + Math.min((now - last) / 1000, 0.1)) % cycle;
      last = now;
      if (draw(elapsed)) pending = requestAnimationFrame(frame);
    }
    function setPlaying(play) {
      playing = play;
      last = 0;
      cancelAnimationFrame(pending);
      control.textContent = play ? '暂停' : '播放';
      if (play && !document.hidden) pending = requestAnimationFrame(frame);
    }
    if (!draw(elapsed)) return;
    canvas.hidden = false;
    control.disabled = false;
    control.onclick = () => {
      setPlaying(!playing);
      report(playing ? 'playing' : 'paused', elapsed);
    };
    document.addEventListener('visibilitychange', () => setPlaying(playing));
    reduce.addEventListener('change', event => { if (event.matches) setPlaying(false); });
    setPlaying(!initiallyPaused && !reduce.matches);
    report('ready');
  };
  document.head.append(script);
})();
