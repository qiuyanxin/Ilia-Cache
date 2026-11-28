import { renderHomePage } from '../../../../../home-page-view.mjs';
import './site-theme.js';

const host = document.querySelector('#home-page');
const response = await fetch('./index.html');
if (!response.ok) throw new Error('卡包预览加载失败');
const pack = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('main');
const controls = pack.querySelector('.heading');
const sound = controls.querySelector('#toggle-sound');
controls.remove();
const stage = document.createElement('section');
stage.className = 'hero-pack-stage';
stage.setAttribute('aria-label', '拆卡包');
stage.append(sound, ...pack.children);

const original = document.createElement('template');
const links = { components: '/#/components', pages: '/#/pages' };
original.innerHTML = renderHomePage([], { linkFor: id => links[id] });
const copy = original.content.querySelector('.home-hero');
copy.classList.add('hero-pack-copy');
copy.querySelector('.home-shape-layer')?.remove();
host.append(stage, copy);
await import('./open-pack.js');
