import { isMotionPromptRecord } from './motion-prompt-preview/index.mjs';

// Dedicated upstream frames verified to render with sandbox="allow-scripts".
const smoothPreviews = new Map([
  ['designbookmark-exposure-slider', 'exposure-slider'],
  ['designbookmark-unlock-face-id', 'unlock-face-id'],
  ['designbookmark-scrubber', 'scrubber'],
  ['designbookmark-ai-task-list', 'ai-task-list'],
  ['designbookmark-music-toggle', 'music-toggle'],
]);

// Public selection IDs from the pinned Sound Lab Interface and Video catalogs.
// The upstream share protocol uses a URL fragment with only the selected ID.
const soundLab = 'https://reactbits.dev/tools/sound-lab';
const soundIds = new Set(`
pebble felt nib dew bead notch halo clasp unclasp check bloom crest shrug nudge chime
lantern ping ripple swish breeze sweep glide keycap chiclet thock dawn dusk seal puff
plush boop tink pluck dot petal marble daylight nightfall rocker spring settle shake hint
undo arrive cue signal tine flick unfold fold drawer enter erase fill release plug unplug
ember advance retreat tab leaf dive popover pickup place snap shuffle hover rebound stack
mark pulse uplink downlink second summit orbit dispatch bubble ellipsis wink callout
receipt huddle roll hold tally wrap shutter skip level coin glimmer upgrade confetti heart
streak treasure tide spiral throttle aurora swell strain upswing thunder slam anvil timber
crystal braam distant swoop whip spin twin gale silk backdraft rewind slowdown wipe zoom
dissolve portal ding spark wand stroke glint focus plunge descent sink quake fall dip
gravity bitflip snow data scramble tracking corrupt zap pixel nebula calm drizzle studio
highland deep nocturne caption appear tickertape slide counter banner stamp vanish cork
fizz blop balloon sprout squeak burble herald emblem verdict uplift enigma circuit
punchline finale heartbeat clockwork unease stalk suspense dread siren countdown ascent
lift glow velvet cushion haze gust pass drift inhale exhale shimmer stardust reveal
`.trim().split(/\s+/));

export function officialSourceForRecord(record) {
  if (!record || (record.sourceShort || record.sourceName) !== 'React Bits') return null;
  const id = /^reactbits-sound-([a-z0-9-]+)$/.exec(record.id)?.[1];
  if (!soundIds.has(id)) return null;
  const exactSource = soundLab + '#sound=' + id;
  const source = record.sourcePageUrl || record.url;
  return source === soundLab || source === exactSource ? exactSource : null;
}

export function isSoundLabPreview(value) {
  if (value === soundLab) return true;
  if (typeof value !== 'string' || !value.startsWith(soundLab + '#sound=')) return false;
  return soundIds.has(value.slice((soundLab + '#sound=').length));
}

function savedTransitionPoster(record, source, sourceName) {
  if (sourceName !== 'Transitions.dev') return null;
  const slug = /^transitions-([a-z0-9-]+)$/.exec(record.id)?.[1];
  if (!slug || source !== 'https://transitions.dev/detail.html?t=' + slug) return null;
  const url = '/component-posters/transitions-' + slug + '.jpg';
  return record.localPoster === url || (record.preview?.kind === 'image' && record.preview.url === url)
    ? { kind: 'image', url } : null;
}

const canvasDemos = new Set([
  'ascii-object', 'asciify', 'frost', 'glass', 'glass-object', 'glyph-rain',
  'particle-object', 'particle-scroll', 'liquid-object',
]);

function canvasVideo(record, source, sourceName) {
  if (sourceName !== 'Canvas UI') return null;
  const slug = /^leibox-([a-z0-9-]+)$/.exec(record.id)?.[1];
  if (!canvasDemos.has(slug) || source !== 'https://canvasui.dev/docs/components/' + slug) return null;
  return { kind: 'video', url: 'https://canvasui.dev/assets/videos/' + slug + '.webm' };
}

export function officialPreviewForRecord(record) {
  if (!record) return null;
  const source = record.sourcePageUrl || record.url;
  const sourceName = record.sourceShort || record.sourceName;
  const soundSource = officialSourceForRecord(record);
  if (soundSource || (record.id === 'reactbits-sound-engine' && sourceName === 'React Bits' && source === soundLab)) {
    return { kind: 'html', url: soundSource || soundLab };
  }

  const poster = savedTransitionPoster(record, source, sourceName);
  if (poster) return poster;

  const canvas = canvasVideo(record, source, sourceName);
  if (canvas) return canvas;

  if (record.id === 'reactbits-shape-grid' && sourceName === 'React Bits' &&
      source === 'https://reactbits.dev/backgrounds/shape-grid') {
    return { kind: 'image', url: 'https://reactbits.dev/og/backgrounds/shape-grid.jpg', ratio: 1200 / 630 };
  }

  const smoothSlug = smoothPreviews.get(record.id);
  if (smoothSlug && sourceName === 'SmoothUI' && source === 'https://smoothui.dev/docs/components/' + smoothSlug) {
    return { kind: 'html', url: 'https://smoothui.dev/preview/' + smoothSlug + '?embed=1' };
  }

  if (!isMotionPromptRecord(record) || record.sourcePolicy !== 'bundled-source' || record.license !== 'MIT') return null;
  const number = Number(record.id.slice(-3));
  if (number < 193 || number > 216) return null;

  // Motion Prompt's official artstyle pack maps its scene number to a
  // style-NN.webp output and explicitly grants MIT for these authored images.
  const style = String(number - 192).padStart(2, '0');
  const url = 'https://showheyohtaki.github.io/motion-prompt/packs/artstyle/img/style-' + style + '.webp';
  return { kind: 'image', url, ratio: 1078 / 416 };
}
