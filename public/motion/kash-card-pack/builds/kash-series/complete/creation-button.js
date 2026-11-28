// Adapted from Motion Prompt #084 (c) 2026 Shohei Ohtaki, MIT.
// Component reference: https://showheyohtaki.github.io/motion-prompt/#084
export function bindMagneticButton(anchor) {
  const surface = anchor.firstElementChild;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const approach = 110;
  const pull = .35;
  const elastic = t => t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t - .075) * 2 * Math.PI / .3) + 1;
  let near = false;
  let frame = 0;
  let x = 0, y = 0, dx = 0, dy = 0, homeX = 0, homeY = 0, leftAt = 0, previous = 0;

  function tick(now) {
    const delta = previous ? Math.min(now - previous, 40) : 1000 / 60;
    previous = now;
    if (near) {
      const gain = 1 - .82 ** (delta / (1000 / 60));
      x += (dx - x) * gain;
      y += (dy - y) * gain;
    } else {
      const remaining = 1 - elastic((now - leftAt) / 1100);
      x = homeX * remaining;
      y = homeY * remaining;
    }
    surface.style.translate = `${x}px ${y}px`;
    if (near ? Math.hypot(dx - x, dy - y) > .05 : now - leftAt < 1100) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = previous = 0;
    }
  }

  function retreat() {
    if (!near) return;
    near = false;
    leftAt = performance.now();
    homeX = x;
    homeY = y;
    if (!frame) frame = requestAnimationFrame(tick);
  }
  window.addEventListener('pointermove', event => {
    if (!anchor.getClientRects().length || event.pointerType !== 'mouse' || motion.matches) return retreat();
    const b = anchor.getBoundingClientRect();
    const horizontal = event.clientX - b.left - b.width / 2;
    const vertical = event.clientY - b.top - b.height / 2;
    if (Math.hypot(horizontal, vertical) >= approach) return retreat();
    near = true;
    dx = horizontal * pull;
    dy = vertical * pull;
    if (!frame) frame = requestAnimationFrame(tick);
  });
  document.documentElement.addEventListener('pointerleave', retreat);
  window.addEventListener('blur', retreat);
}
