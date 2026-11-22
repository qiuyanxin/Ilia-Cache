import re,pathlib,subprocess,concurrent.futures
root=pathlib.Path('references/designbookmark');html=(root/'motion-catalog.html').read_text();urls=list(dict.fromkeys(re.findall(r'<script src="([^"]+\.js)"',html)));(root/'chunks').mkdir(exist_ok=True)
def read(u):
 p=root/'chunks'/u.split('/')[-1]
 if not p.exists():subprocess.run(['curl','-sSL','--fail','--max-time','25','https://designbookmark.com'+u,'-o',str(p)],check=True)
 text=p.read_text();return {'file':str(p),'motionSrc':'motion-src' in text,'length':len(text)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as e:
 for r in e.map(read,urls):
  if r['motionSrc']:print(r)
