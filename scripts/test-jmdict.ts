import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testJMdict() {
  console.log("Testing JMdict query...");
  
  // Test with "日本" (Japan)
  const { data, error } = await supabase
    .from("jmdict_entries")
    .select("*")
    .contains("kanji_elements", ["日本"])
    .limit(5);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Found ${data.length} entries for "日本":`);
    data.forEach((entry: any) => {
      console.log(`- ${entry.kanji_elements.join(", ")} (${entry.reading_elements.join(", ")})`);
      if (entry.senses_json) {
        const senses = Array.isArray(entry.senses_json) ? entry.senses_json : [entry.senses_json];
        senses.forEach((sense: any) => {
          if (sense.glosses) {
            const glosses = Array.isArray(sense.glosses) ? sense.glosses : [sense.glosses];
            glosses.forEach((g: any) => {
              console.log(`  ${g.lang || "en"}: ${g.text}`);
            });
          }
        });
      }
    });
  }
  
  // Test with "にほん" (nihon - reading)
  console.log("\nTesting with reading 'にほん'...");
  const { data: data2, error: error2 } = await supabase
    .from("jmdict_entries")
    .select("*")
    .contains("reading_elements", ["にほん"])
    .limit(5);
  
  if (error2) {
    console.error("Error:", error2);
  } else {
    console.log(`Found ${data2.length} entries for "にほん":`);
    data2.forEach((entry: any) => {
      console.log(`- ${entry.kanji_elements.join(", ")} (${entry.reading_elements.join(", ")})`);
    });
  }
  
  // Test with "cat" (猫)
  console.log("\nTesting with '猫'...");
  const { data: data3, error: error3 } = await supabase
    .from("jmdict_entries")
    .select("*")
    .contains("kanji_elements", ["猫"])
    .limit(5);
  
  if (error3) {
    console.error("Error:", error3);
  } else {
    console.log(`Found ${data3.length} entries for "猫":`);
    data3.forEach((entry: any) => {
      console.log(`- ${entry.kanji_elements.join(", ")} (${entry.reading_elements.join(", ")})`);
      if (entry.senses_json) {
        const senses = Array.isArray(entry.senses_json) ? entry.senses_json : [entry.senses_json];
        senses.forEach((sense: any) => {
          if (sense.glosses) {
            const glosses = Array.isArray(sense.glosses) ? sense.glosses : [sense.glosses];
            glosses.forEach((g: any) => {
              console.log(`  ${g.lang || "en"}: ${g.text}`);
            });
          }
        });
      }
    });
  }
}

testJMdict().catch(console.error);
