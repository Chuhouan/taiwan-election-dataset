# UI 渲染调度

`dist/app.js` 中只有一个 `updateUI()` 入口，按以下顺序执行命名阶段。各阶段不再捕获并覆盖上一层 `updateUI`。

1. `hydrateRoute`：只在首次初始化时恢复链接；浏览器历史导航另由 `restoreRoute` 调用解析。
2. `normalizeWorkbenchState`：检查当前选举兼容性、地区及集合。
3. `prepareAnalysisState`：识别空集合；空结果由 `renderEmptyAnalysis` 呈现。
4. `renderPrimaryUI`、`presentWorkbench`、`presentAnalysis`：数据图形、范围、统计发现及分析控件。
5. `presentParliament`、`presentParliamentDetail`：113席／73席、类别聚焦及名单详情。
6. `presentAccessibility`、`updateDistrictGeometry`、`presentControls`：操作状态、选区图和工具分级。
7. 方向键焦点整理、状态链接写入及渲染测量。

同步重入请求合并至下一次微任务，避免在尚未完成的阶段中重新进入全部绘制。`body[data-render-epoch]` 与 `data-render-ms` 仅用于测量，不显示在产品界面。

`drawScatter` 同样改为单一入口：工具准备 → 图形类型分派 → 统计参考 → 密度与专属编码 → 无资料纹理。地理重绘和路由解析仍有旧模块包装；后续继续迁移，未宣称全部状态和绘图逻辑已经重构完毕。数字回归、空集合、条件样例和完整113席已通过浏览器复测。


路由同样集中于navigation.js：一次解析URLSearchParams后，依次调用分析、议席、统计、比较、地区排序、图表和村里模块的具名解析函数；序列化按同样的明确职责写入一个参数对象。CSV导出由统一download入口选择区域结果或完整议席列表。验收禁止updateUI、drawScatter、parseRoute、routeString、download、updateHash被函数赋值再次覆盖。


地区详情现由renderDetailStable明确调用renderDetail、decorateDetailPresentation和presentDistrictSources，不再覆盖renderDetail。窗口与停靠面板通过scheduleCanvasReflow → reflowWorkbenchCanvas统一重算布局，按尺寸签名合并重排；空筛选重新走明确的空状态分支。DOM上的data-layout-ready仅用于验收等待，不是产品界面。
新增历史县市、多尺度和票席模块只提供具名路由钩子，没有新增核心函数覆盖。县市分类色统一使用countyColorScale，避免循环色带首尾重复。仍保留部分地图、选区及旧事件装饰器，未宣称已经完全转换为独立ES模块。

11月3日：`buildMap`取消导航、清单、纹理、选区、键盘模块的五层覆盖，改为单一具名入口：清除LOD签名 → `buildBaseMap` → `restoreMapViewport` → `wireMapListHover` → 无资料纹理 → 选区几何 → 下一帧键盘／高亮。回归禁止再次给`buildMap`赋函数。标签和部分旧交互装饰器仍在，继续迁移，不以这一步代表全部重构完成。

`updateLabels`也取消三层覆盖：先重置文本变换与离岛标题透明度，再依次执行`updateCartographicLabels`、`updateMapLOD`与`updateDistrictLabels`。移除旧版本重复计算、随后又被重算的标签避让步骤。

11月3日后续：剩余核心覆盖也迁移完毕。scoped／overviewRecords在主体处理空筛选，listRecords与sortRecords单一定义；renderDrawer明确分为基础容器、比较工作台、比较下载；renderFinding分为基础发现与当前图表发现；wireChart分为事件主体与列表联动；tooltip、行政区／选区缩放、区域／完整议席均具名分派。当前应用脚本扫描没有裸全局函数赋值覆盖。仍使用静态脚本及模块状态对象，并不声称已转换成ES模块或框架应用。
国会资料由loadParliamentData共享Promise缓存，只在完整113席或票席分析需要时载入；总统首页不载入。
