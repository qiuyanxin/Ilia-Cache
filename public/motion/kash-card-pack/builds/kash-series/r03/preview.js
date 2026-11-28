import { samples } from '../r01/samples.js';
import { spring } from '../../../../../springs.mjs';

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
  card.dataset.finish = sample.id;
  card.setAttribute('aria-label', sample.name + '，查看' + finishes[sample.id]);
  figure.querySelector('.mascot').src = sample.url;
  figure.querySelector('strong').textContent = sample.name;
  figure.querySelector('small').textContent = sample.english;
  figure.querySelector('.card-number').textContent = sample.number + ' / 07';
  if (sample.id === 'angel') figure.querySelector('.card-type').textContent = 'CACHE / 隐藏款';
  figure.querySelector('.finish-label').textContent = finishes[sample.id];
  tray.append(figure);

  const inspect = figure.querySelector('.inspect-layers');
  inspect.setAttribute('aria-label', '看' + sample.name + '的分层');
  inspect.addEventListener('click', () => {
    const example = card.cloneNode(true);
    example.removeAttribute('style');
    example.disabled = true;
    example.setAttribute('aria-hidden', 'true');
    layerPreview.replaceChildren(example);
    dialog.querySelector('#layer-title').textContent = sample.name + '的分层';
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
wrapper.addEventListener('click', () => {
  const back = wrapper.getAttribute('aria-pressed') !== 'true';
  wrapper.setAttribute('aria-pressed', String(back));
  wrapper.setAttribute('aria-label', back ? '包装背面，点击看正面' : '包装正面，点击看背面');
});
