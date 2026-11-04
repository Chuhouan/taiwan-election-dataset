import axe from "axe-core";
import { onCLS, onLCP, onINP } from "web-vitals";
export function install(ctx) {
  const report = {
    scope: "local controlled browser baseline; not real-user P75",
    vitals: {},
    audits: [],
  };
  document.body.insertAdjacentHTML(
    "beforeend",
    '<button id="qa-audit" style="position:fixed;bottom:4px;right:4px;z-index:50;background:#17202b;color:#fff;padding:5px 10px">檢查目前視圖</button><pre id="qa-report" hidden></pre>',
  );
  const publish = () => {
    document.querySelector("#qa-report").textContent = JSON.stringify({
      ...report,
      resources: performance
        .getEntriesByType("resource")
        .map((r) => ({
          name: r.name.split("/").at(-1),
          duration: r.duration,
          transferSize: r.transferSize,
        })),
    });
  };
  for (const [name, subscribe] of Object.entries({
    CLS: onCLS,
    LCP: onLCP,
    INP: onINP,
  }))
    subscribe(
      (value) => {
        report.vitals[name] = { value: value.value, rating: value.rating };
        publish();
      },
      { reportAllChanges: true },
    );
  document.querySelector("#qa-audit").onclick = async () => {
    const button = document.querySelector("#qa-audit");
    button.disabled = true;
    button.textContent = "檢查中…";
    try {
      report.beforeAuditVitals = structuredClone(report.vitals);
      const result = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      report.audits.push({
        url: location.href,
        chart: ctx.state.chart,
        dual: ctx.dualMode,
        violations: result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        passes: result.passes.length,
        incomplete: result.incomplete.map((v) => ({
          id: v.id,
          nodes: v.nodes.length,
        })),
      });
      button.textContent = result.violations.length
        ? "檢查：" + result.violations.length + "項"
        : "檢查通過";
    } catch (error) {
      report.error = String(error);
      button.textContent = "檢查失敗";
    } finally {
      button.disabled = false;
      publish();
    }
  };
  publish();
}
