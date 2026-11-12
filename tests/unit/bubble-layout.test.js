import { test, expect } from "vitest";
import { packVoteGroups } from "../../src/charts/bubble-layout.js";
const source = Array.from({ length: 73 }, (_, i) => ({
  key: String(i),
  radius: Math.sqrt((i + 1) / 73) * 70,
  r: { total: i + 1, candidates: [{ party: ["A", "B", "C"][i % 3] }] },
}));
test("party packing preserves all units, shared vote area and the input geometry", () => {
  const before = JSON.stringify(source),
    nodes = packVoteGroups(source, { x: 24, y: 180, width: 850, height: 370 }),
    k = nodes[0].radius ** 2 / nodes[0].r.total;
  expect(nodes).toHaveLength(73);
  expect(new Set(nodes.map((d) => d.key)).size).toBe(73);
  expect(JSON.stringify(source)).toBe(before);
  for (const d of nodes) expect(d.radius ** 2 / d.r.total).toBeCloseTo(k, 10);
});
test.each([400, 850, 1300])(
  "packing at width %i keeps circles inside the plot without overlaps",
  (width) => {
    const rect = { x: 24, y: 180, width, height: 370 },
      nodes = packVoteGroups(source, rect);
    for (const d of nodes) {
      expect(d.x - d.radius).toBeGreaterThanOrEqual(rect.x);
      expect(d.x + d.radius).toBeLessThanOrEqual(rect.x + rect.width);
      expect(d.y - d.radius).toBeGreaterThanOrEqual(rect.y + 34);
      expect(d.y + d.radius).toBeLessThanOrEqual(rect.y + rect.height);
    }
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y) + 1e-8).toBeGreaterThanOrEqual(
          a.radius + b.radius,
        );
      }
  },
);
test.each([400,850,1300])("one-group packing at %i keeps true areas and no overlaps", width => {
  const rect={x:24,y:180,width,height:370};
  const nodes=packVoteGroups(source,rect,{partition:false});
  const scale=nodes[0].radius**2/nodes[0].r.total;
  expect(new Set(nodes.map(d=>d.key)).size).toBe(source.length);
  for(const d of nodes){
    expect(d.radius**2/d.r.total).toBeCloseTo(scale,10);
    expect(d.x-d.radius).toBeGreaterThanOrEqual(rect.x);
    expect(d.x+d.radius).toBeLessThanOrEqual(rect.x+rect.width);
    expect(d.y-d.radius).toBeGreaterThanOrEqual(rect.y);
    expect(d.y+d.radius).toBeLessThanOrEqual(rect.y+rect.height);
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)
    expect(Math.hypot(nodes[i].x-nodes[j].x,nodes[i].y-nodes[j].y)+1e-8).toBeGreaterThanOrEqual(nodes[i].radius+nodes[j].radius);
});
