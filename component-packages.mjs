import {readFile} from 'node:fs/promises';
export async function componentPackage(id){
 if(!/^[a-z0-9_-]+$/i.test(id))throw Error('组件编号无效');
 try{return JSON.parse(await readFile(new URL('./data/packages/'+id+'.json',import.meta.url),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(await readFile(new URL('./public/component-packages/'+id+'.json',import.meta.url),'utf8'));}
}

export async function renderComponentPreview(id) {
 if (/^ilia-motion-[a-z]+$/.test(id)) {
  try {
   const pack = await componentPackage(id);
   return pack.files.find(file => file.name === 'index.html')?.content || '';
  } catch (error) {
   if (error.code === 'ENOENT') return '';
   throw error;
  }
 }
 const pack = /^interaction-[a-z0-9-]+$/.test(id) ? await componentPackage(id) : null;
 const snippet = pack?.files.find(file => file.name === 'component.html');
 if (!snippet) return '';
 const background = /^#[0-9a-f]{6}$/i.test(pack.previewBackground) ? pack.previewBackground : '#191b27';
 return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>组件预览</title>
<style>
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; display:grid; place-items:center; padding:16px; background:${background}; color:white; font:14px system-ui,sans-serif; }
:focus-visible { outline:2px solid #837aff; outline-offset:4px; }
</style>
</head>
<body>${snippet.content}</body>
</html>`;
}
