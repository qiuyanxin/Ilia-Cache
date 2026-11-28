import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
const blockedIP=ip=>{if(ip.includes(':')){const mapped=ip.toLowerCase().match(/^::ffff:(?:0:)?([\da-f]{1,4}):([\da-f]{1,4})$/);if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return blockedIP(`${high>>8}.${high&255}.${low>>8}.${low&255}`);}return !/^[23]/.test(ip)||ip.startsWith('2001:db8:');}const a=ip.split('.').map(Number);return a[0]===0||a[0]===10||a[0]===127||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]>=224||a[0]===100&&a[1]>=64&&a[1]<=127;};
export async function publicUrl(value){
 let u;try{u=new URL(value);}catch{throw Error('请粘贴有效的网址');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port))throw Error('只支持公开的 http / https 网页');
 const host=u.hostname.replace(/^\[|\]$/g,'');if(host==='localhost'||host.endsWith('.local')||host.endsWith('.localhost'))throw Error('不读取本机或内网地址');
 const addresses=isIP(host)?[{address:host}]:await lookup(host,{all:true});if(!addresses.length||addresses.some(a=>blockedIP(a.address)))throw Error('不读取本机或内网地址');
 return u;
}
export function decode(value){return value.replace(/&(?:amp|quot|apos|lt|gt|#39|#x[\da-f]+|#\d+);/gi,m=>{const v=m.slice(1,-1).toLowerCase();if(v.startsWith('#')){const n=v.startsWith('#x')?parseInt(v.slice(2),16):parseInt(v.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>','#39':"'"}[v]||m;});}
function attrs(tag){const result={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))result[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]??'');return result;}
export function parseMedia(html,base){
 const meta=new Map();for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const a=attrs(tag),key=(a.property||a.name||'').toLowerCase();if(a.content&&!meta.has(key))meta.set(key,a.content);}
 const absolute=value=>{if(typeof value!=='string'||!value.trim())return '';try{const u=new URL(value,base);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}};
 let title=meta.get('og:title')||meta.get('twitter:title')||decode((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'').replace(/<[^>]*>/g,'').trim()||new URL(base).hostname;
 const source=new URL(base),findPath=source.hostname==='designeer.xyz'?source.pathname.match(/^\/finds\/[^/]+/)?.[0]:'';
 const media=[],seen=new Set();function add(type,url,poster=''){url=absolute(url);if(!url||/(?:leibox-og|logo|avatar|tracking)(?:[.\W_]|$)/i.test(url)||seen.has(url)||media.length>=10||/\.(?:svg|ico)(?:[?#]|$)/i.test(url)||findPath&&!new URL(url).pathname.startsWith(findPath+'/'))return;seen.add(url);media.push({type,url,...(poster&&absolute(poster)?{poster:absolute(poster)}:{})});}
 for(const key of ['og:video:secure_url','og:video:url','og:video','twitter:player:stream']){const value=meta.get(key);if(value&&(/\.(mp4|webm|ogg)([?#]|$)/i.test(value)||/video\/(mp4|webm)/.test(meta.get('og:video:type')||'')))add('video',value,meta.get('og:image'));}
 for(const tag of html.match(/<video\b[^>]*>[\s\S]*?<\/video>/gi)||[]){const a=attrs(tag.split('>')[0]+'>');if(a.src)add('video',a.src,a.poster);for(const source of tag.match(/<source\b[^>]*>/gi)||[]){const s=attrs(source);if(s.src)add('video',s.src,a.poster);}}
 // Some pages send lazy media as escaped JSON, before a video element is mounted.
 const payload=html.replace(/\\+"/g,'"').replace(/\\\//g,'/');
 for(const object of payload.match(/\{[^{}]{0,1800}"kind"\s*:\s*"video"[^{}]{0,1800}\}/g)||[]){try{const v=JSON.parse(object);const src=v.tileUrl||v.url||v.src;if(/\.(mp4|webm|ogg)([?#]|$)/i.test(src||''))add('video',src,v.posterUrl||v.poster);}catch{}}
 for(const key of ['og:image:secure_url','og:image','og:image:url','twitter:image','twitter:image:src'])if(meta.get(key))add('image',meta.get(key));
 for(const script of html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[]){try{const data=JSON.parse(script.replace(/^[^>]*>/,'').replace(/<\/script>$/i,''));const walk=(v,depth=0)=>{if(depth>10||!v||typeof v!=='object')return;if(v['@type']==='VideoObject'&&v.contentUrl)add('video',v.contentUrl,Array.isArray(v.thumbnailUrl)?v.thumbnailUrl[0]:v.thumbnailUrl);if(v.image){for(const image of Array.isArray(v.image)?v.image:[v.image])add('image',typeof image==='string'?image:image?.url);}for(const child of Object.values(v))if(typeof child==='object')Array.isArray(child)?child.forEach(c=>walk(c,depth+1)):walk(child,depth+1);};walk(data);}catch{}}
 for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const a=attrs(tag);if(a.width&&Number(a.width)<180||a.height&&Number(a.height)<100)continue;const src=a['data-src']||a.src||a.srcset?.split(',').at(-1)?.trim().split(/\s+/)[0];if(src&&!/(?:logo|icon|avatar|badge|tracking|pixel)(?:[\W_]|$)/i.test(src))add('image',src);}
 const iconTag=(html.match(/<link\b[^>]*>/gi)||[]).map(attrs).find(a=>/^(?:shortcut )?icon$/.test(a.rel||''));
 return {icon:absolute(iconTag?.href||'/favicon.ico'),title:title.slice(0,250),description:(meta.get('og:description')||meta.get('description')||'').slice(0,1000),media};
}
export async function readPageMedia(value,{includeText=false}={}){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
 try{let u=await publicUrl(value);for(let redirect=0;redirect<5;redirect++){
 const response=await fetch(u,{redirect:'manual',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; IliaDesignLibrary/1.0)','Accept':'text/html,application/xhtml+xml'}});
 if([301,302,303,307,308].includes(response.status)){const target=response.headers.get('location');if(!target)throw Error('网页跳转地址缺失');u=await publicUrl(new URL(target,u).href);continue;}
 if(!response.ok)throw Error(`网页暂时不允许读取（${response.status}），可以先保存链接`);
 const type=response.headers.get('content-type')||'';
 if(type.startsWith('image/')){await response.body?.cancel();return {title:u.pathname.split('/').at(-1)||u.hostname,description:'',media:[{type:'image',url:u.href}],url:u.href};}
 if(type.startsWith('video/')){await response.body?.cancel();return {title:u.pathname.split('/').at(-1)||u.hostname,description:'',media:[{type:'video',url:u.href}],url:u.href};}
 if(!/html/i.test(type)){await response.body?.cancel();throw Error('这个链接不是可读取的网页、图片或视频');}
 const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>3*1024*1024)break;chunks.push(Buffer.from(chunk));}
 const html=Buffer.concat(chunks).toString('utf8');
 const research=includeText?{headings:[...(html.matchAll(/<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/gi))].slice(0,24).map(m=>decode(m[1].replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim()),pageText:decode(html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim().slice(0,6500)}:{};
 return {...parseMedia(html,u.href),url:u.href,...research};
 }throw Error('网页跳转过多，可以先保存链接');}finally{clearTimeout(timer);}
}
