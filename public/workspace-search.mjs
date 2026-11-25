import { inputValueRestored } from "./input-clear.mjs";
import { icon } from "./icons.mjs";
import { spring, MOTION } from "./springs.mjs";

const searchSelector = "[data-command-search],#search,#component-search";

export function isWorkspaceSearchControl(element, { expandedOnly = false } = {}) {
  return Boolean(element?.matches(searchSelector) ||
    element?.closest(expandedOnly ? ".command-search.is-open" : ".command-search"));
}

/** Enhance native search inputs and focus the search for the visible page. */
export function installWorkspaceSearch({ onMissingSearch } = {}) {
  const searches = new WeakMap();
  function decorate(input) {
    if (searches.has(input)) return;
    const wrap = document.createElement("div");
    wrap.className = "command-search";
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "command-trigger";
    openButton.innerHTML = icon("search") + "<span>搜索</span><kbd>⌘ K</kbd>";
    openButton.setAttribute(
      "aria-label",
      input.getAttribute("aria-label") || "搜索",
    );
    input.before(wrap);
    wrap.append(openButton, input);
    input.classList.add("command-input");
    input.setAttribute("autocomplete", "off");
    let open = false,
      sp = spring(
        152,
        MOTION.commandOpen,
        (x) => (wrap.style.width = Math.max(100, x) + "px"),
      ),
      press = spring(
        1,
        MOTION.commandPress,
        (x) => (wrap.style.transform = `scale(${x})`),
      );
    const available = () => Math.max(180, wrap.parentElement.clientWidth);
    const setOpen = (next, immediate = false) => {
      open = next;
      wrap.classList.toggle("is-open", open);
      openButton.setAttribute("aria-expanded", String(open));
      openButton.tabIndex = open ? -1 : 0;
      input.tabIndex = open ? 0 : -1;
      const width = open ? available() : 152;
      if (immediate) {
        sp.destroy();
        sp.jump(width);
      } else sp.set(width);
    };
    const syncRestoredValue = () => setOpen(Boolean(input.value) || document.activeElement === input, true);
    const expand = () => {
      setOpen(true);
      input.focus({ preventScroll: true });
    };
    const collapse = () => {
      if (input.value) return;
      setOpen(false);
    };
    openButton.onclick = expand;
    openButton.onpointerdown = () => press.set(0.97);
    openButton.onpointerup = () => press.set(1);
    openButton.onpointerleave = () => press.set(1);
    input.addEventListener("focus", () => {
      if (!open) expand();
    });
    input.addEventListener("blur", collapse);
    input.addEventListener(inputValueRestored, syncRestoredValue);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !e.isComposing) {
        e.preventDefault();
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        collapse();
        openButton.focus();
      }
    });
    syncRestoredValue();
    searches.set(input, { expand });
    new ResizeObserver(() => {
      if (open) sp.set(available());
    }).observe(wrap.parentElement);
  }
  function focusSearch() {
    const inputs = [...document.querySelectorAll(searchSelector)];
    const input = inputs.find((el) => {
      const main = el.closest("main");
      return main && !main.hidden && el.isConnected;
    });
    if (input) {
      searches.get(input)?.expand();
      input.focus();
    } else onMissingSearch?.();
  }
  return {
    refresh() { document.querySelectorAll(searchSelector).forEach(decorate); },
    focus: focusSearch,
  };
}
