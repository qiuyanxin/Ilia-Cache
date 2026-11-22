import pathlib,json,re,concurrent.futures,subprocess
root=pathlib.Path('references/designbookmark');html=(root/'motion-catalog.html').read_text();bundle=(root/'chunks/1uhi9q0sufodg.js').read_text();items=re.findall(r'\{"@type":"ListItem","position":\d+,"name":"([^"]+)","url":"https://designbookmark.com/motion#([^"]+)"\}',html);items=list(dict.fromkeys(items));native={('db-'+slug):(name,cat) for slug,name,cat in re.findall(r'\bs\("([^"]+)","([^"]+)","([^"]+)"',bundle)};native['db-command-button']=('Command button','Buttons');data=[]
for name,id in items:
 if id in native:entry={'id':id,'name':name,'category':native[id][1],'provider':'DesignBookmark','sourceUrl':'https://designbookmark.com/motion#'+id}
 else:
  m=re.search(r'id:"'+re.escape(id)+r'",name:"[^"]+",element:"([^"]+)",source:"([^"]+)",docs:([^}]+?)\,play:',bundle)
  if not m:raise Exception('Missing source '+id)
  cat,provider,docs=m.groups();parts=re.findall(r'"([^"]+)"',docs);url='https://kokonutui.com/docs/'+'/'.join(parts) if provider=='kokonut' else 'https://smoothui.dev/docs/components/'+parts[0];entry={'id':id,'name':name,'category':cat,'provider':'Kokonut UI' if provider=='kokonut' else 'SmoothUI','sourceUrl':url}
 data.append(entry)
(root/'catalog-items.json').write_text(json.dumps(data,indent=2));(root/'code').mkdir(exist_ok=True)
def download(item):
 p=root/'code'/(item['id']+'.txt')
 if not p.exists():
  result=subprocess.run(['curl','-sSL','--fail','--retry','2','--max-time','25','https://designbookmark.com/motion-src/code/'+item['id']+'.txt','-o',str(p)],capture_output=True)
  if result.returncode:return {'id':item['id'],'error':result.stderr.decode()[-150:]}
 return {'id':item['id'],'size':p.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:report=list(ex.map(download,data))
(root/'download-report.json').write_text(json.dumps(report,indent=2));print(json.dumps({'catalog':len(data),'downloaded':sum('size' in r for r in report),'errors':[r for r in report if 'error' in r]}))
