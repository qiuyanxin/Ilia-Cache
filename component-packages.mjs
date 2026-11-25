import {readFile} from 'node:fs/promises';
import {libraryDirectory} from './library-location.mjs';
export async function componentPackage(id){
 if(!/^[a-z0-9_-]+$/i.test(id))throw Error('组件编号无效');
 try{return JSON.parse(await readFile(new URL('packages/'+id+'.json',libraryDirectory),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(await readFile(new URL('./public/component-packages/'+id+'.json',import.meta.url),'utf8'));}
}
