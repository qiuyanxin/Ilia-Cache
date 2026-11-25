import { icon } from "./icons.mjs";
import { spring, MOTION } from "./springs.mjs";
import { isWorkspaceSearchControl } from "./workspace-search.mjs";

/** Mount the shared shortcut bar and return the setter for the current page action. */
export function installWorkspaceDock(header, {
  dockActions, initialDockAction, initialBreadcrumb, focusSearch, captureDialog,
}) {
  const theme = header.querySelector("#theme-controls");
  const staticDock = header.querySelector(".action-dock");
  const dock = staticDock || document.createElement("nav");
  dock.className = "action-dock";
  dock.setAttribute("aria-label", "快捷操作");
  const dockHighlight = document.createElement("span");
  dockHighlight.className = "dock-highlight";
  dock.prepend(dockHighlight);
  const crumb = staticDock ? header.querySelector("#breadcrumb") : document.createElement("span");
  crumb.id = "breadcrumb";
  crumb.textContent = initialBreadcrumb;
  if (!staticDock) header.replaceChildren(crumb, dock, theme);

  const tabs = dockActions.map((action) => {
    let button = staticDock && [...dock.querySelectorAll("[data-dock]")].find(item => item.dataset.dock === action.id);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.dock = action.id;
      button.setAttribute("aria-label", action.label);
      button.innerHTML = icon(action.icon);
      const label = document.createElement("span");
      label.textContent = action.label;
      button.append(label);
      dock.append(button);
    }
    const label = button.querySelector(":scope > span");
    return { action, button, label };
  });
  for (const tab of tabs) {
    const { button, label } = tab;
    tab.full = label.scrollWidth + 8;
    tab.width = spring(0, MOTION.barLabel, (x) => {
      label.style.width = Math.max(0, x) + "px";
      label.style.paddingLeft =
        Math.max(0, Math.min(1, x / tab.full)) * 8 + "px";
      label.style.opacity = Math.max(
        0,
        Math.min(1, (x / tab.full) * 1.4 - 0.4),
      );
    });
    const glyph = button.querySelector("svg");
    tab.pop = spring(
      1,
      MOTION.barIcon,
      (x) => (glyph.style.transform = `scale(${x})`),
    );
  }
  const dockTab = (id) => tabs.find((tab) => tab.action.id === id);
  const initialTab = dockTab(initialDockAction) || tabs[0];
  let pageTab = initialTab;
  let selectedTab;
  const highlightPosition = spring(
    0,
    MOTION.barHighlight,
    (x) => (dockHighlight.style.transform = `translateX(${x}px)`),
  );
  const highlightWidth = spring(
    0,
    MOTION.barHighlight,
    (x) => (dockHighlight.style.width = Math.max(0, x) + "px"),
  );
  const measureDock = () => {
    if (!selectedTab) return;
    highlightPosition.set(selectedTab.button.offsetLeft);
    highlightWidth.set(selectedTab.button.offsetWidth);
  };
  const dockResize = new ResizeObserver(measureDock);
  for (const tab of tabs) {
    dockResize.observe(tab.button);
    tab.button.onclick = event => {
      if (tab.button instanceof HTMLAnchorElement) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
      }
      if (tab.action.id !== "search" && tab.action.id !== "capture") pickDock(tab);
      if (tab.action.onSelect) tab.action.onSelect();
      else if (tab.action.id === "search") focusSearch();
    };
  }
  function pickDock(tab, animate = true) {
    selectedTab = tab;
    for (const candidate of tabs) {
      const selected = candidate === tab;
      if (candidate.button instanceof HTMLAnchorElement) candidate.button.dataset.selected = String(selected);
      else candidate.button.setAttribute("aria-pressed", String(selected));
      const target = selected ? candidate.full : 0;
      if (animate) candidate.width.set(target);
      else candidate.width.jump(target);
    }
    if (!animate) {
      highlightPosition.jump(tab.button.offsetLeft);
      highlightWidth.jump(tab.button.offsetWidth);
      return;
    }
    tab.pop.jump(0.72);
    tab.pop.v = 6;
    tab.pop.set(1);
    measureDock();
  }
  function syncDockSelection(animate = true) {
    let next = pageTab;
    if (captureDialog?.open) next = dockTab("capture") || pageTab;
    else if (isWorkspaceSearchControl(document.activeElement, { expandedOnly: true })) next = dockTab("search") || pageTab;
    if (next && next !== selectedTab) pickDock(next, animate);
  }
  function setDockPage(id) {
    pageTab = dockTab(id) || initialTab;
    syncDockSelection();
  }
  for (const type of ["focusin", "focusout"]) {
    document.addEventListener(type, (event) => {
      if (isWorkspaceSearchControl(event.target)) {
        queueMicrotask(() => syncDockSelection());
      }
    });
  }
  if (captureDialog) {
    new MutationObserver(() => syncDockSelection())
      .observe(captureDialog, { attributeFilter: ["open"] });
  }
  syncDockSelection(!staticDock);
  return setDockPage;
}
