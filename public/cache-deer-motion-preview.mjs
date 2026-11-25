const deer = document.querySelector('.deer');
const poses = deer.querySelectorAll('.pose');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let progress = 0;
let target = 0;
let frame = 0;
let previousTime = 0;
let releaseTimer;
let hovered = false;
let activated = false;

function fade(start, end) {
  const amount = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return amount * amount * (3 - 2 * amount);
}

function render() {
  const look = fade(0.04, 0.25);
  const tuck = fade(0.56, 0.95);
  poses[0].style.opacity = 1 - look;
  poses[1].style.opacity = look * (1 - tuck);
  poses[2].style.opacity = tuck;
  deer.dataset.pose = tuck >= 0.99 ? 'caught' : look >= 0.5 ? 'look' : 'reach';
}

function tick(time) {
  const elapsed = Math.min(time - previousTime, 40);
  previousTime = time;
  progress = target > progress
    ? Math.min(target, progress + elapsed / 610)
    : Math.max(target, progress - elapsed / 850);
  render();
  frame = progress === target ? 0 : requestAnimationFrame(tick);
}

function updateTarget() {
  target = Number(hovered || activated);
  if (reducedMotion.matches) {
    cancelAnimationFrame(frame);
    frame = 0;
    progress = target;
    render();
  } else if (!frame && progress !== target) {
    previousTime = performance.now();
    frame = requestAnimationFrame(tick);
  }
}

deer.addEventListener('pointerenter', event => {
  if (event.pointerType !== 'mouse') return;
  hovered = true;
  updateTarget();
});

deer.addEventListener('pointerleave', () => {
  hovered = false;
  updateTarget();
});

deer.addEventListener('click', event => {
  if (event.pointerType === 'mouse') return;
  clearTimeout(releaseTimer);
  activated = true;
  updateTarget();
  releaseTimer = setTimeout(() => {
    activated = false;
    updateTarget();
  }, 1600);
});

reducedMotion.addEventListener('change', updateTarget);
