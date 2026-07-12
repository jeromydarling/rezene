import { describe, it, expect } from "vitest";
import { topoSortByParents } from "./topo";

/** Assert `parent` comes before `child` in the order. */
function before(order: string[], parent: string, child: string) {
  return order.indexOf(parent) < order.indexOf(child);
}

describe("topoSortByParents", () => {
  it("orders parents before children", () => {
    const names = ["order_items", "orders", "customers"];
    const parents = new Map([
      ["orders", new Set(["customers"])],
      ["order_items", new Set(["orders"])],
      ["customers", new Set<string>()],
    ]);
    const order = topoSortByParents(names, parents);
    expect(order).toHaveLength(3);
    expect(before(order, "customers", "orders")).toBe(true);
    expect(before(order, "orders", "order_items")).toBe(true);
  });

  it("returns every table exactly once even with no FKs", () => {
    const names = ["a", "b", "c"];
    const order = topoSortByParents(names, new Map());
    expect([...order].sort()).toEqual(["a", "b", "c"]);
  });

  it("terminates and covers all tables when a cycle exists", () => {
    // a <-> b cycle, plus an independent c.
    const names = ["a", "b", "c"];
    const parents = new Map([
      ["a", new Set(["b"])],
      ["b", new Set(["a"])],
      ["c", new Set<string>()],
    ]);
    const order = topoSortByParents(names, parents);
    expect([...order].sort()).toEqual(["a", "b", "c"]);
    // The acyclic node still resolves before the cyclic pair is force-appended.
    expect(order.indexOf("c")).toBeLessThan(order.length);
  });

  it("ignores a self-reference without dropping the table", () => {
    const names = ["nodes"];
    const parents = new Map([["nodes", new Set(["nodes"])]]);
    expect(topoSortByParents(names, parents)).toEqual(["nodes"]);
  });
});
