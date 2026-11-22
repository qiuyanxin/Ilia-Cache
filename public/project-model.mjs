export function addToCart(state,id){state.componentCart||=[];if(state.componentCart.includes(id))return false;state.componentCart.push(id);return true;}
export function moveCartToProject(state,projectId,ids){const p=state.projects?.find(x=>x.id===projectId&&!x.archived);if(!p)throw Error('请选择项目');const chosen=new Set(ids.filter(id=>state.componentCart?.includes(id)));p.componentIds=[...new Set([...(p.componentIds||[]),...chosen])];state.componentCart=(state.componentCart||[]).filter(id=>!chosen.has(id));return chosen.size;}
export function markProjectUse(state,projectId,id){const p=state.projects?.find(p=>p.id===projectId),r=state.resources.find(r=>r.id===id);if(!p?.componentIds.includes(id)||!r)return false;r.usage||=[];if(r.usage.some(u=>u.projectId===projectId))return false;r.usage.push({id:crypto.randomUUID(),projectId,project:p.name,location:'项目组件',created:new Date().toISOString()});return true;}

export const WEBSITE_REQUIREMENTS=Object.freeze([
 {id:'visual-style',name:'视觉风格',note:'先确定配色、圆角、质感和整体气质。',route:'styles'},
 {id:'page-structure',name:'页面结构',note:'挑一套页面模板，确定信息从上到下怎么排。',route:'pages'},
 {id:'navigation',name:'导航与菜单',note:'至少准备 Logo、页面入口和移动端菜单。',route:'components'},
 {id:'hero',name:'首屏与主标题',note:'说明这是什么，并给用户一个明确的下一步。',route:'pages'},
 {id:'primary-action',name:'主要按钮',note:'每页只设一个最重要的操作，例如开始、购买或联系。',route:'components'},
 {id:'secondary-action',name:'次要与返回按钮',note:'补齐了解更多、取消、返回和关闭等退路。',route:'components'},
 {id:'content',name:'内容卡片与展示',note:'选择介绍功能、案例、价格或作品的内容容器。',route:'components'},
 {id:'form',name:'输入与提交',note:'需要收集信息时，准备输入框、选择器和提交按钮。',route:'components'},
 {id:'feedback',name:'加载与反馈状态',note:'补齐加载、成功、错误、空内容和确认提示。',route:'components'},
 {id:'type',name:'字体系统',note:'确定标题、正文和数字各用什么字体。',route:'fonts'},
 {id:'footer',name:'页脚与必要信息',note:'放联系、版权、隐私或其他必须长期可见的信息。',route:'pages'}
]);

export function requirementsFor(template){return template==='website-basic'?WEBSITE_REQUIREMENTS.map(item=>({...item,done:false})):[];}
export function duplicateProject(state,projectId,id=crypto.randomUUID()){const source=state.projects?.find(project=>project.id===projectId&&!project.archived);if(!source)throw Error('项目不存在');const copy={...source,id,name:`${source.name} 副本`,componentIds:[...(source.componentIds||[])],references:(source.references||[]).map(item=>({...item})),requirements:(source.requirements||[]).map(item=>({...item})),created:new Date().toISOString()};state.projects.push(copy);return copy;}
