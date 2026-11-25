import { decorateClearInputs } from "./input-clear.mjs";
import { decorateDropdowns } from "./native-controls.mjs";
import { spring, MOTION } from "./springs.mjs";
import { icon } from "./icons.mjs";
import { installWorkspaceDock } from "./workspace-dock.mjs";
import { installWorkspaceSearch } from "./workspace-search.mjs";

const $ = (selector) => document.querySelector(selector);

const standardNavIcons = {
  home: "home",
  all: "web",
  components: "grid",
  pages: "web",
  fonts: "text",
  styles: "palette",
  aesthetic: "image",
  projects: "folder",
  accumulation: "book",
  sources: "link",
};

/**
 * Mount shared interactions once on a native workspace document.
 * The host supplies dock actions and optionally a theme setter, backup elements,
 * and the capture dialog and shortcut. Search focuses the visible native input by default.
 */
export function installWorkspaceChrome({
  dockActions = [{ id: "search", icon: "search", label: "搜索" }],
  initialDockAction = dockActions[0]?.id,
  initialBreadcrumb = "网站",
  navIcons = {},
  setTheme,
  backupControls,
  openCapture,
  captureDialog,
  onMissingSearch,
} = {}) {
  let compact = localStorage.getItem("ilia-sidebar-compact") === "true",
    activeCopy = null;
  const navigationIcons = { ...standardNavIcons, ...navIcons };
  $(".brand-sub")?.remove();
  const sidebar = $(".sidebar");
  sidebar.classList.toggle("is-compact", compact);
  const toggle = document.createElement("button");
  toggle.id = "sidebar-collapse";
  toggle.innerHTML = icon("left");
  toggle.setAttribute("aria-label", compact ? "展开导航" : "收起导航");
  toggle.setAttribute("aria-expanded", String(!compact));
  sidebar.prepend(toggle);
  const W = spring(compact ? 56 : 160, MOTION.sidebar, (x) => {
    document.documentElement.style.setProperty("--side", x + "px");
    sidebar.style.width = x + "px";
  });
  const R = spring(
    compact ? 1 : 0,
    [300, 22],
    (x) =>
      (toggle.querySelector("svg").style.transform = `rotate(${x * 180}deg)`),
  );
  let labelSprings = [];
  function animateLabels(open) {
    labelSprings.forEach((s) => s.destroy());
    labelSprings = [
      ...sidebar.querySelectorAll("#navigation [data-view] .nav-label"),
    ].map((el, i) => {
      const s = spring(open ? 0 : 1, MOTION.label, (x) => {
        el.style.opacity = Math.max(0, Math.min(1, x));
        el.style.transform = `translateX(${(1 - x) * -10}px)`;
      });
      if (open) setTimeout(() => s.set(1), 60 + i * 40);
      else s.set(0);
      return s;
    });
  }
  toggle.onclick = () => {
    compact = !compact;
    sidebar.classList.toggle("is-compact", compact);
    W.set(compact ? 56 : 160);
    R.set(compact ? 1 : 0);
    toggle.setAttribute("aria-label", compact ? "展开导航" : "收起导航");
    toggle.setAttribute("aria-expanded", String(!compact));
    localStorage.setItem("ilia-sidebar-compact", String(compact));
    animateLabels(!compact);
  };
  // Word Roll replaces the old workspace/LOCAL badge.
  const wordBox = $(".workspace-label");
  wordBox.className = "workspace-label word-roll";
  wordBox.innerHTML =
    '<span>积累</span><button type="button" aria-label="积累灵感"><span class="word-slot"></span></button>';
  const slot = wordBox.querySelector(".word-slot"),
    wordButton = wordBox.querySelector("button"),
    words = ["灵感", "审美", "方法"];
  let wi = 0,
    wordTimer;
  const wordWidth = spring(
    30,
    MOTION.wordWidth,
    (x) => (slot.style.width = x + "px"),
  );
  function rollWord(first = false) {
    clearTimeout(wordTimer);
    const old = slot.querySelector(".word-live");
    if (old) {
      old.classList.remove("word-live");
      [...old.children].forEach((l, i) => {
        const s = spring(0, MOTION.wordLetter, (x) => {
          l.style.transform = `translateY(${x * 105}%)`;
          l.style.opacity = Math.max(0, 1 - Math.abs(x) * 0.9);
        });
        setTimeout(() => s.set(-1), i * 22);
      });
      setTimeout(() => old.remove(), 1000);
    }
    const word = words[wi++ % words.length],
      row = document.createElement("span");
    row.className = "rolling-word word-live";
    for (const [i, ch] of [...word].entries()) {
      const letter = document.createElement("span");
      letter.textContent = ch;
      row.append(letter);
      const s = spring(first ? 0 : 1, MOTION.wordLetter, (x) => {
        letter.style.transform = `translateY(${x * 105}%)`;
        letter.style.opacity = Math.max(0, 1 - Math.abs(x) * 0.9);
      });
      if (!first) setTimeout(() => s.set(0), 60 + i * 28);
    }
    slot.append(row);
    wordWidth.set(row.offsetWidth);
    wordButton.setAttribute("aria-label", "积累" + word);
    wordTimer = setTimeout(() => rollWord(), 2400);
  }
  rollWord(true);
  // Sidebar highlight follows the selected row on its own spring.
  const highlight = document.createElement("span");
  highlight.className = "sidebar-highlight";
  $("#navigation").prepend(highlight);
  let y0 = 0;
  const Y = spring(
    0,
    MOTION.highlight,
    (x) => (highlight.style.transform = `translateY(${x}px)`),
  );
  function rollLabel(button) {
    const label = button.querySelector(".nav-label");
    if (!label || label.dataset.rolled) return;
    const text = label.textContent;
    label.dataset.rolled = "true";
    label.dataset.text = text;
    label.textContent = "";
    label.setAttribute("aria-hidden", "true");
    const letters = [...text].map((ch) => {
      const c = document.createElement("span");
      c.className = "nav-roll-letter";
      c.innerHTML = "<span><i></i><i></i></span>";
      c.querySelectorAll("i").forEach((i) => (i.textContent = ch));
      label.append(c);
      const inner = c.firstChild;
      return spring(
        0,
        MOTION.rollLink,
        (x) => (inner.style.transform = `translateY(${-50 * x}%)`),
      );
    });
    let over = false;
    const roll = (on) => {
      over = on;
      letters.forEach((s, i) =>
        setTimeout(() => {
          if (over === on) s.set(on ? 1 : 0);
        }, i * 30),
      );
    };
    button.addEventListener("pointerenter", () => roll(true));
    button.addEventListener("pointerleave", () => roll(false));
    button.addEventListener("focus", () => roll(true));
    button.addEventListener("blur", () => roll(false));
  }
  const nav = $("#navigation");
  function decorateNav() {
    if (!highlight.isConnected) nav.prepend(highlight);
    nav.querySelectorAll("[data-view]").forEach((b) => {
      const key = b.dataset.view,
        label = b.querySelector("span:nth-child(2)");
      if (label) label.classList.add("nav-label");
      const first = b.querySelector("span:first-child");
      if (first && !first.classList.contains("nav-label"))
        first.innerHTML = icon(navigationIcons[key] || "grid");
      b.setAttribute(
        "aria-label",
        b.querySelector(".nav-label")?.dataset.text ||
          b.querySelector(".nav-label")?.textContent ||
          key,
      );
      rollLabel(b);
    });
    if (compact)
      nav
        .querySelectorAll(".nav-label")
        .forEach((l) => (l.style.opacity = "0"));
  }

  function positionNavHighlight() {
    const active = nav.querySelector("[data-view].active");
    if (active) {
      highlight.style.height = active.offsetHeight + "px";
      Y.set(active.offsetTop);
      if (!y0) {
        Y.jump(active.offsetTop);
        y0 = 1;
      }
    }
  }
  new MutationObserver((changes) => {
    if (changes.some(change => change.type === "childList" && change.target === nav)) {
      decorateNav();
      positionNavHighlight();
    } else if (changes.some(change => change.type === "attributes")) {
      positionNavHighlight();
    }
  }).observe(nav, {
    childList: true, subtree: true, attributeFilter: ["aria-current"],
  });
  decorateNav();
  positionNavHighlight();

  const search = installWorkspaceSearch({ onMissingSearch });
  const focusSearch = search.focus;
  const setDockPage = installWorkspaceDock($(".topbar"), {
    dockActions, initialDockAction, initialBreadcrumb, focusSearch, captureDialog,
  });
  if (setTheme || backupControls) installSettings({ setTheme, backupControls });
  document.addEventListener(
    "keydown",
    (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopImmediatePropagation();
        focusSearch();
      }
      if (openCapture && e.key.toLowerCase() === "j") {
        e.preventDefault();
        openCapture();
      }
    },
    true,
  );
  function decorateInputs() {
    search.refresh();
    document
      .querySelectorAll(
        "input:not([type=file]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select",
      )
      .forEach((input) => {
        input.classList.add("command-field");
        if (input.dataset.pressBound) return;
        input.dataset.pressBound = "true";
        const p = spring(1, MOTION.commandPress, (x) =>
          input.style.setProperty("--field-scale", x),
        );
        input.addEventListener("pointerdown", () => {
          if (document.activeElement !== input) p.set(0.995);
        });
        for (const type of ["pointerup", "pointercancel", "blur"])
          input.addEventListener(type, () => p.set(1));
      });
  }
  // Copy Button port; animate only after the real clipboard write succeeds.
  function decorateCopies() {
    document.querySelectorAll("button").forEach((b) => {
      if (
        b.dataset.copyUi ||
        b.hasAttribute("data-open-component") ||
        !/^复制/.test(b.textContent.trim())
      )
        return;
      const label = b.textContent.trim();
      b.dataset.copyUi = "true";
      b.setAttribute("aria-label", label);
      b.classList.add("animated-copy");
      b.innerHTML =
        '<span class="copy-icons"><span class="copy-original">' +
        icon("copy") +
        '</span><span class="copy-success">' +
        icon("check") +
        '</span></span><span class="copy-roll"><span><i></i><i>已复制</i></span></span>';
      b.querySelector(".copy-roll i").textContent = label;
      b.addEventListener("pointerdown", () => (activeCopy = b));
      b.addEventListener("click", () => (activeCopy = b));
    });
  }
  function copyFeedback(button) {
    if (!button?.isConnected || !button.matches(".animated-copy")) return;
    const roll = button.querySelector(".copy-roll"),
      words = roll.firstChild,
      [a, b] = words.children,
      width = spring(
        a.scrollWidth,
        MOTION.copyWidth,
        (x) => (roll.style.width = Math.max(0, x) + "px"),
      ),
      r = spring(
        0,
        MOTION.copyRoll,
        (x) => (words.style.transform = `translateY(${-20 * x}px)`),
      ),
      i = spring(0, MOTION.copyIcon, (x) => {
        const clamp = (v) => Math.max(0, Math.min(1, v)),
          c = button.querySelector(".copy-original"),
          ok = button.querySelector(".copy-success");
        c.style.opacity = clamp(1 - x * 1.6);
        c.style.transform = `scale(${1 - 0.5 * clamp(x)}) rotate(${-40 * clamp(x)}deg)`;
        ok.style.opacity = clamp(x * 1.6 - 0.4);
        ok.style.transform = `scale(${0.4 + 0.6 * x})`;
      });
    r.set(1);
    i.set(1);
    width.set(b.scrollWidth);
    setTimeout(() => {
      r.set(0);
      i.set(0);
      width.set(a.scrollWidth);
    }, 1800);
  }
  document.addEventListener("ilia:copied", () => copyFeedback(activeCopy));
  function iconButtons() {
    document
      .querySelectorAll(
        "[data-site-add],[data-site-edit],[data-site-delete],.star,[data-remove-case],#close-editor,.dialog-heading>button",
      )
      .forEach((b) => {
        const type = b.matches("[data-site-add]")
          ? "plus"
          : b.matches("[data-site-edit]")
            ? "edit"
            : b.matches("[data-site-delete],[data-remove-case]")
              ? "trash"
              : b.matches(".star")
                ? "heart"
                : "close";
        if (b.dataset.iconSet === type) return;
        b.dataset.iconSet = type;
        b.innerHTML = icon(type);
      });
    document.querySelectorAll("[data-layout]").forEach((b) => {
      if (b.dataset.iconSet) return;
      b.dataset.iconSet = "layout";
      b.innerHTML =
        icon(b.dataset.layout === "list" ? "list" : "grid") +
        (b.dataset.layout === "list" ? "列表" : "卡片");
    });
  }
  let scheduled = false;
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      decorateInputs();
      decorateClearInputs();
      decorateDropdowns();
      decorateCopies();
      iconButtons();
    });
  }
  new MutationObserver(refresh).observe(document.body, {
    childList: true,
    subtree: true,
  });
  refresh();
  return { refresh, focusSearch, setDockPage };
}

function installSettings({ setTheme, backupControls }) {
  // Stack Panel: push/pop pages, a 0.3 parallax and the source 0.42/0.38 timings.
  const bottom = $(".sidebar-bottom");
  const { exportButton, importLabel } = backupControls || {};
  bottom.replaceChildren();
  const settings = document.createElement("button");
  settings.id = "stack-settings";
  settings.innerHTML = icon("settings") + "<span>设置</span>";
  bottom.append(settings);
  const stack = document.createElement("div");
  stack.id = "settings-stack";
  stack.hidden = true;
  document.body.append(stack);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function markThemeChoices() {
    const theme = document.documentElement.dataset.theme;
    stack.querySelectorAll("[data-theme-choice]").forEach((button) => {
      const selected = button.dataset.themeChoice === theme;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  if (setTheme) new MutationObserver(markThemeChoices).observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"],
  });
  const stackFrames = (from, to, duration) => {
    const frames = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40,
        p =
          (1 - (1 + 9.233 * t) * Math.exp(-9.233 * t)) /
          (1 - (1 + 9.233) * Math.exp(-9.233));
      frames.push({
        transform: `translateX(${from + (to - from) * p}px)`,
        offset: t,
      });
    }
    return { frames, options: { duration, fill: "forwards" } };
  };
  let stackPage = "root";
  function renderStack(page = "root", back = false) {
    const previous = stack.querySelector(".stack-content:last-child");
    stack.querySelectorAll(".stack-content").forEach((el) => {
      if (el !== previous) el.remove();
    });
    const title = { root: "设置", backup: "备份", theme: "外观" }[page];
    stackPage = page;
    const body = document.createElement("section");
    body.className = "stack-content";
    if (page === "root")
      body.innerHTML =
        (backupControls
          ? '<button data-stack="backup">备份' + icon("right") + "</button>"
          : "") +
        (setTheme
          ? '<button data-stack="theme">外观' + icon("right") + "</button>"
          : "");
    if (page === "backup") {
      exportButton.innerHTML = icon("download") + "<span>导出备份</span>";
      importLabel.firstChild.textContent = "导入备份";
      body.append(exportButton, importLabel);
    }
    if (page === "theme")
      body.innerHTML =
        '<button data-theme-choice="light">白色' +
        icon("check") +
        '</button><button data-theme-choice="dark">黑色' +
        icon("check") +
        "</button>";
    if (!stack.querySelector(".stack-heading"))
      stack.innerHTML =
        '<div class="stack-heading"><button id="stack-back" aria-label="返回">' +
        icon("left") +
        '</button><h3></h3><button id="stack-close" aria-label="关闭设置">' +
        icon("close") +
        '</button></div><div class="stack-body"></div>';
    const container = stack.querySelector(".stack-body");
    container.append(body);
    stack.querySelector("h3").textContent = title;
    stack.querySelector("#stack-back").hidden = page === "root";
    if (previous && reduceMotion.matches) previous.remove();
    else if (previous) {
      previous.inert = true;
      previous.style.position = "absolute";
      previous.style.inset = "0";
      const width = container.clientWidth,
        move = stackFrames(back ? -width * 0.3 : width, 0, back ? 340 : 420);
      body.animate(move.frames, move.options);
      const under = stackFrames(
        0,
        back ? width : -width * 0.3,
        back ? 340 : 420,
      );
      previous
        .animate(under.frames, under.options)
        .finished.then(() => previous.remove());
    }
    container.style.height = body.offsetHeight + "px";
    stack.querySelector("#stack-back").onclick = () =>
      renderStack("root", true);
    stack.querySelector("#stack-close").onclick = () => (stack.hidden = true);
    body
      .querySelectorAll("[data-stack]")
      .forEach((b) => (b.onclick = () => renderStack(b.dataset.stack)));
    body.querySelectorAll("[data-theme-choice]").forEach((b) => {
      b.onclick = () => setTheme(b.dataset.themeChoice);
    });
    markThemeChoices();
  }
  settings.onclick = () => {
    stack.hidden = !stack.hidden;
    if (!stack.hidden) renderStack("root");
  };
  stack.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (stackPage !== "root") renderStack("root", true);
      else stack.hidden = true;
    }
  });
}
