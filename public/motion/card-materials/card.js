const hitArea = document.querySelector('.card-hit');
const card = document.querySelector('.card');
const finishName = document.querySelector('.finish-name');
const finishes = [...document.querySelectorAll('.finishes button')];
const clamp = value => Math.min(1, Math.max(0, value));
let position = { x: .5, y: .5 };
let touchReset;

if (document.documentElement.dataset.mode === 'tilt') {
  card.dataset.finish = 'gloss';
  finishName.textContent = '随动高光';
}

function aimLight(x, y, active = true) {
  position = { x: clamp(x), y: clamp(y) };
  card.style.setProperty('--px', `${position.x * 100}%`);
  card.style.setProperty('--py', `${position.y * 100}%`);
  card.style.setProperty('--rx', `${(0.5 - position.y) * 21}deg`);
  card.style.setProperty('--ry', `${(position.x - 0.5) * 25}deg`);
  card.style.setProperty('--shine', active ? '.85' : '.47');
  card.toggleAttribute('data-active', active);
}

function trackPointer(event) {
  const bounds = hitArea.getBoundingClientRect();
  aimLight((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
}

function reset() {
  clearTimeout(touchReset);
  aimLight(.5, .5, false);
}

hitArea.addEventListener('pointermove', event => {
  if (event.pointerType !== 'touch') trackPointer(event);
});
hitArea.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'touch') return;
  clearTimeout(touchReset);
  trackPointer(event);
  touchReset = setTimeout(reset, 1100);
});
hitArea.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'touch') reset();
});
hitArea.addEventListener('pointercancel', reset);
hitArea.addEventListener('blur', reset);

const steps = {
  ArrowLeft: [-.15, 0],
  ArrowRight: [.15, 0],
  ArrowUp: [0, -.15],
  ArrowDown: [0, .15]
};
hitArea.addEventListener('keydown', event => {
  const step = steps[event.key];
  if (!step) return;
  event.preventDefault();
  aimLight(position.x + step[0], position.y + step[1]);
});

for (const button of finishes) {
  button.addEventListener('click', () => {
    card.dataset.finish = button.dataset.finish;
    finishName.textContent = button.textContent;
    for (const choice of finishes) choice.setAttribute('aria-pressed', String(choice === button));
  });
}
