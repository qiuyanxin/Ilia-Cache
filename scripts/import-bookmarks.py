import json,pathlib,re,hashlib,urllib.parse
out=pathlib.Path(__file__).resolve().parents[1]/'public'/'seed.json'
chrome=pathlib.Path.home()/'Library/Application Support/Google/Chrome/Default/Bookmarks'
vault=pathlib.Path.home()/'Library/Mobile Documents/iCloud~md~obsidian/Documents/vigkea'
resources=[]; seen=set()
known={
'reactbits.dev':('React Bits','组件','可复制源码与安装命令；适合文字、背景和交互动效。','源码','部分免费','reactbits.jpg'),
'leibox.pantoria.cn':('LeiBox','组件','UI 灵感与交互组件，详情提供代码与复刻提示词入口。','源码、提示词','待核实','leibox.jpg'),
'designeer.xyz':('Designeer','设计参考','手工精选的界面、动效、工具与设计师目录。','参考','待核实','designeer.jpg'),
'allan.xin':('优设美地','设计参考','网页与动效参考；当前页面说明登录后免费查看 50 件作品的提示词或设计说明。','提示词、参考','部分免费','allan.jpg'),
'designprompts.dev':('DesignPrompts','模板与提示词','选择页面类型和视觉风格，获取给编程 AI 的提示词。提示词免费，代码产品另有 Pro。','提示词','部分免费',''),
'ui.shadcn.com':('shadcn/ui','组件','可定制的基础界面组件与页面区块。','源码','免费',''),
'motionsites.ai':('MotionSites','模板与提示词','动态网页参考与页面生成提示词，具体条目需检查访问条件。','提示词','部分免费',''),
'21st.dev':('21st.dev','组件','社区组件和模板入口；具体费用、许可按条目检查。','源码、模板','待核实',''),
'www.cosmos.so':('Cosmos','审美与视觉','按主题发现图片、版式与视觉方向。','参考','待核实',''),
'savee.com':('Savee','审美与视觉','视觉收藏与审美参考。','参考','待核实',''),
'www.are.na':('Are.na','审美与视觉','按主题组织设计研究与参考。','参考','待核实',''),
'www.originkit.dev':('OriginKit','网页动效','动画组件与交互参考，使用前检查具体条目。','源码','待核实',''),
'shaders.paper.design':('Paper Shaders','网页动效','网页材质与 Shader 背景效果。','源码','待核实',''),
}
def add(title,url,source,visual=False,kind='网站',description=''):
 try:u=urllib.parse.urlsplit(url)
 except ValueError:return
 if u.scheme not in ['http','https'] or not u.hostname or u.hostname in ['localhost','127.0.0.1'] or '/oauth/' in u.path:return
 qs=urllib.parse.parse_qsl(u.query)
 qs=[(k,v) for k,v in qs if not k.startswith('utm_') and k not in ['gclid','gad_source','gad_campaignid','gbraid','via','tracking_source']]
 url=urllib.parse.urlunsplit((u.scheme,u.netloc,u.path,urllib.parse.urlencode(qs),''))
 if url in seen:return
 seen.add(url); host=u.hostname
 name,cat,desc,gets,cost,img=known.get(host,(title.split(' | ')[0].split(' — ')[0], '审美与视觉' if visual else '设计参考',description or '从现有收藏导入，具体使用方式待补充。','参考','待核实',''))
 if host not in known:
  if any(k in host for k in ['motion','transitions','beam.','detent','obsidianui']):cat='网页动效'
  if any(k in host for k in ['8bitcn','components','layouts']):cat='组件'
  if any(k in host for k in ['prompt','templens','browsermoon','aura.build']):cat='模板与提示词'
 tags=[cat]
 if visual:tags.append('审美')
 if 'react' in host or host in ['21st.dev','ui.shadcn.com']:tags.append('React')
 resources.append(dict(id=hashlib.sha1(url.encode()).hexdigest()[:12],name=name,url=url,category=cat,description=description or desc,gets=gets,cost=cost,tags=tags,kind=kind,source=source,preview='/previews/'+img if img else '',favorite=False,note='',prompt='',license='待核实',previewDate='2026-11-21' if img else ''))
def walk(n,folder=''):
 if n.get('type')=='folder':
  folder+='/'+n.get('name','')
  for c in n.get('children',[]):walk(c,folder)
 elif '/ui网站' in folder:add(n.get('name',''),n.get('url',''),'Chrome · '+folder, '审美参考' in folder)
for n in json.loads(chrome.read_text())['roots'].values():walk(n)
note=vault/'03 - 资源 (Resources)/AI学习与工具/03_工具与资源/UI 网站与资源导航.md'
for line in note.read_text().splitlines():
 m=re.match(r'- \[([^]]+)\]\((https?://[^)]+)\) — (.*)',line)
 if m:add(m[1],m[2],'Obsidian · UI 网站与资源导航',description=m[3])
add('立体按压按钮','https://leibox.pantoria.cn/docs/animations/tactile-push-button','LeiBox · 用户参考',kind='案例',description='悬停时下沉，按下时内缩。适合学习用 CSS 表现按钮层次。')
resources[-1].update(name='立体按压按钮',preview='',tags=['按钮','CSS','交互'],category='组件',gets='源码、提示词')
order=['Designeer','优设美地','LeiBox','React Bits','DesignPrompts','MotionSites','21st.dev']
resources.sort(key=lambda r:order.index(r['name']) if r['name'] in order else len(order))
out.write_text(json.dumps(resources,ensure_ascii=False,indent=2))
print('已导入',len(resources),'条资源；仅 UI 收藏夹与指定 UI 笔记。')
