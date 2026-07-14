import { describe, it, expect } from "vitest";
import { rollupStatus } from "./lookbook-print";

describe("print order status rollup", () => {
  it("stays 'submitted' until every submitted copy has shipped", () => {
    expect(rollupStatus([])).toBe("submitted");
    expect(rollupStatus([{ lulu_job_id: "1", lulu_status: "IN_PRODUCTION" }])).toBe("submitted");
    expect(
      rollupStatus([
        { lulu_job_id: "1", lulu_status: "SHIPPED" },
        { lulu_job_id: "2", lulu_status: "IN_PRODUCTION" },
      ]),
    ).toBe("submitted");
  });

  it("is 'shipped' only when all submitted recipients have shipped", () => {
    expect(
      rollupStatus([
        { lulu_job_id: "1", lulu_status: "SHIPPED" },
        { lulu_job_id: "2", lulu_status: "SHIPPED" },
      ]),
    ).toBe("shipped");
    // A recipient that never got a Lulu job (e.g. bad address) doesn't block shipping.
    expect(
      rollupStatus([
        { lulu_job_id: "1", lulu_status: "SHIPPED" },
        { lulu_job_id: null, lulu_status: null },
      ]),
    ).toBe("shipped");
  });
});
