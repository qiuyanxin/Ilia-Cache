import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
research={r['domain']:r for r in json.loads((root/'verification/website-research.json').read_text())}
web_verified={'deck.gallery','saaspo.com','browsermoon.com','pexels.com','stocksy.com','siteinspire.com','scrolltide.co'}
browser_verified={'leibox.pantoria.cn','brandarchive.xyz','land-book.com','dribbble.com','behance.net','motionarray.com'}
data={}
for line in pathlib.Path(__file__).with_name('site-summaries.tsv').read_text().splitlines():
 domain,name,category,finds,use,gets,cost=line.split('\t');r=research.get(domain,{})
 verified=(not r.get('error') and domain!='dribbble.com') or domain in web_verified|browser_verified
 info=dict(name=name,category=category,finds=finds,use=use,description=finds+' '+use,gets=gets,cost=cost,verification=('2026-11-21 · 已核对官网公开介绍与页面内容。' if verified else '2026-11-21 · 原站访问受限，依据原收藏说明整理，功能待复核。'),sourceUrl=r.get('url','https://'+domain+'/'),checkedAt='2026-11-21')
 if domain=='ai-project-cases.app.workbuddy.host':info['verification']='2026-11-21 · 已检查当前页面，提示链接不完整，需要完整分享链接。'
 if domain=='showheyohtaki.github.io':info['homeUrl']='https://showheyohtaki.github.io/motion-prompt/'
 if domain=='lemomo-ai.github.io':info['homeUrl']='https://lemomo-ai.github.io/lemo-opuscar/zh/'
 data[domain]=info
(root/'public/site-summaries.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
print('已提炼',len(data),'个网站说明；已核对',sum('已核对' in d['verification'] for d in data.values()),'个，其余明确标记待复核。')
