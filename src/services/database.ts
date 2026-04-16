import { invoke } from '@tauri-apps/api/core'

// ============ Types ============

export interface Connection {
  id: string
  name: string
  url: string
  username?: string
  password?: string
  created_at: number
  updated_at: number
}

export interface History {
  id: string
  connection_id: string
  connection_name: string
  start_time: number
  end_time: number
  curl: string
  status: string
  duration: number
}

export interface Settings {
  history_retention_days: number
}

export interface TreeItem {
  id: string
  parent_id: string | null
  type: string
  data: string
  sort_order: number
}

export interface TabRecord {
  id: string
  connection_id: string
  tab_type: string
  title: string
  state: string
  closable: number
  sort_order: number
  is_active?: number
}

export interface SearchHistoryRecord {
  id: string
  connection_id: string | null
  index_name: string
  query: string
  created_at: number
}

export interface SqlHistoryRecord {
  id: string
  connection_id: string | null
  query: string
  created_at: number
}

// ============ Connection Operations ============

export async function getConnections(): Promise<Connection[]> {
  return invoke('get_connections')
}

export async function saveConnection(connection: Connection): Promise<void> {
  return invoke('save_connection', { connection })
}

export async function deleteConnection(id: string): Promise<void> {
  return invoke('delete_connection', { id })
}

// ============ History Operations ============

export async function getHistory(): Promise<History[]> {
  return invoke('get_history')
}

export async function saveHistoryItem(history: History): Promise<void> {
  return invoke('save_history_item', { history })
}

export async function deleteHistoryItem(id: string): Promise<void> {
  return invoke('delete_history_item', { id })
}

export async function clearHistory(): Promise<void> {
  return invoke('clear_history')
}

// ============ Settings Operations ============

export interface AllSettings {
  history_retention_days: number
  theme: string
  exclude_index_patterns: string
}

export async function getSettings(): Promise<Settings> {
  return invoke('get_settings')
}

export async function saveSettings(settings: Settings): Promise<void> {
  return invoke('save_settings', { settings })
}

export async function getSetting(key: string): Promise<string | null> {
  return invoke('get_setting', { key })
}

export async function saveSetting(key: string, value: string): Promise<void> {
  return invoke('save_setting', { key, value })
}

// ============ File Operations ============

export async function saveFileWithDialog(defaultName: string, content: string): Promise<boolean> {
  return invoke('save_file_with_dialog', { defaultName, content })
}

// ============ Tree Data Operations ============

export async function getTreeData(): Promise<TreeItem[]> {
  return invoke('get_tree_data')
}

export async function saveTreeData(items: TreeItem[]): Promise<void> {
  return invoke('save_tree_data', { items })
}

// ============ Tab Operations ============

export async function getTabs(connectionId: string): Promise<TabRecord[]> {
  return invoke('get_tabs', { connectionId })
}

export async function saveTabs(connectionId: string, tabs: TabRecord[]): Promise<void> {
  return invoke('save_tabs', { connectionId, tabs })
}

// ============ Search History Operations ============

export async function getSearchHistory(connectionId?: string): Promise<SearchHistoryRecord[]> {
  return invoke('get_search_history', { connectionId })
}

export async function saveSearchHistory(item: SearchHistoryRecord): Promise<void> {
  return invoke('save_search_history', { item })
}

// ============ SQL History Operations ============

export async function getSqlHistory(connectionId?: string): Promise<SqlHistoryRecord[]> {
  return invoke('get_sql_history', { connectionId })
}

export async function saveSqlHistory(item: SqlHistoryRecord): Promise<void> {
  return invoke('save_sql_history', { item })
}