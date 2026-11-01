import { describe, it, expect } from "vitest";
import { siteUrl } from "../lib/site";
describe("deployment URL", () => {
  it("uses the stable Vercel production domain", () =>
    expect(
      siteUrl({
        VERCEL: "1",
        VERCEL_PROJECT_PRODUCTION_URL: "cu-borrow-test.vercel.app",
      }),
    ).toBe("https://cu-borrow-test.vercel.app"));
  it("accepts an explicit production domain and removes paths", () =>
    expect(
      siteUrl({
        VERCEL: "1",
        NEXT_PUBLIC_SITE_URL: "https://borrow.example.com/",
      }),
    ).toBe("https://borrow.example.com"));
  it("rejects local and non-HTTPS production URLs", () => {
    for (const url of [
      "http://localhost:3000",
      "http://borrow.example.com",
      "javascript:alert(1)",
      "https://user:password@example.com",
    ])
      expect(() =>
        siteUrl({ VERCEL: "1", NEXT_PUBLIC_SITE_URL: url }),
      ).toThrow();
  });
  it("keeps local development usable", () =>
    expect(siteUrl({})).toBe("http://localhost:3000"));
});
