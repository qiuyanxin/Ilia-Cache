const base='http://127.0.0.1:4317',state=await(await fetch(base+'/api/library')).json(),ids=[];
for(const [id,location] of [['builtin-sidebar-collapse','主导航'],['builtin-bottom-bar','顶部快捷栏'],['builtin-word-roll','侧栏标题'],['builtin-roll-links','导航文字'],['builtin-copy-button','复制提示词'],['builtin-command-button','搜索框'],['builtin-stack-panel','侧栏设置'],['builtin-swipe-deck','网站卡组'],['builtin-pull-cord','换肤开关'],['transitions-input-clear-dissolve','输入框清空'],['fae5e50c-9da3-4e6b-8db0-c6d811a693ea','设计风格分类']]){
 const r=state.resources.find(r=>r.id===id);if(!r)continue;r.usage||=[];if(!r.usage.some(u=>u.project==='ui-library'&&u.location===location))r.usage.push({id:crypto.randomUUID(),project:'ui-library',location,created:new Date().toISOString()});ids.push(id);
}
for(const r of state.resources){if(!Array.isArray(r.tags))throw Error('组件标签不完整 '+r.id);}
const res=await fetch(base+'/api/library',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({...state,_patch:true,_changedResources:ids,_changedLessons:[],_changedInbox:[],_changedStyles:[]})});if(!res.ok)throw Error('记录失败');console.log('已记录 '+ids.length+' 个实际接入组件');
