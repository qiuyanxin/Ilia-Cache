export const CAPTURE_TYPES=['组件','网页参考','图片提示词','视频提示词','设计风格','待整理'];
const registryCommand=/\bnpx\s+(?:--yes\s+)?shadcn(?:@[^\s]+)?\s+add\b|https?:\/\/[^\s]+\/r\/[^\s]+\.json\b/i;
const sourceCode=/(?:^|\n)\s*(?:import|export)\s|(?:function|class)\s+[A-Z][\w$]*\b|(?:const|let|var)\s+[A-Z][\w$]*\s*=|<[A-Z][\w.-]*(?:\s|>|\/)|<!doctype\s+html|<(?:html|body|div|button|nav|section)\b/i;

export function detectCaptureInput(text='',attachments=[],expected=''){
 const value=String(text).trim();
 if(registryCommand.test(value))return {kind:'component',mode:'registry',label:'组件安装命令'};
 if(sourceCode.test(value)||attachments.some(file=>/\.(?:html?|css|[cm]?js|tsx?|jsx|vue|svelte|json)$/i.test(file.name||'')))return {kind:'component',mode:'source',label:'组件代码'};
 const hasUrl=/https?:\/\/[^\s<>"]+/i.test(value);
 if(expected==='component'&&hasUrl)return {kind:'component',mode:'link',label:'组件链接'};
 if(expected==='page'&&hasUrl)return {kind:'page',label:'页面链接'};
 if(expected==='website'&&hasUrl)return {kind:'website',label:'网站链接'};
 if(hasUrl)return {kind:'web',label:'网页链接'};
 if(attachments.length)return {kind:'material',label:'文件或素材'};
 return {kind:'text',label:'文字'};
}
export function parseCapture(text,attachments=[]){const urls=[...new Set((text.match(/https?:\/\/[^\s<>"，。；）]+/g)||[]).map(s=>s.replace(/[)\],.;\\]+$/,'')))];const contentUrls=urls.filter(u=>!/^https?:\/\/(?:www\.)?w3\.org\//i.test(u));urls.splice(0,urls.length,...contentUrls);const first=text.trim().split('\n').find(s=>s.trim())||attachments[0]?.name||'新收藏';const title=(first.match(/Add the ["“]([^"”]+)["”]/i)?.[1]||first.replace(/^#+\s*/,'')).slice(0,80);let category='待整理';if(/animated component|组件|react|tailwind|\/docs\/animations\/|\/motion-src\//i.test(text))category='组件';else if(/视频提示|生成视频|seedance|kling|sora|veo|video prompt/i.test(text))category='视频提示词';else if(/生图|图片提示|midjourney|seedream|flux|dall.?e|image prompt/i.test(text))category='图片提示词';else if(/设计风格|art nouveau|liquid chrome|inflatable|styleguide/i.test(text))category='设计风格';else if(urls.length)category='网页参考';const source=urls.find(u=>/\/docs\/|#db-|\/motion#/.test(u))||urls.find(u=>!u.includes('/motion-src/'))||urls[0]||'';return {title,category,urls,source};}
