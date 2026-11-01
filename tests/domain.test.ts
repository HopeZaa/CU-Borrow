import { describe, it, expect } from "vitest";
import {
  quote,
  bookingSchema,
  itemSchema,
  safeNext,
  validImage,
  isUnavailable,
  dateSchema,
} from "../lib/domain";
describe("rental dates and quotes", () => {
  it("charges inclusive days and handles cents", () =>
    expect(quote(100.5, 1000, "2026-11-01", "2026-11-02")).toEqual({
      days: 2,
      rental: 201,
      deposit: 1000,
      total: 1201,
    }));
  it("rejects reversed and excessive ranges", () => {
    expect(quote(1, 0, "2026-11-03", "2026-11-01")).toBeNull();
    expect(quote(1, 0, "2026-01-01", "2027-01-02")).toBeNull();
  });
  it("validates real calendar dates", () => {
    expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateSchema.safeParse("2028-02-29").success).toBe(true);
  });
  it("requires UUIDs and ordered dates", () =>
    expect(
      bookingSchema.safeParse({
        item_id: "bad",
        start_date: "2026-11-02",
        end_date: "2026-11-01",
      }).success,
    ).toBe(false));
  it("uses inclusive blackout boundaries", () => {
    expect(
      isUnavailable("2026-11-01", "2026-11-03", [
        { start_date: "2026-11-03", end_date: "2026-11-05" },
      ]),
    ).toBe(true);
    expect(
      isUnavailable("2026-11-06", "2026-11-07", [
        { start_date: "2026-11-03", end_date: "2026-11-05" },
      ]),
    ).toBe(false);
  });
});
describe("security validation", () => {
  it("blocks open redirects and backslashes", () => {
    for (const s of [
      "https://evil.invalid",
      "//evil.invalid",
      "/\\evil.invalid",
      "/\n/evil.invalid",
    ])
      expect(safeNext(s)).toBe("/marketplace");
    expect(safeNext("/bookings")).toBe("/bookings");
  });
  it("checks magic bytes rather than just a filename or MIME", () => {
    expect(validImage(new Uint8Array([255, 216, 255]), "image/jpeg")).toBe(
      true,
    );
    expect(validImage(new TextEncoder().encode("<script>"), "image/jpeg")).toBe(
      false,
    );
    expect(
      validImage(new TextEncoder().encode("<svg/>"), "image/svg+xml"),
    ).toBe(false);
  });
  it("validates listing prices, category and ranges", () =>
    expect(
      itemSchema.safeParse({
        title: "Camera",
        description: "Camera in good working condition",
        category: "camera",
        condition: "good",
        daily_price: -1,
        deposit: 0,
        pickup_location: "Campus",
        available_from: "2026-11-01",
        available_until: "2026-11-02",
      }).success,
    ).toBe(false));
});
