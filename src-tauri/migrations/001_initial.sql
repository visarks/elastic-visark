-- Connections table
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT,
    password TEXT,
    version TEXT,
    folder_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Folders table
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

-- REST history table
CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    connection_id TEXT,
    connection_name TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    curl TEXT,
    status TEXT,
    duration INTEGER
);

-- Application settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Tab instances table
CREATE TABLE IF NOT EXISTS tab_instances (
    id TEXT PRIMARY KEY,
    connection_id TEXT NOT NULL,
    tab_type TEXT NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    closable INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    connection_id TEXT,
    index_name TEXT NOT NULL,
    query TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- SQL history table
CREATE TABLE IF NOT EXISTS sql_history (
    id TEXT PRIMARY KEY,
    connection_id TEXT,
    query TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- Tree data (folder structure)
CREATE TABLE IF NOT EXISTS tree_data (
    id TEXT PRIMARY KEY,
    parent_id TEXT,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_time ON history(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_tabs_connection ON tab_instances(connection_id);
CREATE INDEX IF NOT EXISTS idx_tree_parent ON tree_data(parent_id);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'dark');
INSERT OR IGNORE INTO settings (key, value) VALUES ('history_retention_days', '7');
INSERT OR IGNORE INTO settings (key, value) VALUES ('excludeIndexPatterns', '[.]*');