-- Ensure grammar practice records can sync into learning_records even when
-- older databases created learning_record_type before grammar practice shipped.

do $$ begin
  alter type learning_record_type add value if not exists 'grammar';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
