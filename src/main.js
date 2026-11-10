import { installReadingPage } from "./ui/reading-page.js";
import { installStage } from "./ui/stage.js";
import appManifest from "../package.json";
import { installAnnotations } from "./charts/annotations.js";
import { selectionTransition } from "./core/selection.js";
import { installSelection } from "./ui/selection.js";
import { installResearch } from "./ui/research.js";
import { installSavedViews } from "./ui/saved-views.js";
import { installSearch } from "./ui/search.js";
import { installOutliers } from "./ui/outliers.js";
import { installDownloads } from "./ui/downloads.js";
import { installTheme } from "./ui/theme.js";
import { installProductPage } from "./ui/product-page.js";
import { installLanguage } from "./ui/language.js";
import { install as service0 } from "./geography/map.js";
import { install as service1 } from "./data/selectors.js";
import { install as service2 } from "./data/derived.js";
import { install as service3 } from "./charts/ternary.js";
import { install as service4 } from "./charts/small-maps.js";
import { install as service5 } from "./charts/units.js";
import { install as service6 } from "./charts/beeswarm.js";
import * as d3 from "./vendor-d3.js";
import * as topojson from "topojson-client";
import { createScheduler } from "./core/dispatcher.js";
import { createContext } from "./core/context.js";
import * as metrics from "./data/metrics.js";
import { cameraFromRoute } from "./core/router.js";
import { loadJSON } from "./data/loaders.js";
import { installLazyFeatures } from "./features/lazy.js";
import "./styles/tokens.css";
import "./styles/style.css";
import "./styles/workbench.css";
import "./styles/system.css";
import "./styles/views-finish.css";
import "./styles/reading-page.css";
import "./styles/workspace-panels.css";
import "./styles/stage.css";
import "./styles/night.css";
import "./styles/product.css";
import { installWorkspace } from "./ui/workspace.js";
import { install as install0 } from "./modules/views.js";
import { install as install1 } from "./modules/app.js";
import { install as install2 } from "./modules/workbench.js";
import { install as install3 } from "./modules/navigation.js";
import { install as install4 } from "./modules/analysis.js";
import { install as install5 } from "./modules/parliament.js";
import { install as install6 } from "./modules/export.js";
import { install as install7 } from "./modules/statistics.js";
import { install as install8 } from "./modules/contribution.js";
import { install as install9 } from "./ui/region-list.js";
import { install as install10 } from "./modules/sources.js";
import { install as install11 } from "./modules/chart-settings.js";
import { install as install12 } from "./ui/accessibility.js";
import { install as install13 } from "./modules/districts.js";
import { install as install14 } from "./ui/toolbar.js";
import { install as install15 } from "./modules/spatial-metrics.js";
const ctx = createContext({
  applicationVersion: appManifest.version,
  d3,
  topojson,
  loadJSON,
  metrics,
  cameraFromRoute,
  createScheduler,
  selectionTransition,
});
const publicHomepage = document.documentElement.dataset.page === "home";
installTheme();
installLazyFeatures(ctx);
install0(ctx);
install1(ctx);
install2(ctx);
install3(ctx);
install4(ctx);
install5(ctx);
install6(ctx);
install7(ctx);
if (publicHomepage) await new Promise((resume) => setTimeout(resume, 0));
install8(ctx);
install9(ctx);
install10(ctx);
install11(ctx);
install12(ctx);
install13(ctx);
install14(ctx);
install15(ctx);
service0(ctx);
service1(ctx);
service2(ctx);
service3(ctx);
service4(ctx);
service5(ctx);
service6(ctx);
ctx.mountLazyLaunchers();
installAnnotations(ctx);
installWorkspace(ctx);
installStage(ctx);
installReadingPage(ctx);
installSelection(ctx);
installResearch(ctx);
installSavedViews(ctx);
installSearch(ctx);
installOutliers(ctx);
installDownloads(ctx);
installProductPage(ctx);
installLanguage(ctx);
if (document.documentElement.dataset.page !== "legacy")
  import("./ui/knowledge.js").then(({ installKnowledge }) => installKnowledge(ctx));
if (document.documentElement.dataset.page !== "about") {
  await ctx.ensureRouteFeatures();
  await ctx.init();
  if (document.documentElement.dataset.mode === "filter" && ctx.data && !ctx.isLeg() && ctx.$("#groups-panel").hidden)
    ctx.setConditionsOpen(true);
}
delete document.documentElement.dataset.bootLayout;
ctx.store.commit();
if (new URLSearchParams(location.search).get("qa") === "release")
  import("./features/qa.js").then((m) => m.install(ctx));
