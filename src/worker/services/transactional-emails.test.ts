import { describe, expect, it } from "vitest";
import { shipmentEmail, returnEmail } from "./buyer-email";
import { DEFAULT_PALETTE } from "../../shared/brand-identity";
import type { EmailBrand } from "./email-template";

const brand: EmailBrand = { name: "Rezene", logoUrl: null, palette: DEFAULT_PALETTE };

describe("shipmentEmail", () => {
  it("shipped: subject + tracking CTA when a tracking URL is present", () => {
    const m = shipmentEmail("shipped", {
      brandName: "Rezene",
      orderNumber: "R-1042",
      carrier: "DHL",
      trackingNumber: "JD0123",
      trackingUrl: "https://track.dhl/JD0123",
      brand,
    });
    expect(m.subject).toContain("on its way");
    expect(m.text).toContain("R-1042");
    expect(m.text).toContain("https://track.dhl/JD0123");
    expect(m.html).toContain("Track your parcel");
    expect(m.html).toContain("https://track.dhl/JD0123");
  });

  it("shipped: no CTA when there is no tracking URL", () => {
    const m = shipmentEmail("shipped", { brandName: "Rezene", orderNumber: "R-1", brand });
    expect(m.html).not.toContain("Track your parcel");
  });

  it("delivered: distinct subject and no tracking CTA", () => {
    const m = shipmentEmail("delivered", {
      brandName: "Rezene",
      orderNumber: "R-9",
      trackingUrl: "https://track.dhl/x",
      brand,
    });
    expect(m.subject).toContain("delivered");
    expect(m.html).not.toContain("Track your parcel");
  });
});

describe("returnEmail", () => {
  it("refunded: shows the money only for the refunded state", () => {
    const m = returnEmail("refunded", {
      brandName: "Rezene",
      orderNumber: "R-5",
      refundAmountCents: 4200,
      currency: "USD",
      brand,
    });
    expect(m.subject).toContain("refund");
    expect(m.text).toContain("42.00 USD");
    expect(m.html).toContain("42.00 USD");
  });

  it("received: acknowledges without money", () => {
    const m = returnEmail("received", { brandName: "Rezene", orderNumber: "R-5" });
    expect(m.subject).toContain("received your return");
    expect(m.text).not.toContain("Refund:");
  });

  it("declined: explains and invites a reply", () => {
    const m = returnEmail("declined", { brandName: "Rezene", orderNumber: "R-5" });
    expect(m.subject).toContain("update on your return");
    expect(m.text.toLowerCase()).toContain("reply");
  });
});
