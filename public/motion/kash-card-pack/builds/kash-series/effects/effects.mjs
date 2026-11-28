import { spring } from '../../../../../springs.mjs';
import { cards } from '../r08/cards.js';
import { cardNames } from '../r04/names.js';

const effects = {
  photo: ['lens', '镜面与随动阴影', '镜头光斑扫过整张卡，桌面上的投影朝反方向移。'],
  paint: ['reverse', '反向玫金箔', '边框和卡名区一起闪玫金，插画保留原有色调。'],
  code: ['scan', '荧光扫描线', '上下移动光标，青绿光带从卡顶扫到卡底。'],
  director: ['film', '拉丝铜金', '斜向的金属细纹留在原位，明暗交界随角度移动。'],
  ballet: ['depth', '立体分层', '小鹿、标题和底卡在不同深度，倾斜时能看到各层错开。'],
  sleep: ['cosmos', '银河星点', '细碎的星光沿着一条淡星云散开，倾斜时两层微微错动。'],
  angel: ['prism', '放射彩虹箔', '彩虹渐变和放射纹一起移动，亮光从卡心扩到卡面。']
};

const card = document.querySelector('.card');
const mascot = card.querySelector('.mascot');
const characterPicker = document.querySelector('#character');
const effectPicker = document.querySelector('.effects');
const effectNote = document.querySelector('#effect-note');
const clamp = value => Math.min(.5, Math.max(-.5, value));
const shiftX = spring(0, [295, 22], value => {
  card.style.setProperty('--light-x', value * 100 + '%');
  card.style.setProperty('--turn-y', value * 23 + 'deg');
  card.style.setProperty('--shift-x', value * 52 + 'px');
});
const shiftY = spring(0, [295, 22], value => {
  card.style.setProperty('--light-y', value * 100 + '%');
  card.style.setProperty('--turn-x', value * 23 + 'deg');
  card.style.setProperty('--shift-y', value * 52 + 'px');
});
const scale = spring(0, [295, 22], amount => {
  card.style.setProperty('--lift', 1 + amount * .065);
  card.style.setProperty('--mascot-depth', 9 + amount * 11 + 'cqw');
  card.style.setProperty('--gloss', .18 + amount * .48);
});

for (const role of cards) characterPicker.add(new Option(role.name, role.id));
for (const [id, name] of Object.values(effects)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.effect = id;
  button.textContent = name;
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => applyEffect(id));
  effectPicker.append(button);
}

const byEffect = new Map(Object.values(effects).map(effect => [effect[0], effect]));
let direction = 1;
let aim = { x: 0, y: 0 };

function aimCard(x, y) {
  aim = { x: clamp(x), y: clamp(y) };
  shiftX.set(aim.x);
  shiftY.set(aim.y);
  scale.set(Math.min(1, Math.hypot(aim.x, aim.y) * 2.5));
}

function applyEffect(id) {
  const [effect, , description] = byEffect.get(id);
  card.dataset.effect = effect;
  for (const button of effectPicker.children) {
    button.setAttribute('aria-pressed', String(button.dataset.effect === effect));
  }
  effectNote.textContent = description;
}

function selectCard() {
  const role = cards[characterPicker.selectedIndex];
  card.dataset.finish = role.id;
  mascot.src = role.url;
  card.querySelector('.card-copy strong').textContent = cardNames[role.id];
  card.querySelector('.card-copy small').textContent = role.name;
  card.querySelector('.card-number').textContent = 'No.' + role.number.padStart(4, '0');
  card.setAttribute('aria-label', role.name + '，试动效');
}

characterPicker.addEventListener('change', selectCard);
document.querySelector('.recommendation').addEventListener('click', () => applyEffect(effects[characterPicker.value][0]));
card.addEventListener('pointermove', event => {
  if (event.pointerType === 'touch') return;
  const bounds = card.getBoundingClientRect();
  aimCard((event.clientX - bounds.left) / bounds.width - .5, .5 - (event.clientY - bounds.top) / bounds.height);
});
card.addEventListener('pointerleave', event => {
  if (event.pointerType !== 'touch') aimCard(0, 0);
});
card.addEventListener('pointercancel', () => aimCard(0, 0));
card.addEventListener('blur', () => aimCard(0, 0));
card.addEventListener('click', event => {
  if (event.pointerType === 'mouse') return;
  aimCard(.43 * direction, .2);
  direction *= -1;
});

const keys = { ArrowLeft: [-.15, 0], ArrowRight: [.15, 0], ArrowUp: [0, .15], ArrowDown: [0, -.15] };
card.addEventListener('keydown', event => {
  const step = keys[event.key];
  if (!step) return;
  event.preventDefault();
  aimCard(aim.x + step[0], aim.y + step[1]);
});

characterPicker.value = 'code';
selectCard();
applyEffect(effects[characterPicker.value][0]);
