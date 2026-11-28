import { spring } from '../../../../../springs.mjs';
import { cardNames } from '../r04/names.js';

const lines = {
  photo: '别动！刚才那张最好看！',
  paint: '这个点是故意画歪的～',
  code: '马上好。真的，这次保存了！',
  director: '很好，我们再来一条！',
  ballet: '嘘，脚尖先到～',
  sleep: '等我五分钟。上个五分钟不算～',
  angel: '叮。今天的好运砸到你啦！',
};

const messages = {
  photo: ['今天有没有什么让你多看了一眼？', '就从它开始吧。'],
  paint: ['先画一个点。', '画歪了也好，', '说不定它想变成别的东西。'],
  code: ['把你脑子里那个「要是能……」', '先做出一点点。', '能动一下就很了不起！'],
  director: ['如果今天只拍一个镜头，', '你最想让别人看见什么？'],
  ballet: ['试着给作品留一拍空白。', '你喜欢的那个细节，', '就有时间被看见了。'],
  sleep: ['今天只做五分钟也行。', '打开文件，', '给明天的自己留个开头～'],
  angel: ['今天我把好运塞进你口袋了。', '去试那个你一直偷偷想做的点子吧！'],
};
const template = document.createElement('template');
template.innerHTML = `
  <article class="sample">
    <button class="card" type="button">
      <span class="card-plane">
        <span class="card-turn">
          <span class="card-front">
            <span class="card-body">
              <span class="glass-base"></span>
              <span class="secret-foil"></span>
              <span class="portrait-window">
                <span class="foil"></span>
                <span class="foil-pattern"></span>
              </span>
              <span class="contact-shadow"></span>
              <span class="card-type" lang="en"></span>
              <span class="card-copy"><strong></strong><small></small></span>
              <span class="card-number"></span>
              <span class="glass-coat"></span>
              <span class="glass-rim"></span>
            </span>
            <img class="mascot" alt="" draggable="false" width="768" height="1024">
          </span>
          <span class="card-back" aria-hidden="true">
            <span class="glass-base"></span>
            <span class="secret-foil"></span>
            <span class="glass-coat"></span>
            <span class="glass-rim"></span>
            <span class="card-message"></span>
          </span>
        </span>
      </span>
    </button>
  </article>
`.trim();

export function createKashCard(sample) {
  const figure = template.content.firstElementChild.cloneNode(true);
  const card = figure.querySelector('.card');
  const name = cardNames[sample.id];
  card.dataset.finish = sample.id;
  const front = card.querySelector('.card-front');
  const back = card.querySelector('.card-back');
  back.querySelector('.card-message').replaceChildren(...messages[sample.id].map(line => {
    const span = document.createElement('span');
    span.textContent = line;
    return span;
  }));
  function showBack(flipped) {
    card.setAttribute('aria-pressed', String(flipped));
    card.setAttribute('aria-label', flipped ? name + '：' + messages[sample.id].join('') + ' 点击翻回正面' : name + '，翻看卡背');
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
  }
  showBack(false);
  card.addEventListener('cache:reset-card', () => showBack(false));
  figure.querySelector('.mascot').src = sample.url;
  figure.querySelector('strong').textContent = name;
  figure.querySelector('small').textContent = lines[sample.id];
  figure.querySelector('.card-number').textContent = 'No.' + sample.number.padStart(4, '0');
  figure.querySelector('.card-type').textContent = 'Cache / ' + sample.number;

  const axis = (key, effect, angle) => spring(0, [295, 22], value => {
    card.style.setProperty(key, value * 100 + '%');
    card.style.setProperty(effect, value * angle + 'deg');
  });
  const horizontal = axis('--light-x', '--turn-y', 41);
  const vertical = axis('--light-y', '--turn-x', 36);
  let lifted = false;
  const rise = spring(0, [260, 23], value => {
    figure.classList.toggle('is-raised', lifted || value > .34);
    card.style.setProperty('--hover-height', -value * 16 + 'px');
    card.style.setProperty('--hover-depth', value * 65 + 'px');
  });
  function aim(x, y) {
    horizontal.set(x);
    vertical.set(y);
  }
  function lift(active) {
    if (lifted === active) return;
    lifted = active;
    rise.set(active ? 1 : 0);
  }
  function rest() {
    aim(0, 0);
    lift(false);
  }
  const clamp = value => Math.max(-.5, Math.min(.5, value));

  card.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    lift(true);
    const bounds = card.getBoundingClientRect();
    aim(clamp((event.clientX - bounds.left) / bounds.width - .5),
        clamp(.5 - (event.clientY - bounds.top) / bounds.height));
  });
  card.addEventListener('pointerleave', rest);
  card.addEventListener('blur', rest);
  card.addEventListener('focus', () => { if (card.matches(':focus-visible')) lift(true); });
  card.addEventListener('click', () => showBack(card.getAttribute('aria-pressed') !== 'true'));
  card.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    lift(true);
    aim(event.key === 'ArrowLeft' ? -.45 : .45, .16);
  });
  return figure;
}
