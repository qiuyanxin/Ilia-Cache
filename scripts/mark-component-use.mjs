import {readFile,writeFile} from 'node:fs/promises';
const [id,project,location]=process.argv.slice(2);
if(!id||!project||!location)throw Error('用法：node scripts/mark-component-use.mjs 组件ID 项目 路径或位置');
const base='http://127.0.0.1:4317',state=await(await fetch(base+'/api/library')).json(),r=state.resources.find(r=>r.id===id);
if(!r)throw Error('找不到组件 '+id);r.usage||=[];
if(!r.usage.some(u=>u.project===project&&u.location===location))r.usage.push({id:crypto.randomUUID(),project,location,created:new Date().toISOString()});
const response=await fetch(base+'/api/library',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...state,_patch:true,_changedResources:[id],_changedLessons:[],_changedInbox:[],_changedStyles:[]})});
if(!response.ok)throw Error('记录失败 '+response.status);console.log(r.name+'：使用 '+r.usage.length+' 次');
