/** Keep the header and tab controls mounted while switching detail panels. */
export function installComponentDetailTabs(tablist, panel, { tabs, selected, render, onSelect }) {
  const buttons = tabs.map((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.id = 'component-detail-tab-' + index;
    button.dataset.tab = name;
    button.textContent = name;
    button.setAttribute('aria-controls', panel.id);
    return button;
  });
  tablist.replaceChildren(...buttons);

  let active;
  function select(name, { focus = false, notify = false } = {}) {
    const next = buttons[tabs.indexOf(name)];
    if (!next || (!focus && !notify && active === name)) return;
    for (const button of buttons) {
      const selected = button === next;
      button.setAttribute('aria-selected', String(selected));
      button.classList.toggle('active', selected);
      button.tabIndex = selected ? 0 : -1;
    }
    if (focus) next.focus();
    panel.setAttribute('aria-labelledby', next.id);
    if (active !== name) {
      active = name;
      render(name);
      if (notify) onSelect?.(name);
    }
  }

  tablist.addEventListener('click', event => {
    const button = event.target.closest('[role="tab"]');
    if (button) select(button.dataset.tab, { notify: true });
  });
  tablist.addEventListener('keydown', event => {
    const index = buttons.indexOf(event.target);
    if (index === -1) return;
    let next;
    switch (event.key) {
      case 'ArrowLeft': next = (index - 1 + buttons.length) % buttons.length; break;
      case 'ArrowRight': next = (index + 1) % buttons.length; break;
      case 'Home': next = 0; break;
      case 'End': next = buttons.length - 1; break;
      default: return;
    }
    event.preventDefault();
    for (const [index, button] of buttons.entries()) button.tabIndex = index === next ? 0 : -1;
    buttons[next].focus();
  });
  select(selected);
  return select;
}
