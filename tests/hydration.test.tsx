import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/actions", () => ({
  authAction: vi.fn(),
  itemAction: vi.fn(),
  bookingAction: vi.fn(),
}));
vi.mock("@/app/upload-actions", () => ({
  prepareUpload: vi.fn(),
  finishUpload: vi.fn(),
}));
import { AuthForm } from "../components/auth-form";
import { ItemForm } from "../components/item-form";
import { BookingForm } from "../components/booking-form";
import { UploadForm } from "../components/upload-form";
function protectedForm(html: string) {
  expect(html).toContain('method="post"');
  expect(html).toMatch(/<form[^>]*inert=""/);
  expect(html).toMatch(/<button[^>]*disabled=""/);
}
describe("forms before browser hydration", () => {
  it.each(["login", "signup", "forgot", "password"] as const)(
    "keeps %s credentials out of URL submissions",
    (mode) => protectedForm(renderToString(<AuthForm mode={mode} />)),
  );
  it("prevents an unhydrated listing from submitting", () =>
    protectedForm(renderToString(<ItemForm />)));
  it("prevents an unhydrated booking from submitting", () =>
    protectedForm(
      renderToString(
        <BookingForm
          id="0169c785-5588-4912-902d-ef6b80a0e99c"
          price={100}
          deposit={500}
          from="2026-11-01"
          until="2027-12-31"
          periods={[]}
          loggedIn
          isOwner={false}
        />,
      ),
    ));
  it("prevents a native upload request from bypassing the direct-upload handler", () =>
    protectedForm(
      renderToString(
        <UploadForm
          id="0169c785-5588-4912-902d-ef6b80a0e99c"
          target="item"
          label="อัปโหลดภาพ"
        />,
      ),
    ));
});
