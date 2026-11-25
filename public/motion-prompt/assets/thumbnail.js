(async () => {
  const canvas = document.querySelector('canvas');
  const id = location.hash.slice(1);
  const element = window.MP_CATALOG.elements.find(item => item.id === id);
  if (!element) return;
  parent.postMessage({ type: 'cache:motion-preview-size', width: element.width, height: element.height }, '*');

  try {
    const base = new URL(`packs/${element.pack}/`, document.baseURI);
    if (element.pack === 'artstyle') {
      const image = new Image();
      const number = String(element.no).padStart(2, '0');
      image.src = new URL(`img/style-${number}.webp`, base);
      await image.decode();
      image.alt = '';
      canvas.replaceWith(image);
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('pack.js', base).href;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });

    const runtime = window.MotionPrompt;
    const pack = runtime.packs[element.pack];
    await pack.ready;
    if (pack.fonts?.length) await runtime.loadFonts(pack, base).catch(() => {});
    canvas.width = element.width;
    canvas.height = element.height;
    const context = canvas.getContext('2d');
    pack.cells[Number(element.no) - 1](context, element.width, element.height, element.cycle * 0.4);
  } catch {
    canvas.replaceWith('预览暂不可用');
  }
})();
