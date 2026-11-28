import { connectCollectionPreviews } from './component-media.mjs';
import { styleReferenceGroup } from './component-categories.mjs';
import { isSoundEffect } from './extensions.js';
import { icon } from './icons.mjs';
import { spring } from './springs.mjs';
import { uploadFile } from './native-controls.mjs';
import { addResourceToProject, addReferenceToProject, moveLegacyPendingToProject, markProjectUse, requirementsFor, duplicateProject } from './project-model.mjs';
import { filterByWorkbenchType, referenceType, workbenchTabs, workbenchTypeTabs } from './workbench-taxonomy.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function installProjects(h) {
  const { getState, save, toast } = h;
  const page = document.createElement('main');
  page.id = 'projects-page';
  page.hidden = true;
  document.querySelector('#component-library').after(page);
  const dialog = document.createElement('dialog');
  dialog.id = 'project-dialog';
  document.body.append(dialog);
  let current = '';
  let showing = false;
  let projectFilter = 'all';

  const cart = () => getState().componentCart || [];
  const referenceCart = () => getState().referenceCart || [];
  const legacyCount = () => cart().length + referenceCart().length;
  const projects = () => (getState().projects?.filter(project => !project.archived) || [])
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { numeric: true, sensitivity: 'base' }));
  const resource = id => getState().resources.find(item => item.id === id && !item.archived);
  const resourceType = item => isSoundEffect(item) ? 'sound' : styleReferenceGroup(item) ? 'visual' : 'component';
  const containsResource = id => projects().some(project => (project.componentIds || []).includes(id));
  const containsReference = id => projects().some(project => (project.references || []).some(reference => reference.id === id));

  function persist() { save(); h.nav(); update(); }

  function updateReferenceButton(button) {
    const added = containsReference(button.dataset.projectReference);
    button.innerHTML = icon(added ? 'check' : button.hasAttribute('data-favorite-project') ? 'folder' : 'plus');
    button.setAttribute('aria-pressed', String(added));
    const label = `${added ? '已在项目中，继续加入其他项目 ' : '加入项目 '}${button._projectReference?.name || ''}`;
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function update() {
    document.querySelectorAll('[data-project-add],[data-cart-add]').forEach(button => {
      const id = button.dataset.projectAdd || button.dataset.cartAdd;
      const added = containsResource(id);
      const idleIcon = button.hasAttribute('data-favorite-project-resource') ? 'folder' : 'plus';
      button.innerHTML = button.classList.contains('component-cart-add') ? (added ? '✓' : '＋') : icon(added ? 'check' : idleIcon);
      button.setAttribute('aria-pressed', String(added));
      button.setAttribute('aria-label', `${added ? '已在项目中，继续加入其他项目 ' : '加入项目 '}${resource(id)?.name || ''}`);
    });
    document.querySelectorAll('[data-project-reference]').forEach(updateReferenceButton);
  }

  function chooseProject(onChoose, title = '选择项目') {
    const list = projects();
    if (!list.length) { toast('先创建一个项目'); newProject(onChoose); return; }
    if (list.length === 1) { onChoose(list[0]); return; }
    dialog.innerHTML = `<div class="dialog-heading"><h2>${esc(title)}</h2><button data-close aria-label="关闭">×</button></div>
      <div class="project-picker-list">${list.map(project => `<button type="button" data-project-choice="${esc(project.id)}">${icon('folder')}<span><strong>${esc(project.name)}</strong><small>${esc(project.type || '网页')}</small></span></button>`).join('')}</div>
      <button type="button" id="picker-new">添加项目</button>`;
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    dialog.querySelector('#picker-new').onclick = () => { dialog.close(); newProject(onChoose); };
    dialog.querySelectorAll('[data-project-choice]').forEach(button => button.onclick = () => {
      dialog.close();
      onChoose(list.find(project => project.id === button.dataset.projectChoice));
    });
    if (!dialog.open) dialog.showModal();
  }

  function addResource(id) {
    const item = resource(id);
    if (!item) return;
    chooseProject(project => {
      const added = addResourceToProject(getState(), project.id, id);
      persist();
      toast(added ? `已加入 ${project.name}` : `${project.name} 里已经有了`);
      if (showing && current === project.id) render();
    }, `把 ${item.name} 加入项目`);
  }

  function addReference(reference) {
    if (!reference) return;
    chooseProject(project => {
      const added = addReferenceToProject(getState(), project.id, reference);
      persist();
      toast(added ? `已加入 ${project.name}` : `${project.name} 里已经有了`);
      if (showing && current === project.id) render();
    }, `把 ${reference.name} 加入项目`);
  }

  document.addEventListener('click', event => {
    const resourceButton = event.target.closest('[data-project-add],[data-cart-add]');
    if (resourceButton) { addResource(resourceButton.dataset.projectAdd || resourceButton.dataset.cartAdd); return; }
    const referenceButton = event.target.closest('[data-project-reference]');
    if (referenceButton) addReference(referenceButton._projectReference);
  });

  function show() {
    showing = true;
    for (const id of ['library', 'learning', 'component-library', 'collection-pages']) document.getElementById(id).hidden = true;
    page.hidden = false;
    document.querySelector('#breadcrumb').textContent = '工作台';
    render();
  }

  function leave() { showing = false; page.hidden = true; }

  function tile(id, project) {
    const item = resource(id);
    if (!item) return '';
    const used = item.usage?.some(entry => entry.projectId === project.id);
    return `<article class="project-component"><button class="project-preview" data-project-preview="${esc(id)}">${h.componentMedia(item)}</button><h3>${esc(item.name)}</h3><div><button data-project-used="${esc(id)}" ${used ? 'disabled' : ''}>${used ? '已使用' : '标记使用'}</button><button data-project-remove="${esc(id)}">移出项目</button></div></article>`;
  }

  function wire(root, project) {
    connectCollectionPreviews(root);
    root.querySelectorAll('[data-project-preview]').forEach(button => button.onclick = () => h.openComponent(button.dataset.projectPreview));
    root.querySelectorAll('[data-project-used]').forEach(button => button.onclick = () => {
      if (markProjectUse(getState(), project.id, button.dataset.projectUsed)) { persist(); render(); }
    });
    root.querySelectorAll('[data-project-remove]').forEach(button => button.onclick = () => {
      project.componentIds = project.componentIds.filter(id => id !== button.dataset.projectRemove);
      persist(); render();
    });
  }

  function referenceTile(reference) {
    return `<article class="project-reference"><a href="${esc(reference.url || '#')}" target="_blank" rel="noopener noreferrer">${reference.image ? `<img src="${esc(reference.image)}" alt="${esc(reference.name)}" loading="lazy" referrerpolicy="no-referrer">` : icon(referenceType(reference) === 'visual' ? 'palette' : 'image')}<strong>${esc(reference.name)}</strong></a><button data-project-ref-remove="${esc(reference.id)}">移出项目</button></article>`;
  }

  function projectTicket(project) {
    const total = (project.componentIds?.length || 0) + (project.references?.length || 0);
    const cover = project.cover ? ` style="--project-cover:url('${esc(project.cover)}')"` : '';
    return `<button class="project-ticket ${project.cover ? 'has-cover' : ''}" data-project="${esc(project.id)}"${cover}><span class="ticket-grid" aria-hidden="true"></span><span class="ticket-layer">${icon('folder')}<strong>${esc(project.name)}</strong><small>${esc(project.type || '网页')} · ${total} 项</small></span><i class="ticket-glare"></i></button>`;
  }

  function requirementList(project) {
    const rows = project.requirements || [];
    const done = rows.filter(item => item.done).length;
    if (!rows.length) return '';
    return `<section class="project-requirements"><div class="project-requirements-heading"><div><h2>采购清单</h2><p>先把骨架买齐，再挑具体样式。${done}/${rows.length} 已完成</p></div></div><div class="project-requirement-grid">${rows.map(item => `<article class="${item.done ? 'done' : ''}"><label><input type="checkbox" data-requirement="${esc(item.id)}" ${item.done ? 'checked' : ''}><span><strong>${esc(item.name)}</strong><small>${esc(item.note)}</small></span></label><button data-requirement-route="${esc(item.route)}">去挑选</button></article>`).join('')}</div></section>`;
  }

  function bindTickets() {
    page.querySelectorAll('.project-ticket').forEach(ticket => {
      const layer = ticket.querySelector('.ticket-layer');
      const glare = ticket.querySelector('.ticket-glare');
      const rx = spring(0, [170, 15], value => ticket.style.setProperty('--rx', value + 'deg'));
      const ry = spring(0, [170, 15], value => ticket.style.setProperty('--ry', value + 'deg'));
      const dx = spring(0, [170, 15], value => layer.style.translate = value + 'px ' + (layer.dataset.dy || 0) + 'px');
      const dy = spring(0, [170, 15], value => { layer.dataset.dy = value; layer.style.translate = (layer.dataset.dx || 0) + 'px ' + value + 'px'; });
      ticket.onpointermove = event => {
        const rect = ticket.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width * 2 - 1;
        const y = (event.clientY - rect.top) / rect.height * 2 - 1;
        rx.set(-y * 8); ry.set(x * 10); layer.dataset.dx = x * 8; dx.set(x * 8); dy.set(y * 6);
        glare.style.setProperty('--gx', (x + 1) * 50 + '%'); glare.style.setProperty('--gy', (y + 1) * 50 + '%');
      };
      ticket.onpointerleave = () => { rx.set(0); ry.set(0); dx.set(0); dy.set(0); };
    });
  }

  function render() {
    const list = projects();
    const project = list.find(item => item.id === current);
    const resources = project ? (project.componentIds || []).map(id => ({ kind: 'resource', item: resource(id) })).filter(row => row.item) : [];
    const references = project ? (project.references || []).map(item => ({ kind: 'reference', item })) : [];
    const rows = [...resources, ...references];
    const typeOf = row => row.kind === 'resource' ? resourceType(row.item) : referenceType(row.item);
    const visible = filterByWorkbenchType(rows, projectFilter, typeOf);
    page.innerHTML = `<div class="page-heading"><h1>${project ? esc(project.name) : '工作台'}</h1><div>${project ? `<button id="project-duplicate">${icon('copy')}复制项目</button><button id="project-cover">${icon('image')}文件夹背景</button>` : ''}<button id="project-new" class="primary">${icon('plus')}添加项目</button></div></div>
      ${workbenchTabs('projects')}
      ${project ? `<button id="project-back">返回项目</button>${requirementList(project)}${workbenchTypeTabs(projectFilter, rows, typeOf)}<div class="project-components">${visible.map(row => row.kind === 'resource' ? tile(row.item.id, project) : referenceTile(row.item)).join('')}</div>` : `${legacyCount() ? `<section class="legacy-project-pending"><div><strong>待归入项目</strong><p>这是以前保留的待选内容，选择一个项目后再迁移，不会自动删除。</p></div><button id="project-pending">整理 ${legacyCount()} 项</button></section>` : ''}<div class="project-grid">${list.map(projectTicket).join('')}</div>`}`;
    page.querySelectorAll('[data-workbench-view]').forEach(button => button.onclick = () => h.switchView(button.dataset.workbenchView));
    page.querySelector('#project-new').onclick = () => newProject();
    page.querySelector('#project-pending')?.addEventListener('click', openLegacyPending);
    page.querySelector('#project-duplicate')?.addEventListener('click', () => { const copy = duplicateProject(getState(), project.id); current = copy.id; persist(); render(); toast('已复制项目，可以开始替换内容'); });
    page.querySelector('#project-cover')?.addEventListener('click', () => editCover(project));
    page.querySelector('#project-back')?.addEventListener('click', () => { current = ''; projectFilter = 'all'; render(); });
    page.querySelectorAll('[data-project]').forEach(button => button.onclick = () => { current = button.dataset.project; projectFilter = 'all'; render(); });
    page.querySelectorAll('[data-workbench-type]').forEach(button => button.onclick = () => { projectFilter = button.dataset.workbenchType; render(); });
    page.querySelectorAll('[data-requirement]').forEach(input => input.onchange = () => { const item = project.requirements.find(row => row.id === input.dataset.requirement); item.done = input.checked; persist(); render(); });
    page.querySelectorAll('[data-requirement-route]').forEach(button => button.onclick = () => h.switchView(button.dataset.requirementRoute));
    page.querySelectorAll('[data-project-ref-remove]').forEach(button => button.onclick = () => { project.references = (project.references || []).filter(reference => reference.id !== button.dataset.projectRefRemove); persist(); render(); });
    bindTickets();
    if (project) wire(page, project);
  }

  async function editCover(project) {
    const formDialog = document.createElement('dialog');
    formDialog.className = 'project-create';
    formDialog.innerHTML = `<form><div class="dialog-heading"><h2>文件夹背景</h2><button type="button" aria-label="关闭">×</button></div><input name="url" type="url" placeholder="粘贴图片链接" value="${esc(project.cover || '')}"><label class="compact-file-control">${icon('upload')}<span>上传背景图片</span><input name="file" type="file" accept="image/*" hidden></label><div class="dialog-actions"><button class="primary">保存</button>${project.cover ? '<button type="button" data-remove-cover>移除背景</button>' : ''}</div></form>`;
    document.body.append(formDialog);
    const close = () => { formDialog.close(); formDialog.remove(); };
    formDialog.querySelector('[aria-label=关闭]').onclick = close;
    formDialog.querySelector('[data-remove-cover]')?.addEventListener('click', () => { project.cover = ''; persist(); close(); render(); });
    formDialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const form = event.currentTarget; const file = form.elements.file.files[0];
      try { project.cover = file ? (await uploadFile(file, () => {})).url : String(new FormData(form).get('url')).trim(); persist(); close(); render(); toast('已更新文件夹背景'); }
      catch (error) { toast(error.message || '背景上传失败'); }
    };
    formDialog.showModal();
  }

  function newProject(afterCreate) {
    const formDialog = document.createElement('dialog');
    formDialog.className = 'project-create';
    formDialog.innerHTML = '<form><div class="dialog-heading"><h2>添加项目</h2><button type="button" aria-label="关闭">×</button></div><input name="name" required placeholder="项目名称" aria-label="项目名称"><select name="type" aria-label="项目类型"><option>网页</option><option>视频</option><option>其他</option></select><label>项目模板<select name="template" aria-label="项目模板"><option value="website-basic">网站基础采购单</option><option value="blank">空白项目</option></select></label><p class="project-template-note">不知道网站需要什么时，选择网站基础采购单。它会列出页面、按钮、表单、状态和字体等必需项。</p><button class="primary">创建项目</button></form>';
    document.body.append(formDialog);
    const close = () => { formDialog.close(); formDialog.remove(); };
    formDialog.querySelector('[aria-label=关闭]').onclick = close;
    formDialog.querySelector('form').onsubmit = event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const project = { id: crypto.randomUUID(), name: form.get('name').trim(), type: form.get('type'), componentIds: [], references: [], requirements: requirementsFor(form.get('template')), created: new Date().toISOString() };
      if (!project.name) return;
      (getState().projects ||= []).push(project); persist(); close();
      if (typeof afterCreate === 'function') afterCreate(project); else { current = project.id; if (showing) render(); }
    };
    formDialog.showModal();
  }

  function openLegacyPending() {
    chooseProject(project => {
      const moved = moveLegacyPendingToProject(getState(), project.id);
      persist(); toast(`已归入 ${project.name}，共 ${moved} 项`); current = project.id; h.switchView('projects');
    }, '把旧待选归入项目');
  }

  function bindReferenceButton(button, reference) {
    button._projectReference = reference;
    button.dataset.projectReference = reference.id;
    updateReferenceButton(button);
  }

  h.projects = { show, leave, render, openCart: openLegacyPending, addResource, addReference, addReferenceToCart: addReference, bindReferenceButton, has: containsResource, hasReference: containsReference, update };
  update();
  return h.projects;
}
