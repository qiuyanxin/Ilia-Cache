import { samples } from '../r01/samples.js';
import { spring } from '../../../../../springs.mjs';

import { expressionSheet } from './expressions.js';
import { cardNames } from '../r04/names.js';

const lines = {
  photo: '别动！刚才那张最好看。',
  paint: '这个点是故意画歪的。',
  code: '马上好。真的，这次保存了。',
  director: '很好，我们再来一条。',
  ballet: '嘘，脚尖先到。',
  sleep: '等我五分钟。上个五分钟不算。',
  angel: '叮。今天的好运砸到你啦。',
};

const finishes = { photo: '冰蓝镜头光晕', paint: '玫金波点', angel: '隐藏款 · 金粉放射全息' };
const tray = document.querySelector('.samples');
const template = document.querySelector('#sample');
const dialog = document.querySelector('.layer-dialog');
const layerStage = dialog.querySelector('.layer-stage');
const layerPreview = dialog.querySelector('.layer-preview');
const layerAction = dialog.querySelector('.layer-action');

function showLayers(split) {
  layerStage.classList.toggle('is-split', split);
  layerAction.textContent = split ? '合回卡片' : '展开分层';
}

layerAction.addEventListener('click', () => {
  showLayers(!layerStage.classList.contains('is-split'));
});

for (const sample of samples) {
  const figure = template.content.firstElementChild.cloneNode(true);
  const card = figure.querySelector('.card');
  const name = cardNames[sample.id];
  card.dataset.finish = sample.id;
  card.setAttribute('aria-label', sample.name + '，查看' + finishes[sample.id]);
  figure.querySelector('.mascot').src = sample.url;
  figure.querySelector('strong').textContent = name;
  figure.querySelector('small').textContent = lines[sample.id];
  figure.querySelector('.card-number').textContent = 'No.' + sample.number.padStart(4, '0');
  figure.querySelector('.card-type').textContent = 'Cache / ' + sample.number;
  figure.querySelector('.finish-label').textContent = finishes[sample.id];
  tray.append(figure);

  const inspect = figure.querySelector('.inspect-layers');
  inspect.setAttribute('aria-label', '看' + name + '的分层');
  inspect.addEventListener('click', () => {
    const example = card.cloneNode(true);
    example.removeAttribute('style');
    example.disabled = true;
    example.setAttribute('aria-hidden', 'true');
    layerPreview.replaceChildren(example);
    dialog.querySelector('#layer-title').textContent = name + '的分层';
    showLayers(false);
    dialog.showModal();
    layerAction.focus({preventScroll: true});
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (dialog.open) showLayers(true);
    }));
  });

  const axis = (key, effect) => spring(0, [295, 22], value => {
    card.style.setProperty(key, value * 100 + '%');
    card.style.setProperty(effect, value * 23 + 'deg');
  });
  const horizontal = axis('--light-x', '--turn-y');
  const vertical = axis('--light-y', '--turn-x');
  const aim = (x, y) => { horizontal.set(x); vertical.set(y); };
  const clamp = value => Math.max(-.5, Math.min(.5, value));

  card.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const bounds = card.getBoundingClientRect();
    aim(clamp((event.clientX - bounds.left) / bounds.width - .5),
        clamp(.5 - (event.clientY - bounds.top) / bounds.height));
  });
  card.addEventListener('pointerleave', () => aim(0, 0));
  card.addEventListener('blur', () => aim(0, 0));
  let side = 1;
  card.addEventListener('click', event => {
    if (event.pointerType === 'mouse') return;
    aim(.43 * side, .2);
    side *= -1;
  });
  card.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    aim(event.key === 'ArrowLeft' ? -.45 : .45, .16);
  });
}

const wrapper = document.querySelector('.wrapper');
const front = wrapper.querySelector('.wrap-front');
const before = wrapper.querySelector('.expression-before');
const after = wrapper.querySelector('.expression-after');
const coverStatus = document.querySelector('#cover-status');
const flip = document.querySelector('#flip-cover');
const expressions = ['平静', '左眨眼', '惊讶', '眯眼笑', '困困', '右眨眼', '睁大眼', '得意', '疑惑'];
const reactions = [2, 3, 0, 2, 6, 3, 1, 8, 3];
const coverColors = ['#f7e0b0','#f3d9c8','#dce5ed','#efd2bd','#dce2ef','#ecdfc5','#f2db9e','#eed1db','#e1dcce'];
let edition = 0;
let drag = null;
let suppressClick = false;
wrapper.style.setProperty('--sheet', 'url("' + expressionSheet + '")');

function sprite(element, frame) {
  element.style.backgroundPosition = (frame % 3) * 50 + '% ' + Math.floor(frame / 3) * 50 + '%';
}

function updateCover() {
  wrapper.classList.remove('is-torn','is-tearing');
  wrapper.style.setProperty('--tear', '0%');
  wrapper.style.setProperty('--paper', coverColors[edition]);
  sprite(before, edition);
  sprite(after, reactions[edition]);
  coverStatus.textContent = expressions[edition] + '款 · 点击或横拖封口';
}
function reveal() {
  if (wrapper.classList.contains('is-torn') || flip.getAttribute('aria-pressed') === 'true') return;
  wrapper.classList.remove('is-tearing');
  wrapper.classList.add('is-torn');
  coverStatus.textContent = expressions[edition] + ' → ' + expressions[reactions[edition]];
}
wrapper.addEventListener('pointerdown', event => {
  if (event.button !== 0 || wrapper.classList.contains('is-torn') || flip.getAttribute('aria-pressed') === 'true') return;
  const bounds = front.getBoundingClientRect();
  if (event.clientY - bounds.top > bounds.height * .25) return;
  suppressClick = false;
  drag = {id:event.pointerId, x:event.clientX, width:bounds.width, amount:0};
  wrapper.setPointerCapture(event.pointerId);
});
wrapper.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  drag.amount = Math.min(1, Math.abs(event.clientX - drag.x) / (drag.width * .78));
  if (drag.amount < .04) return;
  suppressClick = true;
  wrapper.classList.add('is-tearing');
  wrapper.style.setProperty('--tear', drag.amount * 100 + '%');
  if (drag.amount >= 1) reveal();
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) {
  wrapper.addEventListener(type, event => {
    if (drag?.id !== event.pointerId) return;
    const finish = type === 'pointerup' && drag.amount >= .48;
    drag = null;
    if (finish) reveal();
    wrapper.classList.remove('is-tearing');
  });
}
wrapper.addEventListener('click', () => {
  if (suppressClick) { suppressClick = false; return; }
  reveal();
});
document.querySelector('#next-cover').addEventListener('click', () => {
  edition = (edition + 1) % expressions.length;
  flip.setAttribute('aria-pressed','false');
  wrapper.removeAttribute('aria-pressed');
  flip.textContent = '看背面';
  updateCover();
});
flip.addEventListener('click', () => {
  const back = flip.getAttribute('aria-pressed') !== 'true';
  flip.setAttribute('aria-pressed', String(back));
  wrapper.setAttribute('aria-pressed', String(back));
  flip.textContent = back ? '看正面' : '看背面';
});
updateCover();
