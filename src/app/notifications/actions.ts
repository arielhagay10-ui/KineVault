"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(data: FormData) {
  const id = z.uuid().safeParse(data.get("notificationId"));
  if (!id.success) throw new Error("Invalid notification");
  if (!await getIdentity()) redirect("/sign-in?next=/notifications");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: id.data });
  if (error) throw new Error("The update could not be marked as read");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}
