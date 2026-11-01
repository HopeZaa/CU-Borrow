import "server-only";
import { redirect } from "next/navigation";
import { configured, supabase } from "./supabase/server";
export async function currentUser() {
  if (!configured()) return null;
  const {
    data: { user },
  } = await (await supabase()).auth.getUser();
  return user;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  const { data, error } = await (await supabase()).rpc("cu_admin_me");
  if (error || data !== true) redirect("/marketplace");
  return user;
}
