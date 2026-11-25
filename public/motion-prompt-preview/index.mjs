// Motion Prompt's numbered Canvas scenes, pinned in UPSTREAM.md.
// The raster-dependent artstyle pack remains a link to the original site.
const scenes = [
  [1, 24, 'motion'],
  [25, 48, 'camera'],
  [49, 72, 'ui', 542 / 191],
  [73, 96, 'lp'],
  [97, 120, 'photo'],
  [121, 144, 'motion2'],
  [145, 168, 'lp2'],
  [169, 192, 'camera2'],
  [217, 240, 'diagram'],
];
const prefix = '/motion-prompt-preview/';
const official = 'https://showheyohtaki.github.io/motion-prompt/';

function recordNumber(record) {
  const match = /^motion-prompt-(\d{3})$/.exec(record?.id);
  if (!match || (record.sourceShort || record.sourceName) !== 'Motion Prompt') return null;
  const id = match[1];
  const source = record.sourcePageUrl || record.url;
  return source === official + '#' + id && Number(id) >= 1 && Number(id) <= 240 ? id : null;
}

export function isMotionPromptRecord(record) {
  return recordNumber(record) !== null;
}

export function motionPreviewForRecord(record, { assetPrefix = '' } = {}) {
  const id = recordNumber(record);
  if (!id || record.sourcePolicy !== 'bundled-source' || record.license !== 'MIT') return null;
  const scene = scenes.find(([first, last]) => Number(id) >= first && Number(id) <= last);
  if (!scene) return null;
  const [, , pack, ratio = 539 / 208] = scene;
  return {
    kind: 'html',
    url: assetPrefix + prefix + 'index.html?pack=' + pack + '&id=' + id,
    poster: assetPrefix + prefix + 'posters/' + id + '.webp',
    ratio,
  };
}
