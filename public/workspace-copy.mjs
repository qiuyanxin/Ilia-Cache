function legacyCopy(text, trigger) {
  const field = document.createElement('textarea');
  field.className = 'workspace-copy-probe';
  field.readOnly = true;
  field.tabIndex = -1;
  field.value = text;
  const parent = trigger?.closest('dialog[open]') ?? document.body;
  parent.append(field);
  try {
    field.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }
}

function offerManualCopy(text, trigger) {
  const dialog = document.createElement('dialog');
  dialog.className = 'workspace-copy-dialog';
  dialog.setAttribute('aria-labelledby', 'workspace-copy-title');
  dialog.setAttribute('aria-describedby', 'workspace-copy-instructions');
  dialog.innerHTML = `<h2 id="workspace-copy-title">复制内容</h2>
    <p id="workspace-copy-instructions">浏览器未能自动复制。请复制已选中的文本。</p>
    <textarea class="command-field" rows="12" readonly aria-label="待复制文本" autofocus></textarea>
    <form method="dialog"><button type="submit">关闭</button></form>`;
  const field = dialog.querySelector('textarea');
  field.value = text;
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  field.select();
}

/** Use the same copy action and manual recovery in both workspaces. */
export function createWorkspaceCopy(toast) {
  let latestAttempt = 0;
  return async function copy(value, trigger = document.activeElement) {
    const text = String(value ?? '');
    const attempt = ++latestAttempt;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      if (attempt !== latestAttempt) return;
      copied = legacyCopy(text, trigger);
    }
    if (attempt !== latestAttempt) return;
    if (copied) {
      document.dispatchEvent(new CustomEvent('ilia:copied'));
      toast('已复制');
    } else {
      offerManualCopy(text, trigger);
    }
  };
}
