const attachment = '/api/assets/[a-f0-9-]+\\.';
const images = 'png|jpe?g|webp|gif';
const videos = 'mp4|webm|mov';

export const localImageAttachment = new RegExp(`^${attachment}(?:${images})$`);
export const localMediaAttachment = new RegExp(`^${attachment}(?:${images}|${videos})$`);

export function savedCasePreviewUrl(value) {
  if (typeof value !== 'string') return '';
  if (/^\/previews\/(?!\.{1,2}$)[\w.-]+$/.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  return '';
}

export function referenceAspectRatio({ ratio, width, height }) {
  const value = ratio ?? width / height;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
