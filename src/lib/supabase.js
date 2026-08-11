import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://svdbqfbralxncbawrcib.supabase.co";

const supabaseKey =
  "sb_publishable_DBcu87iILQ2oFdotxOLy4w_K7V6oJjz";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);