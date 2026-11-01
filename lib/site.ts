// Use deployment configuration rather than client-controlled request headers.
export function siteUrl(env: Record<string, string | undefined> = process.env) {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  const automatic = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const value =
    configured ||
    (automatic ? `https://${automatic}` : "http://localhost:3000");
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("ตั้งค่า URL ของเว็บไซต์ไม่ถูกต้อง");
  if (
    env.VERCEL === "1" &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("Production ต้องตั้งค่าโดเมน HTTPS ของเว็บไซต์");
  return url.origin;
}
