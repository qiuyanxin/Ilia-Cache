import { installFavorites } from "./favorites.mjs";
import { installProjects } from "./projects.mjs";
import { installCollectionPages } from "./collection-pages.mjs";
import { installPageLibrary } from "./page-library.mjs";
import { installFontLibrary } from "./font-library.mjs";
import { installSourcesPage } from "./sources-page.mjs";
import { installHomePage } from "./home-page.mjs";
import { installWorkspaceChrome } from "./workspace-chrome.mjs";

export function installInterface(h, styleSeed) {
  let projects, pageLibrary, fontLibrary, sourcesPage, homePage, favorites;
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
    favorites?.leave();
    oldLeave();
  };
  h.route = (next) => {
    if (
      [
        "home",
        "projects",
        "components",
        "sounds",
        "capture",
        "favorites",
        "pages",
        "fonts",
        "sources",
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
    if (next === "components" || next === "sounds") {
      h.showComponents(next === "sounds");
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
    if (next === "favorites") {
      favorites.show();
      return true;
    }
    if (["capture", "styles"].includes(next)) {
      collections.show(next);
      return true;
    }
    return false;
  };

  document
    .querySelector(".filterbar")
    .prepend(document.querySelector("#website-categories"));
  const openCapture = (options) => {
    if (options) return collections.openCapture(options);
    const section = location.hash.replace(/^#\//, "").split(/[/?]/)[0];
    if (section === "fonts") return fontLibrary?.add();
    if (section === "styles") return collections.openStyleForm();
    const expected = {
      components: "component",
      pages: "page",
      websites: "website",
    }[section];
    return collections.openCapture(expected ? { expected } : undefined);
  };
  h.openCapture = openCapture;
  const { refresh } = installWorkspaceChrome({
    dockActions: [
      { id: "search", icon: "search", label: "搜索" },
      { id: "capture", icon: "plus", label: "添加", onSelect: openCapture },
      {
        id: "favorites",
        icon: "heart",
        label: "收藏",
        onSelect: () => h.switchView("favorites"),
      },
      {
        id: "projects",
        icon: "folder",
        label: "工作台",
        onSelect: () => h.switchView("projects"),
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
  favorites = installFavorites(h, fontLibrary, pageLibrary);
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
