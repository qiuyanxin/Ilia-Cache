'use strict';

const pack = document.querySelector('#pack');
const deck = document.querySelector('#deck');
const burst = document.querySelector('#burst');
const hint = document.querySelector('#hint');
const again = document.querySelector('#again');
const sound = document.querySelector('#sound');
const status = document.querySelector('#status');
const skin = document.querySelector('#skin');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const portrait = matchMedia('(max-aspect-ratio: 10/11)');
const samples = [
  ['晨曦', 'DAWN', 28], ['冰晕', 'HALO', 199], ['偏振', 'POLAR', 251],
  ['余辉', 'AFTERGLOW', 323], ['极光', 'AURORA', 152],
  ['暮光', 'VESPER', 288], ['琥珀', 'AMBER', 48],
];
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const smooth = value => value * value * (3 - 2 * value);
let body, flap, drag, state, progress, target, velocity, direction, ripFrame, lastFrame, audio;
let edge = [];

function tone(frequency, duration, type, end = frequency, delay = 0) {
  if (sound.getAttribute('aria-pressed') !== 'true' || audio?.state !== 'running') return;
  const time = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
  envelope.gain.setValueAtTime(.0001, time);
  envelope.gain.exponentialRampToValueAtTime(.065, time + .012);
  envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
  oscillator.connect(envelope).connect(audio.destination);
  oscillator.start(time);
  oscillator.stop(time + duration);
}

sound.addEventListener('click', async () => {
  const enabled = sound.getAttribute('aria-pressed') !== 'true';
  sound.setAttribute('aria-pressed', enabled);
  if (!enabled) return;
  try {
    audio ??= new AudioContext();
    await audio.resume();
    tone(440, .15, 'sine', 660);
  } catch {
    sound.setAttribute('aria-pressed', 'false');
  }
});

function drawTear() {
  const x = clamp(progress) * 100;
  const points = edge.filter(([point]) => point < x);
  const index = Math.min(47, Math.floor(x * .48));
  const [left, y1] = edge[index];
  const [right, y2] = edge[index + 1];
  const y = y1 + (y2 - y1) * (x - left) / (right - left);
  points.push([x, y]);
  const mirror = point => direction === 1 ? point : 100 - point;
  const line = points.map(([point, height]) => mirror(point) + '% ' + height + '%');
  const start = mirror(0) + '%';
  const end = mirror(100) + '%';
  const tip = mirror(x) + '%';
  const upper = [start + ' 0%', tip + ' 0%', ...line.toReversed()];
  const lower = [...line, tip + ' 0%', end + ' 0%', end + ' 100%', start + ' 100%'];
  body.style.setProperty('--body', 'polygon(' + lower.join(',') + ')');
  flap.style.setProperty('--flap', 'polygon(' + upper.join(',') + ')');
  flap.style.setProperty('--hinge', tip + ' ' + y + '%');
  flap.style.setProperty('--curl', direction * x * .26 + 'deg');
  flap.style.setProperty('--fold', -x * .31 + 'deg');
  burst.style.opacity = String(x / 220);
}

function moveTear(next) {
  target = Math.max(target, next);
  if (ripFrame) return;
  lastFrame = performance.now();
  ripFrame = requestAnimationFrame(stepTear);
}

function stepTear(now) {
  ripFrame = 0;
  const step = Math.min((now - lastFrame) / 1000, 1 / 30) / 4;
  lastFrame = now;
  const frequency = 2 * Math.PI / (state === 'tearing' ? .1 : drag ? .1 : .28);
  for (let i = 0; i < 4; i++) {
    velocity += (frequency ** 2 * (target - progress) - 2 * frequency * velocity) * step;
    progress += velocity * step;
  }
  if (reduced.matches || Math.abs(progress - target) < .002 && Math.abs(velocity) < .025) {
    progress = target;
    velocity = 0;
  }
  drawTear();
  if (progress === 1) reveal();
  else if (progress !== target) ripFrame = requestAnimationFrame(stepTear);
}

function setTilt(element, event, range) {
  if (reduced.matches) return;
  const box = element.getBoundingClientRect();
  const x = clamp((event.clientX - box.left) / box.width);
  const y = clamp((event.clientY - box.top) / box.height);
  element.style.setProperty('--rx', (.5 - y) * range + 'deg');
  element.style.setProperty('--ry', (x - .5) * range + 'deg');
  element.style.setProperty('--px', x * 100 + '%');
  element.style.setProperty('--py', y * 100 + '%');
}

function clearTilt(element) {
  for (const key of ['--rx', '--ry', '--px', '--py']) element.style.removeProperty(key);
}

function reset() {
  state = 'idle';
  drag = null;
  progress = target = velocity = 0;
  direction = 1;
  edge = Array.from({length: 49}, (_, i) => [i / .48, 11 + Math.sin(i / 8) * .8 + (Math.random() - .5) * 1.35]);
  body = skin.content.firstElementChild.cloneNode(true);
  flap = body.cloneNode(true);
  body.classList.add('body');
  flap.classList.add('flap');
  flap.setAttribute('aria-hidden', 'true');
  pack.replaceChildren(body, flap);
  pack.classList.remove('opening');
  pack.hidden = pack.disabled = false;
  deck.hidden = again.hidden = true;
  hint.hidden = false;
  deck.replaceChildren();
  status.textContent = '';
  burst.style.opacity = 0;
  clearTilt(pack);
}

function finish() {
  if (state !== 'idle') return;
  if (!target) direction = Math.random() < .5 ? -1 : 1;
  state = 'tearing';
  tone(190, .2, 'triangle', 65);
  moveTear(1);
}

pack.addEventListener('pointerdown', event => {
  if (state !== 'idle' || event.button !== 0 || drag) return;
  drag = { id: event.pointerId, x: event.clientX, start: target, moved: false };
  pack.setPointerCapture(event.pointerId);
});
pack.addEventListener('pointermove', event => {
  if (state !== 'idle') return;
  if (!drag) return setTilt(pack, event, 27);
  if (drag.id !== event.pointerId) return;
  const delta = event.clientX - drag.x;
  if (Math.abs(delta) < 5 && !drag.moved) return;
  if (!drag.moved && !target) direction = Math.sign(delta);
  drag.moved = true;
  const travel = drag.start ? Math.abs(delta) : delta * direction;
  const next = drag.start + clamp(travel / (pack.offsetWidth * .85));
  if (next >= 1) finish();
  else moveTear(next);
});
pack.addEventListener('pointerleave', () => clearTilt(pack));
function release(event) {
  if (event.pointerId !== drag?.id) return;
  const moved = drag.moved;
  drag = null;
  if (event.type === 'pointerup' && (!moved || target > .55)) finish();
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pack.addEventListener(type, release);
pack.addEventListener('click', event => { if (event.detail === 0) finish(); });
again.addEventListener('click', () => { reset(); pack.focus({preventScroll: true}); });

function drawCards() {
  const shuffled = [...samples];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 5).map(sample => {
    const [name, label, hue] = sample;
    const number = samples.indexOf(sample) + 1;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.tabIndex = -1;
    card.setAttribute('aria-pressed', 'false');
    card.style.setProperty('--hue', hue);
    card.style.setProperty('--art-angle', 15 * number - 55 + 'deg');
    card.innerHTML = `<span class="card-face"><span class="art"></span><span class="foil"></span><span class="card-id">SPECIMEN / 0${number}</span><span class="card-label">${name}<small>${label}</small></span></span>`;
    card.addEventListener('pointermove', event => setTilt(card, event, 39));
    card.addEventListener('pointerleave', () => clearTilt(card));
    card.addEventListener('click', () => {
      const selected = card.classList.contains('selected');
      for (const other of deck.children) {
        other.classList.remove('selected');
        other.setAttribute('aria-pressed', 'false');
      }
      if (selected) return;
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      tone(360 * 2 ** (number / 12), .2, 'sine');
    });
    deck.append(card);
    return card;
  });
}

function layout(i, width) {
  const slot = i - 2;
  if (portrait.matches) {
    const column = i === 2 ? 0 : i % 2 === 0 ? -1 : 1;
    return [column * width * .55, Math.sign(slot) * width * 1.43, column * 3];
  }
  return [slot * width * 1.08, slot ** 2 * width * .046, slot * 3];
}

function position(card, x, y, angle) {
  card.style.setProperty('--x', x + 'px');
  card.style.setProperty('--y', y + 'px');
  card.style.setProperty('--angle', angle + 'deg');
}

function arrange() {
  const cards = [...deck.children];
  cards.forEach((card, i) => position(card, ...layout(i, card.offsetWidth)));
}

async function reveal() {
  state = 'opening';
  const viaKeyboard = pack.matches(':focus-visible');
  pack.classList.add('opening');
  pack.disabled = true;
  hint.hidden = true;
  deck.hidden = false;
  const cards = drawCards();
  arrange();
  if (!reduced.matches) {
    const box = pack.getBoundingClientRect();
    const animations = [];
    body.animate([{ transform: 'none' }, { transform: 'translateY(115vh) rotate(' + direction * 18 + 'deg)' }], { duration: 650, easing: 'cubic-bezier(.5,0,.95,.7)', fill: 'forwards' });
    flap.animate([{ transform: getComputedStyle(flap).transform }, { transform: 'translate(' + direction * 45 + 'vw,-95vh) rotate(' + direction * 240 + 'deg)' }], { duration: 610, easing: 'cubic-bezier(.12,.52,.72,1)', fill: 'forwards' });
    burst.animate([{opacity: .54, scale: '.8 1'}, {opacity: .8, scale: '1.2 1.4', offset: .25}, {opacity: 0, scale: '1 2.2'}], {duration: 820, fill: 'none'});
    burst.style.opacity = 0;
    tone(250, .34, 'triangle', 900);
    cards.forEach((card, i) => {
      const [endX, endY, endAngle] = layout(i, card.offsetWidth);
      const path = [];
      const transform = (x,y,z,turn,tilt,scale) => 'translate3d(' + x + 'px,' + y + 'px,' + z + 'px) rotate(' + turn + 'deg) rotateY(' + tilt + 'deg) scale(' + scale + ')';
      const height = Math.min(box.height * .62, innerHeight * .25);
      path.push({offset: 0, transform: transform(0, box.height * .14, 0, 0, 0, .75), opacity: 0});
      path.push({offset: .06, transform: transform(0, -height * .32, 0, 0, 0, .85), opacity: 1});
      for (let step = 0; step <= 32; step++) {
        const u = step / 32;
        const rotation = i * Math.PI * .4 + (1 - (1 - u) ** 2) * Math.PI * 2.5;
        const landing = smooth(clamp((u - .52) / .48));
        const ring = Math.sin(Math.min(1, u / .42) * Math.PI / 2) * (1 - landing);
        const radius = Math.min(innerWidth * .29, 330) * ring;
        const x = Math.cos(rotation) * radius + endX * landing;
        const y = -height * (1 - smooth(clamp(u / .5))) + Math.sin(rotation) * radius * .24 + endY * landing;
        const z = Math.sin(rotation) * ring * 140;
        const roll = endAngle * landing - Math.cos(rotation) * ring * 10;
        path.push({offset: .16 + .84 * u, transform: transform(x, y, z, roll, -Math.cos(rotation) * ring * 25, .92 + .08 * landing), opacity: 1});
      }
      animations.push(card.animate(path, { duration: 1490, delay: i * 27, fill: 'backwards' }).finished);
      tone(440 * 2 ** (i / 12), .19, 'sine', 600, 1.33 + i * .052);
    });
    await Promise.all(animations);
  }
  pack.hidden = true;
  burst.style.opacity = 0;
  state = 'spread';
  arrange();
  for (const card of cards) {
    card.classList.add('ready');
    card.tabIndex = 0;
  }
  again.hidden = false;
  status.textContent = '已抽出五张：' + cards.map(card => card.querySelector('.card-label').firstChild.textContent).join('、');
  if (viaKeyboard) cards[0].focus({preventScroll: true});
}

addEventListener('resize', () => { if (state === 'spread') arrange(); });
reset();
