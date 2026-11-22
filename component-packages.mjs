import {readFile} from 'node:fs/promises';
export async function componentPackage(id){if(!/^[a-z0-9_-]+$/i.test(id))throw Error('组件编号无效');return JSON.parse(await readFile(new URL('./data/packages/'+id+'.json',import.meta.url),'utf8'));}
