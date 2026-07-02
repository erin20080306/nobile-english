import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from multiple possible locations
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Environment check:");
console.log("- NEXT_PUBLIC_SUPABASE_URL:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("- SUPABASE_URL:", !!process.env.SUPABASE_URL);
console.log("- SUPABASE_SERVICE_ROLE_KEY:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log("- NEXT_PUBLIC_SUPABASE_ANON_KEY:", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log("- Final supabaseUrl:", !!supabaseUrl);
console.log("- Final supabaseKey:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface JMdictEntry {
  ent_seq: number;
  k_ele?: Array<{
    keb: string;
    ke_pri?: string[];
  }>;
  r_ele?: Array<{
    reb: string;
    re_restr?: string[];
    re_pri?: string[];
  }>;
  sense?: Array<{
    pos?: string[];
    field?: string[];
    misc?: string[];
    gloss?: Array<{
      _text: string;
      xml_lang?: string;
    }>;
  }>;
}

interface JMDictRow {
  entry_seq: number;
  kanji_elements: string[];
  reading_elements: string[];
  readings_json: any;
  pos_tags: string[];
  fields: string[];
  misc_info: string[];
  senses_json: any;
  priority: number;
}

function calculatePriority(entry: JMdictEntry): number {
  let priority = 0;
  
  // Handle both array and single object cases
  const kEleArray = Array.isArray(entry.k_ele) ? entry.k_ele : (entry.k_ele ? [entry.k_ele] : []);
  const rEleArray = Array.isArray(entry.r_ele) ? entry.r_ele : (entry.r_ele ? [entry.r_ele] : []);
  
  // Check kanji priorities
  kEleArray.forEach(k => {
    const priArray = Array.isArray(k.ke_pri) ? k.ke_pri : (k.ke_pri ? [k.ke_pri] : []);
    priArray.forEach(p => {
      if (p === "news1" || p === "ichi1" || p === "spec1" || p === "gai1") priority += 10;
      if (p === "news2" || p === "ichi2" || p === "spec2" || p === "gai2") priority += 5;
    });
  });
  
  // Check reading priorities
  rEleArray.forEach(r => {
    const priArray = Array.isArray(r.re_pri) ? r.re_pri : (r.re_pri ? [r.re_pri] : []);
    priArray.forEach(p => {
      if (p === "news1" || p === "ichi1" || p === "spec1" || p === "gai1") priority += 10;
      if (p === "news2" || p === "ichi2" || p === "spec2" || p === "gai2") priority += 5;
    });
  });
  
  return priority;
}

function parseEntry(entry: JMdictEntry): JMDictRow | null {
  try {
    // Handle both array and single object cases
    const kEleArray = Array.isArray(entry.k_ele) ? entry.k_ele : (entry.k_ele ? [entry.k_ele] : []);
    const rEleArray = Array.isArray(entry.r_ele) ? entry.r_ele : (entry.r_ele ? [entry.r_ele] : []);
    const senseArray = Array.isArray(entry.sense) ? entry.sense : (entry.sense ? [entry.sense] : []);
    
    const kanjiElements = kEleArray.map(k => k.keb);
    const readingElements = rEleArray.map(r => r.reb);
    
    const readingsJson = rEleArray.map(r => ({
      reading: r.reb,
      restrictions: r.re_restr,
      priorities: r.re_pri,
    }));
    
    const posTags = new Set<string>();
    const fields = new Set<string>();
    const miscInfo = new Set<string>();
    
    senseArray.forEach(sense => {
      if (sense.pos) {
        const posArray = Array.isArray(sense.pos) ? sense.pos : [sense.pos];
        posArray.forEach(pos => posTags.add(pos));
      }
      if (sense.field) {
        const fieldArray = Array.isArray(sense.field) ? sense.field : [sense.field];
        fieldArray.forEach(field => fields.add(field));
      }
      if (sense.misc) {
        const miscArray = Array.isArray(sense.misc) ? sense.misc : [sense.misc];
        miscArray.forEach(misc => miscInfo.add(misc));
      }
    });
    
    const sensesJson = senseArray.map(sense => {
      const glossArray = Array.isArray(sense.gloss) ? sense.gloss : (sense.gloss !== undefined ? [sense.gloss] : []);
      return {
        pos: sense.pos,
        field: sense.field,
        misc: sense.misc,
        glosses: glossArray.map((g: any) => ({
          text: typeof g === "string" ? g : g._text,
          lang: typeof g === "string" ? "en" : (g.xml_lang || "en"),
        })),
      };
    });
    
    return {
      entry_seq: entry.ent_seq,
      kanji_elements: kanjiElements,
      reading_elements: readingElements,
      readings_json: readingsJson,
      pos_tags: Array.from(posTags),
      fields: Array.from(fields),
      misc_info: Array.from(miscInfo),
      senses_json: sensesJson,
      priority: calculatePriority(entry),
    };
  } catch (error) {
    console.error("Error parsing entry:", entry.ent_seq, error);
    return null;
  }
}

async function importJMdict(xmlFilePath: string) {
  console.log("Reading JMdict XML file...");
  const xmlContent = fs.readFileSync(xmlFilePath, "utf-8");
  
  console.log("Parsing XML...");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "_text",
    ignoreDeclaration: true,
    processEntities: false,
  });
  
  const result = parser.parse(xmlContent);
  const entries: JMdictEntry[] = result.JMdict.entry || [];
  
  console.log(`Found ${entries.length} entries`);
  
  const batchSize = 100;
  let imported = 0;
  let errors = 0;
  
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const rows = batch.map(parseEntry).filter((row): row is JMDictRow => row !== null);
    
    if (rows.length === 0) continue;
    
    try {
      const { error } = await supabase
        .from("jmdict_entries")
        .upsert(rows, { onConflict: "entry_seq" });
      
      if (error) {
        console.error(`Error importing batch ${i}-${i + batchSize}:`, error);
        errors++;
      } else {
        imported += rows.length;
        console.log(`Imported ${imported}/${entries.length} entries`);
      }
    } catch (err) {
      console.error(`Error in batch ${i}-${i + batchSize}:`, err);
      errors++;
    }
    
    // Small delay to avoid overwhelming the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\nImport complete:`);
  console.log(`- Imported: ${imported}`);
  console.log(`- Errors: ${errors}`);
  console.log(`- Total: ${entries.length}`);
}

const xmlPath = path.join(__dirname, "../JMdict_e");
importJMdict(xmlPath).catch(console.error);
