import { rebuildComponentIndex } from '../library-store.mjs';

console.log(await rebuildComponentIndex() ? '已从本机资料重建组件索引。' : '本机还没有资料库。');
