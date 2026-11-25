import { FONT_GROUPS, mountFontLibrary } from './font-library-view.mjs';
import { icon } from './icons.mjs';
import { uploadFile } from './native-controls.mjs';

export function installFontLibrary(h) {
  const { getState, save, toast } = h;
  const page = document.createElement('main');
  page.id = 'font-library';
  page.hidden = true;
  document.querySelector('#collection-pages').after(page);

  let catalog = [];
  let showing = false;
  let loaded = false;
  const load = fetch('/font-catalog.json').then(response => {
    if (!response.ok) throw new Error('字体目录加载失败');
    return response.json();
  }).then(records => {
    if (!Array.isArray(records)) throw new Error('字体目录格式有误');
    catalog = records;
  }).catch(error => {
    toast(error.message || '字体目录加载失败');
  }).finally(() => { loaded = true; });

  function rows() {
    const state = getState();
    const removed = new Set(state.removedFontIds || []);
    return [...(state.customFonts || []), ...catalog].filter(font => !removed.has(font.id));
  }

  const view = mountFontLibrary(page, {
    getRecords: rows,
    onAdd: openAdd,
    onDelete(font) {
      if (!confirm(`删除字体 ${font.name}？`)) return false;
      const state = getState();
      state.customFonts = (state.customFonts || []).filter(record => record.id !== font.id);
      state.removedFontIds = [...new Set([...(state.removedFontIds || []), font.id])];
      save();
      h.nav();
      toast('已删除字体');
      return true;
    },
    onCollect(font) {
      h.projects?.addReferenceToCart({
        id: 'font:' + font.id, type: 'font', name: font.name, image: '', url: font.sourceUrl || '',
      });
    },
  });

  function openAdd(dialog) {
    dialog.innerHTML = `<form id="font-add-form">
      <div class="dialog-heading"><h2 id="font-add-title">添加字体</h2><button type="button" data-close aria-label="关闭">${icon('close')}</button></div>
      <input name="name" required placeholder="字体名称" aria-label="字体名称">
      <input name="source" placeholder="作者或来源简称" aria-label="作者或来源">
      <input name="sourceUrl" type="url" placeholder="来源链接 https://" aria-label="来源链接">
      <select name="language" aria-label="语言"><option>中文</option><option>英文</option></select>
      <select name="category" aria-label="字体分类">${FONT_GROUPS.slice(3).map(group => `<option>${group}</option>`).join('')}</select>
      <select name="commercial" aria-label="授权"><option>免费商用</option><option>免费非商用</option><option>版权见来源</option></select>
      <input name="previewUrl" type="url" placeholder="Google Fonts CSS 链接（可选）" aria-label="字体 CSS 链接">
      <label class="compact-file-control">${icon('upload')}<span>上传字体文件 WOFF2 / WOFF / TTF / OTF</span><input name="file" type="file" accept=".woff2,.woff,.ttf,.otf" hidden></label>
      <button type="submit" class="primary full">保存字体</button>
    </form>`;
    dialog.setAttribute('aria-labelledby', 'font-add-title');
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = new FormData(form);
      const name = String(values.get('name')).trim();
      const file = form.elements.file.files[0];
      const submit = form.querySelector('button[type=submit]');
      if (!name || submit.disabled) return;
      submit.disabled = true;
      try {
        const fontUrl = file ? (await uploadFile(file, () => {})).url : '';
        const row = {
          id: 'custom-font-' + crypto.randomUUID(), name,
          source: String(values.get('source')).trim() || '自行添加',
          sourceUrl: String(values.get('sourceUrl')).trim(),
          category: values.get('category'), commercial: values.get('commercial'),
          chinese: values.get('language') === '中文',
          previewUrl: String(values.get('previewUrl')).trim(), fontUrl,
          localFamily: 'Ilia ' + name, note: '', created: new Date().toISOString(),
        };
        const state = getState();
        state.customFonts = [row, ...(state.customFonts || [])];
        save();
        h.nav();
        if (form.isConnected) dialog.close();
        view.refresh();
        toast('已加入字体库');
      } catch (error) {
        toast(error.message || '字体上传失败');
      } finally {
        submit.disabled = false;
      }
    };
    dialog.showModal();
  }

  async function show() {
    showing = true;
    await load;
    if (!showing) return;
    for (const id of ['library', 'learning', 'component-library', 'collection-pages', 'projects-page', 'page-library', 'home-page', 'sources-page']) {
      document.getElementById(id)?.setAttribute('hidden', '');
    }
    page.hidden = false;
    document.querySelector('#breadcrumb').textContent = '字体库';
    view.refresh();
    h.nav();
  }

  function leave() {
    showing = false;
    page.hidden = true;
  }

  return { show, leave, count: () => loaded ? rows().length : 204, get showing() { return showing; } };
}
