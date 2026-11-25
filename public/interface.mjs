import { installProjects } from "./projects.mjs";
import { installCollectionPages } from "./collection-pages.mjs";
import { installPageLibrary } from "./page-library.mjs";
import { installFontLibrary } from "./font-library.mjs";
import { installSourcesPage } from "./sources-page.mjs";
import { installHomePage } from "./home-page.mjs";
import { installWorkspaceChrome } from "./workspace-chrome.mjs";

export function installInterface(h, styleSeed) {
  let projects, pageLibrary, fontLibrary, sourcesPage, homePage;
  const collections = installCollectionPages(h, styleSeed);
  h.collections = collections;
  const oldLeave = h.leaveComponents;
  h.leaveCustom = () => {
    collections.leave();
    projects?.leave();
    pageLibrary?.leave();
    fontLibrary?.leave();
    sourcesPage?.leave();
    homePage?.leave();
    oldLeave();
  };
  h.route = (next) => {
    if (
      [
        "home",
        "projects",
        "components",
        "pages",
        "fonts",
        "sources",
        "accumulation",
        "styles",
        "aesthetic",
      ].includes(next)
    )
      document.querySelector("#inspector").replaceChildren();
    if (next === "home") {
      homePage.show();
      return true;
    }
    if (next === "projects") {
      projects.show();
      return true;
    }
    if (next === "components") {
      h.showComponents();
      return true;
    }
    if (next === "pages") {
      pageLibrary.show();
      return true;
    }
    if (next === "fonts") {
      fontLibrary.show();
      return true;
    }
    if (next === "sources") {
      sourcesPage.show();
      return true;
    }
    if (["accumulation", "styles", "aesthetic"].includes(next)) {
      collections.show(next);
      return true;
    }
    return false;
  };

  document
    .querySelector(".filterbar")
    .prepend(document.querySelector("#website-categories"));
  const openCapture = () => collections.openCapture();
  const { refresh, setDockPage } = installWorkspaceChrome({
    dockActions: [
      { id: "search", icon: "search", label: "搜索" },
      { id: "capture", icon: "plus", label: "随手收集", onSelect: openCapture },
      {
        id: "learn",
        icon: "book",
        label: "学习",
        onSelect: () => h.switchView("accumulation"),
      },
      {
        id: "components",
        icon: "grid",
        label: "组件库",
        onSelect: () => h.switchView("components"),
      },
    ],
    initialDockAction: "capture",
    openCapture,
    captureDialog: collections.captureDialog,
    setTheme: (theme) => h.setTheme(theme),
    backupControls: {
      exportButton: document.querySelector("#export"),
      importLabel: document.querySelector(".import-button"),
    },
  });
  document.addEventListener("ilia:view", (e) => {
    const value = e.detail;
    setDockPage(["accumulation", "learn"].includes(value) ? "learn" : value);
    document
      .querySelectorAll("#website-categories")
      .forEach(
        (el) => (el.hidden = !["all", "favorites", "cases"].includes(value)),
      );
  });
  projects = installProjects(h);
  pageLibrary = installPageLibrary(h);
  fontLibrary = installFontLibrary(h);
  sourcesPage = installSourcesPage(h);
  homePage = installHomePage(h);
  h.pageLibrary = pageLibrary;
  return {
    collections,
    projects,
    pageLibrary,
    fontLibrary,
    sourcesPage,
    homePage,
    refresh,
  };
}
