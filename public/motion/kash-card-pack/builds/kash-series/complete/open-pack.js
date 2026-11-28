import { revealCover } from './pack-ui.js';
import { bindTear } from './tear.js';
import { bindMagneticButton } from './creation-button.js';
import { unlockSound, muteSound, rip, grab, yelp, pop, swirl, land, lift, angelChime, settlePack, releasePack } from './sound.js';

document.documentElement.classList.toggle('pack-embedded', window !== window.top);

const packageSection = document.querySelector('.package');
const wrapper = packageSection.querySelector('.wrapper');
const source = document.querySelector('.samples');
const drawn = document.querySelector('.drawn');
const result = document.querySelector('.result');
bindMagneticButton(result.querySelector('.creation-link'));
const status = document.querySelector('#draw-status');
const again = document.querySelector('#open-again');
const nextCover = document.querySelector('#next-cover');
const sound = document.querySelector('#toggle-sound');
const canvas = document.querySelector('.ribbon-canvas');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const allCards = [...source.children];
const angel = allCards.find(card => card.querySelector('[data-finish=angel]'));
const standard = allCards.filter(card => card !== angel);
const probability = .05;
const fixedPack = new URLSearchParams(location.search).get('pack');
let phase = 'sealed';
let muted = false;
let entry;

function enterPack(withSound) {
  if (motion.matches) return;
  entry = wrapper.animate([
    { transform: 'translate3d(43vw,-32px,0) rotateY(-180deg) rotateZ(15deg) scale(.83)', opacity: .1, easing: 'cubic-bezier(.15,.72,.22,1)' },
    { transform: 'translate3d(-10px,0,0) rotateY(8deg) rotateZ(-3deg) scale(1.015)', opacity: 1, offset: .74 },
    { transform: 'none', opacity: 1 },
  ], { duration: 760 });
  if (withSound && !muted) { unlockSound(); settlePack(); }
}
sound.addEventListener('click', () => {
  muted = !muted;
  if (!muted) unlockSound();
  muteSound(muted);
  sound.setAttribute('aria-pressed', String(!muted));
  sound.textContent = muted ? '声音已关' : '声音已开';
});
const tear = bindTear(wrapper, canvas, {
  start() { entry?.cancel(); if (!muted) { unlockSound(); grab(); } },
  pull() { if (!muted) yelp(); },
  velocity(speed) { if (!muted) rip(speed); },
  release(torn) { if (!muted && !motion.matches) releasePack(torn); },
  finish(origin) { revealCover(); void openPack(origin); },
});
nextCover.addEventListener('click', () => {
  entry?.cancel();
  tear.reset();
  enterPack(true);
});
enterPack(false);
drawn.addEventListener('pointerover', event => {
  const card = event.target.closest('.card');
  if (!muted && phase === 'landed' && card && !card.contains(event.relatedTarget)) lift();
});

function pickCards() {
  const shuffled = [...standard];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const withAngel = fixedPack === 'angel' || (fixedPack !== 'normal' && Math.random() < probability);
  return withAngel ? [shuffled[0], angel, shuffled[1]] : shuffled.slice(0, 3);
}

const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => {
  const n = Math.max(0, Math.min(1, t));
  return n * n * (3 - 2 * n);
};

function fly(picks, origin, onLand) {
  const center = { x: innerWidth / 2, y: Math.max(125, Math.min(origin.y - 74, innerHeight * .40)) };
  const radius = Math.min(innerWidth * .31, 390);
  const launchTime = 255;
  const orbitTime = 1250;
  const start = performance.now();
  const cards = picks.map((element, index) => {
    const rect = element.getBoundingClientRect();
    return {
      element, index, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2,
      delay: index * 42 + (element === angel ? 125 : 0), landed: false,
    };
  });

  return new Promise(resolve => {
    function frame(now) {
      let complete = true;
      const positions = [];
      for (const card of cards) {
        const { element, index, x, y, delay } = card;
        const time = now - start - delay;
        if (time >= launchTime + orbitTime) {
          if (!card.landed) {
            card.landed = true;
            element.style.removeProperty('transform');
            element.style.removeProperty('opacity');
            element.style.removeProperty('z-index');
            onLand(element, index);
          }
          continue;
        }

        complete = false;
        const launch = smooth(time / launchTime);
        const orbit = Math.max(0, time - launchTime) / orbitTime;
        const angle = index * Math.PI * 2 / picks.length + (1 - (1 - orbit) ** 2) * Math.PI * 2.55;
        const spread = smooth((orbit - .55) / .45);
        const ring = smooth(orbit / .23) * (1 - spread);
        const depth = Math.sin(angle) * radius * .54 * ring;
        const px = mix(mix(origin.x, center.x, launch) + Math.cos(angle) * radius * ring, x, spread);
        const py = mix(mix(origin.y + 29, center.y, launch) + Math.sin(angle) * radius * .31 * ring, y, spread);
        const roll = -Math.cos(angle) * 26 * ring;
        const yaw = -Math.cos(angle) * 46 * ring;
        const pitch = Math.sin(angle) * 15 * ring;
        const size = mix(mix(.48, .79, launch), 1, spread);
        element.style.opacity = String(smooth(time / 95));
        element.style.transform = `translate3d(${px-x}px,${py-y}px,${depth}px) rotateZ(${roll}deg) rotateX(${pitch}deg) rotateY(${yaw}deg) scale(${size})`;
        positions.push({ element, depth });
      }
      positions.sort((a, b) => a.depth - b.depth).forEach((item, i) => {
        item.element.style.zIndex = String(i + 1);
      });
      if (complete) resolve();
      else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

async function openPack(origin) {
  if (phase !== 'sealed') return;
  phase = 'opening';
  packageSection.classList.add('is-opening');
  const focusWasOnPack = wrapper.matches(':focus-visible');
  const packBounds = wrapper.getBoundingClientRect();
  wrapper.disabled = true;
  for (const button of packageSection.querySelectorAll('.cover-actions button')) button.disabled = true;
  if (!muted) {
    rip(0);
    pop(!motion.matches);
    if (!motion.matches) swirl();
  }
  const picks = pickCards();
  drawn.classList.add('is-flying');
  drawn.inert = true;
  drawn.append(...picks);
  drawn.hidden = false;
  if (!motion.matches) {
    const wrapperNow = wrapper.getBoundingClientRect();
    const delta = packBounds.top - wrapperNow.top;
    wrapper.animate([
      { transform: `translateY(${delta}px)`, opacity: 1, offset: 0 },
      { transform: `translateY(${delta}px) rotate(-3deg)`, opacity: 1, offset: .28 },
      { transform: `translateY(${delta + 165}px) rotate(13deg)`, opacity: 0, offset: 1 },
    ], { duration: 690, fill: 'both', easing: 'cubic-bezier(.3,0,.6,1)' });
    await fly(picks, origin, (card, index) => {
      if (!muted) land(index);
      if (card === angel) {
        card.setAttribute('data-reveal-secret', '');
        if (!muted) angelChime();
      }
    });
  } else if (!muted) {
    land(2);
    if (picks.includes(angel)) angelChime();
  }
  packageSection.hidden = true;
  drawn.classList.remove('is-flying');
  drawn.inert = false;
  const names = picks.map(card => card.querySelector('strong').textContent).join('、');
  status.textContent = picks.includes(angel) ? '抽到隐藏款：' + names : '本次抽到：' + names;
  result.hidden = false;
  phase = 'landed';
  if (focusWasOnPack) again.focus({preventScroll:true});
}

again.addEventListener('click', () => {
  if (phase !== 'landed') return;
  for (const sample of allCards) {
    sample.removeAttribute('data-reveal-secret');
    sample.querySelector('.card').dispatchEvent(new Event('cache:reset-card'));
  }
  source.append(...allCards);
  drawn.hidden = true;
  result.hidden = true;
  for (const animation of wrapper.getAnimations()) animation.cancel();
  wrapper.disabled = false;
  for (const button of packageSection.querySelectorAll('.cover-actions button')) button.disabled = false;
  packageSection.hidden = false;
  packageSection.classList.remove('is-opening');
  nextCover.click();
  phase = 'sealed';
  wrapper.focus({preventScroll:true});
});
