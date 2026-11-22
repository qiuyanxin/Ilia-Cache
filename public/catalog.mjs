export function domainOf(value){try{return new URL(value).hostname.toLowerCase().replace(/^www\./,'');}catch{return '';}}
export function groupSites(resources){
 const groups=new Map();
 for(const r of resources){if(r.archived)continue;const domain=domainOf(r.url);if(!domain)continue;if(!groups.has(domain))groups.set(domain,[]);groups.get(domain).push(r);}
 return [...groups].map(([domain,members])=>{
  const isHome=r=>{const u=new URL(r.url);return u.pathname==='/'&&!u.search&&r.kind!=='案例';};
  const representative=members.find(isHome)||members.find(r=>r.kind!=='案例')||members[0];
  const cases=members.filter(r=>r.kind==='案例'||!isHome(r));
  return {...representative,id:'site:'+domain,domain,url:new URL(representative.url).origin+'/',kind:'网站',tags:[...new Set(members.flatMap(r=>r.tags||[]))],favorite:members.some(r=>r.favorite),members,cases};
 });
}
export function validPublicWebUrl(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';}}

export function mediaType(media){
 const url=String(media?.url||'').split('#')[0].split('?')[0].toLowerCase();
 return /\.(?:mp4|webm|mov|m4v)$/.test(url)?'video':media?.type;
}

export function conciseTitle(resource){if(resource.displayTitle)return resource.displayTitle;let url;try{url=new URL(resource.url);}catch{}if(url?.hostname==='github.com'){const parts=url.pathname.split('/').filter(Boolean);if(parts.length>=2)return parts[1].replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}const raw=(resource.pageTitle||resource.name||url?.hostname||'收藏').trim();let title=raw.replace(/\s*[|｜]\s*(?:LeiBox|GitHub|Pinterest).*$/i,'').split(/\s[—–]\s|:\s(?=[A-Z][a-z]+ is )/)[0];if(title.length>48)title=title.split(/[。！？.!?]/)[0].slice(0,45);return title;}
