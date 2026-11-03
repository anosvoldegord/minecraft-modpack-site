import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://skrcqzlviycyagjvdohr.supabase.co";
const supabaseAnonKey = "sb_publishable_jj11WC_TrNBhjqr6IV7yng_ZhPG_rKY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);