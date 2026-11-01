import { describe, it, expect } from "vitest";
import {
  adminTables,
  adminTableSchema,
  adminFieldValue,
  changedAdminFields,
} from "@/lib/admin";
describe("admin data validation", () => {
  it("rejects unregistered tables and enums", () => {
    expect(() => adminTableSchema.parse("auth.users")).toThrow();
    expect(() => adminTableSchema.parse("__proto__")).toThrow();
    expect(() =>
      adminFieldValue(
        adminTables.items.fields.find((f) => f.key === "status")!,
        "injected",
      ),
    ).toThrow();
  });
  it("builds only changed fields with concurrency preconditions", () => {
    const original = { rating: 5, comment: "Great rental" };
    const form = new FormData();
    form.set("rating", "5");
    form.set("comment", "Updated review");
    expect(changedAdminFields("reviews", form, original)).toEqual({
      patch: { comment: "Updated review" },
      expected: { comment: "Great rental" },
    });
  });
  it("normalizes numeric strings and rejects nonfinite values", () => {
    const f = adminTables.reviews.fields[0];
    expect(adminFieldValue(f, "4")).toBe(4);
    expect(() => adminFieldValue(f, "Infinity")).toThrow();
    expect(() => adminFieldValue(f, "")).toThrow();
  });
  it("requires explicit timezone for audit-sensitive timestamps", () => {
    const f = adminTables.handovers.fields[1];
    expect(() => adminFieldValue(f, "2026-11-02T12:00")).toThrow();
    expect(adminFieldValue(f, "2026-11-02T12:00:00+07:00")).toBe(
      "2026-11-02T05:00:00.000Z",
    );
  });
});
