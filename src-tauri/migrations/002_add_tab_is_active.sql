-- Add is_active column to tab_instances table (for existing databases)
ALTER TABLE tab_instances ADD COLUMN is_active INTEGER DEFAULT 0;