import { z } from "zod";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const uploadTargetSchema = z.enum(["item", "pickup", "return"]);
export const imageMimeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const uploadRequestSchema = z.object({
  target: uploadTargetSchema,
  id: z.string().uuid(),
  mime: imageMimeSchema,
  size: z.coerce.number<number>().int().min(1).max(MAX_IMAGE_BYTES),
});
export type UploadTarget = z.infer<typeof uploadTargetSchema>;
export type UploadTicket = {
  path: string;
  token: string;
  bucket: "item-images" | "handover-evidence";
};
export function imageBucket(target: UploadTarget) {
  return target === "item" ? "item-images" : "handover-evidence";
}
export function imagePrefix(userId: string, id: string, target: UploadTarget) {
  return `${userId}/${id}/${target === "item" ? "" : `${target}/`}`;
}
export function ownedImagePath(
  path: string,
  userId: string,
  id: string,
  target: UploadTarget,
) {
  const prefix = imagePrefix(userId, id, target);
  return (
    path.startsWith(prefix) &&
    /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path.slice(prefix.length))
  );
}
