import { cards } from '../r08/cards.js';
import { covers } from '../r07/expressions.js';
import { createKashCard } from './kash-card.js';
import './site-theme.js';

document.querySelector('.samples').append(...cards.map(createKashCard));

const wrapper = document.querySelector('.wrapper');
const before = wrapper.querySelector('.expression-before');
const after = wrapper.querySelector('.expression-after');
const coverColors = ['#f7e0b0', '#dce5ed', '#eed1db'];
let edition = 0;
const nextEdition = () => (edition + 1) % covers.length;

function updateCover() {
  wrapper.classList.remove('is-torn','is-tearing');
  wrapper.style.setProperty('--tear', '0%');
  wrapper.style.setProperty('--paper', coverColors[edition]);
  before.src = covers[edition].url;
  after.src = covers[nextEdition()].url;
}
export function revealCover() {
  wrapper.classList.add('is-torn');
}

document.querySelector('#next-cover').addEventListener('click', () => {
  edition = nextEdition();
  updateCover();
});

updateCover();
