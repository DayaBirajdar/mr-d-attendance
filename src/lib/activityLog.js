import { supabase } from "./supabase";

export async function logActivity({
  module,
  action,
  title,
  details = null,
  actor = "Daya Birajdar",
}) {
  try {
    const { error } = await supabase
      .from("activity_log")
      .insert([
        {
          module,
          action,
          title,
          details,
          actor,
        },
      ]);

    if (error) {
      console.error(
        "Activity Log Error:",
        error
      );
    }
  } catch (error) {
    console.error(
      "Activity Log Error:",
      error
    );
  }
}
