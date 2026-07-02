import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function grantPermissions() {
  console.log("Granting permissions...");
  
  // Grant SELECT to anon role
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: 'GRANT SELECT ON jmdict_entries TO anon;'
  });
  
  if (error1) {
    console.error("Error granting anon SELECT permissions:", error1);
  } else {
    console.log("✓ Granted anon SELECT permissions");
  }
  
  console.log("Done");
}

grantPermissions().catch(console.error);
