import {publicUrl} from './media.mjs';
const cache=new Map();
export function frameBlocked(headers){const x=headers.get('x-frame-options')||'',csp=headers.get('content-security-policy')||'';return /deny|sameorigin/i.test(x)||/frame-ancestors\s+[^;]+/i.test(csp)&&!/frame-ancestors\s+\*(?:\s|;|$)/i.test(csp);}
export async function inspectEmbed(value) {
  if (cache.has(value)) return cache.get(value);
  try {
    let url = await publicUrl(value);
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await fetch(url, {
        method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        url = await publicUrl(new URL(response.headers.get('location'), url).href);
        continue;
      }
      const result = { blocked: frameBlocked(response.headers), available: response.ok, url: url.href };
      if (response.ok) cache.set(value, result);
      return result;
    }
    return { blocked: false, available: false };
  } catch {
    return { blocked: null, available: null };
  }
}
