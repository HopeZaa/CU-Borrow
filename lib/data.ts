import "server-only";
import { supabase, configured } from "./supabase/server";
import type { Item, OwnerStats, Profile } from "./domain";
export function imageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/item-images/${path}`;
}
export async function enrich(items: Item[]): Promise<Item[]> {
  if (!items.length) return [];
  const db = await supabase();
  const ids = items.map((i) => i.id),
    owners = Array.from(new Set(items.map((i) => i.owner_id)));
  const results = await Promise.all([
    db
      .from("item_images")
      .select("item_id,storage_path")
      .in("item_id", ids)
      .order("created_at"),
    db.from("profiles").select("*").in("id", owners),
    db.from("owner_stats").select("*").in("id", owners),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  const [images, profiles, stats] = results;
  return items.map((i) => ({
    ...i,
    item_images: images.data?.filter((x) => x.item_id === i.id),
    owner: profiles.data?.find((x) => x.id === i.owner_id) as Profile,
    stats: stats.data?.find((x) => x.id === i.owner_id) as OwnerStats,
  }));
}
export async function catalog(
  filters: Record<string, string | undefined> = {},
) {
  if (!configured()) return [];
  const { data, error } = await (
    await supabase()
  ).rpc("cu_search", {
    p_query: filters.q || "",
    p_category: filters.category || "",
    p_min: Number(filters.min) || 0,
    p_max: filters.max ? Number(filters.max) : 100000,
    p_start: filters.start || null,
    p_end: filters.end || null,
    p_sort: filters.sort || "newest",
  });
  if (error) throw new Error(error.message);
  return enrich((data || []) as Item[]);
}
