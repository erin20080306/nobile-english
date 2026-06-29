import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SQLITE_SCHEMA, SQLITE_INITIAL_DATA } from '@/data/sqliteSchema';
import { vocabulary } from '@/data/vocabulary';

export class SQLiteService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create database connection
      this.db = await this.sqlite.createConnection(
        'mobile_english_db',
        false,
        'no-encryption',
        1,
        false
      );

      // Open database
      await this.db.open();

      // Create schema
      await this.createSchema();

      // Import existing vocabulary
      await this.importExistingVocabulary();

      // Initialize metadata
      await this.initializeMetadata();

      this.isInitialized = true;
      console.log('SQLite database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create all tables
    for (const [tableName, schema] of Object.entries(SQLITE_SCHEMA)) {
      if (tableName === 'indexes') continue; // Skip indexes, handle separately

      try {
        if (typeof schema === 'string') {
          await this.db.run(schema);
        }
        console.log(`Created table: ${tableName}`);
      } catch (error) {
        console.error(`Failed to create table ${tableName}:`, error);
      }
    }

    // Create indexes
    if (SQLITE_SCHEMA.indexes) {
      for (const indexSql of SQLITE_SCHEMA.indexes) {
        try {
          await this.db.run(indexSql);
        } catch (error) {
          console.error('Failed to create index:', error);
        }
      }
    }
  }

  private async importExistingVocabulary(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Check if vocabulary already imported
    const metadata = await this.getMetadata('vocabulary_imported');
    if (metadata === 'true') {
      console.log('Vocabulary already imported, skipping');
      return;
    }

    console.log('Importing existing vocabulary...');

    // Import vocabulary from src/data/vocabulary.ts
    for (const word of vocabulary) {
      try {
        const id = `local_${word.word.toLowerCase()}`;
        const now = new Date().toISOString();

        await this.db.run(
          `INSERT OR REPLACE INTO cached_dictionary_entries 
           (id, language_code, lemma, display_word, phonetic, part_of_speech, 
            definitions_json, definitions_zh_tw_json, examples_json, 
            created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            'en',
            word.word.toLowerCase(),
            word.word,
            word.phonetic,
            word.pos,
            JSON.stringify([word.enDef]),
            JSON.stringify([word.zh]),
            JSON.stringify([word.example]),
            now,
            now,
          ]
        );
      } catch (error) {
        console.error(`Failed to import word ${word.word}:`, error);
      }
    }

    // Mark as imported
    await this.setMetadata('vocabulary_imported', 'true');
    console.log('Vocabulary import completed');
  }

  private async initializeMetadata(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    for (const metadata of SQLITE_INITIAL_DATA.cache_metadata) {
      try {
        await this.db.run(
          `INSERT OR REPLACE INTO cache_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
          [metadata.key, metadata.value, metadata.updated_at]
        );
      } catch (error) {
        console.error(`Failed to initialize metadata ${metadata.key}:`, error);
      }
    }
  }

  async getMetadata(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.query(
        `SELECT value FROM cache_metadata WHERE key = ?`,
        [key]
      );

      if (result.values && result.values.length > 0) {
        return result.values[0].value;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get metadata ${key}:`, error);
      return null;
    }
  }

  async setMetadata(key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.run(
        `INSERT OR REPLACE INTO cache_metadata (key, value, updated_at) VALUES (?, ?, ?)`,
        [key, value, new Date().toISOString()]
      );
    } catch (error) {
      console.error(`Failed to set metadata ${key}:`, error);
    }
  }

  async queryDictionaryEntry(
    lemma: string,
    languageCode: string = 'en'
  ): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.query(
        `SELECT * FROM cached_dictionary_entries 
         WHERE lemma = ? AND language_code = ?`,
        [lemma.toLowerCase(), languageCode]
      );

      if (result.values && result.values.length > 0) {
        const entry = result.values[0];
        // Parse JSON fields
        return {
          ...entry,
          definitions_json: JSON.parse(entry.definitions_json || '[]'),
          definitions_zh_tw_json: JSON.parse(entry.definitions_zh_tw_json || '[]'),
          examples_json: JSON.parse(entry.examples_json || '[]'),
          collocations_json: JSON.parse(entry.collocations_json || '[]'),
          synonyms_json: JSON.parse(entry.synonyms_json || '[]'),
          antonyms_json: JSON.parse(entry.antonyms_json || '[]'),
          word_family_json: JSON.parse(entry.word_family_json || '[]'),
          topic_tags_json: JSON.parse(entry.topic_tags_json || '[]'),
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to query dictionary entry:', error);
      return null;
    }
  }

  async querySceneLexemeLinks(
    sceneId: string,
    languageCode: string = 'en'
  ): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.query(
        `SELECT * FROM cached_scene_lexeme_links 
         WHERE scene_id = ? AND language_code = ? 
         ORDER BY phrase_priority DESC, end_index - start_index DESC`,
        [sceneId, languageCode]
      );

      return result.values || [];
    } catch (error) {
      console.error('Failed to query scene lexeme links:', error);
      return [];
    }
  }

  async cacheDictionaryEntry(entry: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const now = new Date().toISOString();
      await this.db.run(
        `INSERT OR REPLACE INTO cached_dictionary_entries 
         (id, language_code, lemma, display_word, reading, romanization, ipa, 
          part_of_speech, definitions_json, definitions_zh_tw_json, examples_json, 
          collocations_json, synonyms_json, antonyms_json, word_family_json, 
          cefr_level, frequency_rank, topic_tags_json, source_name, source_license, 
          source_attribution, is_ai_enriched, content_version, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.language_code,
          entry.lemma,
          entry.display_word,
          entry.reading || null,
          entry.romanization || null,
          entry.ipa || null,
          entry.part_of_speech || null,
          JSON.stringify(entry.definitions_json || []),
          JSON.stringify(entry.definitions_zh_tw_json || []),
          JSON.stringify(entry.examples_json || []),
          JSON.stringify(entry.collocations_json || []),
          JSON.stringify(entry.synonyms_json || []),
          JSON.stringify(entry.antonyms_json || []),
          JSON.stringify(entry.word_family_json || []),
          entry.cefr_level || null,
          entry.frequency_rank || null,
          JSON.stringify(entry.topic_tags_json || []),
          entry.source_name || null,
          entry.source_license || null,
          entry.source_attribution || null,
          entry.is_ai_enriched ? 1 : 0,
          entry.content_version || 1,
          entry.created_at || now,
          now,
        ]
      );
    } catch (error) {
      console.error('Failed to cache dictionary entry:', error);
    }
  }

  async cacheSceneLexemeLinks(links: any[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      for (const link of links) {
        const now = new Date().toISOString();
        await this.db.run(
          `INSERT OR REPLACE INTO cached_scene_lexeme_links 
           (id, scene_id, scene_version, language_code, sentence_id, start_index, 
            end_index, display_text, dictionary_entry_id, phrase_priority, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            link.id,
            link.scene_id,
            link.scene_version || 1,
            link.language_code,
            link.sentence_id,
            link.start_index,
            link.end_index,
            link.display_text,
            link.dictionary_entry_id || null,
            link.phrase_priority || 0,
            link.created_at || now,
            now,
          ]
        );
      }
    } catch (error) {
      console.error('Failed to cache scene lexeme links:', error);
    }
  }

  async addToSyncQueue(operation: {
    user_id: string;
    operation_type: string;
    entity_type: string;
    entity_id: string;
    payload: any;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      await this.db.run(
        `INSERT INTO pending_sync_queue 
         (id, user_id, operation_type, entity_type, entity_id, payload, created_at, retry_count, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'pending')`,
        [
          id,
          operation.user_id,
          operation.operation_type,
          operation.entity_type,
          operation.entity_id,
          JSON.stringify(operation.payload),
          now,
        ]
      );
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
    }
  }

  async getPendingSyncItems(userId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const result = await this.db.query(
        `SELECT * FROM pending_sync_queue 
         WHERE user_id = ? AND status = 'pending' 
         ORDER BY created_at ASC`,
        [userId]
      );

      return result.values || [];
    } catch (error) {
      console.error('Failed to get pending sync items:', error);
      return [];
    }
  }

  async markSyncItemCompleted(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      await this.db.run(
        `UPDATE pending_sync_queue SET status = 'completed' WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error('Failed to mark sync item as completed:', error);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite.closeConnection('mobile_english_db', false);
      this.db = null;
      this.isInitialized = false;
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

export const sqliteService = new SQLiteService();
