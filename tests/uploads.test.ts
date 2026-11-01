import { describe, it, expect } from "vitest";
import {
  MAX_IMAGE_BYTES,
  uploadRequestSchema,
  ownedImagePath,
  imageBucket,
} from "../lib/uploads";
const owner = "b753d916-0a25-48e4-9841-3af9aa7672eb",
  id = "be8a3f22-3470-401a-9e19-68c2ba59b13c",
  file = "0169c785-5588-4912-902d-ef6b80a0e99c.png";
describe("direct Storage uploads", () => {
  it("accepts metadata for a 5 MB image without routing the binary through a Server Action", () =>
    expect(
      uploadRequestSchema.parse({
        target: "item",
        id,
        mime: "image/png",
        size: MAX_IMAGE_BYTES,
      }).size,
    ).toBe(MAX_IMAGE_BYTES));
  it("rejects empty, oversized or executable uploads", () => {
    for (const size of [0, MAX_IMAGE_BYTES + 1])
      expect(
        uploadRequestSchema.safeParse({
          target: "item",
          id,
          mime: "image/png",
          size,
        }).success,
      ).toBe(false);
    expect(
      uploadRequestSchema.safeParse({
        target: "item",
        id,
        mime: "image/svg+xml",
        size: 100,
      }).success,
    ).toBe(false);
  });
  it("binds paths to the authenticated owner, target and listing/booking", () => {
    expect(ownedImagePath(`${owner}/${id}/${file}`, owner, id, "item")).toBe(
      true,
    );
    expect(
      ownedImagePath(`${owner}/${id}/pickup/${file}`, owner, id, "pickup"),
    ).toBe(true);
    expect(
      ownedImagePath(`${owner}/${id}/pickup/${file}`, owner, id, "return"),
    ).toBe(false);
    expect(
      ownedImagePath(`another-user/${id}/${file}`, owner, id, "item"),
    ).toBe(false);
    expect(ownedImagePath(`${owner}/${id}/../${file}`, owner, id, "item")).toBe(
      false,
    );
    expect(
      ownedImagePath(`${owner}/${id}/arbitrary.html`, owner, id, "item"),
    ).toBe(false);
  });
  it("keeps handover evidence separate from public listing images", () => {
    expect(imageBucket("item")).toBe("item-images");
    expect(imageBucket("pickup")).toBe("handover-evidence");
    expect(imageBucket("return")).toBe("handover-evidence");
  });
});
