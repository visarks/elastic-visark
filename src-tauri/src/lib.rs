pub mod database;
pub mod models;

use sqlx::SqlitePool;
use tauri::Manager;

// Re-export models
pub use models::Connection;
pub use models::History;
pub use models::Settings;

// ============ Connection Commands ============

/// Get all connections
#[tauri::command]
async fn get_connections(app: tauri::AppHandle) -> Result<Vec<Connection>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let rows = sqlx::query_as::<_, Connection>(
        "SELECT id, name, url, username, password, created_at, updated_at FROM connections ORDER BY created_at"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Save a connection
#[tauri::command]
async fn save_connection(app: tauri::AppHandle, connection: Connection) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query(
        r#"
        INSERT INTO connections (id, name, url, username, password, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            url = excluded.url,
            username = excluded.username,
            password = excluded.password,
            updated_at = excluded.updated_at
        "#
    )
    .bind(&connection.id)
    .bind(&connection.name)
    .bind(&connection.url)
    .bind(&connection.username)
    .bind(&connection.password)
    .bind(connection.created_at)
    .bind(connection.updated_at)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete a connection
#[tauri::command]
async fn delete_connection(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query("DELETE FROM connections WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ History Commands ============

/// Get all history records
#[tauri::command]
async fn get_history(app: tauri::AppHandle) -> Result<Vec<History>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let rows = sqlx::query_as::<_, History>(
        "SELECT id, connection_id, connection_name, start_time, end_time, curl, status, duration FROM history ORDER BY start_time DESC LIMIT 100"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Save a history item
#[tauri::command]
async fn save_history_item(app: tauri::AppHandle, history: History) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query(
        r#"
        INSERT INTO history (id, connection_id, connection_name, start_time, end_time, curl, status, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&history.id)
    .bind(&history.connection_id)
    .bind(&history.connection_name)
    .bind(history.start_time)
    .bind(history.end_time)
    .bind(&history.curl)
    .bind(&history.status)
    .bind(history.duration)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete a history item
#[tauri::command]
async fn delete_history_item(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query("DELETE FROM history WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Clear all history
#[tauri::command]
async fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query("DELETE FROM history")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Settings Commands ============

/// Get settings
#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let result: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'history_retention_days'"
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let retention: i64 = result
        .and_then(|v| v.parse().ok())
        .unwrap_or(7);

    Ok(Settings {
        history_retention_days: retention,
    })
}

/// Save settings
#[tauri::command]
async fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('history_retention_days', ?)"
    )
    .bind(settings.history_retention_days.to_string())
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get a single setting value
#[tauri::command]
async fn get_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let result: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = ?"
    )
    .bind(&key)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}

/// Save a single setting value
#[tauri::command]
async fn save_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
    )
    .bind(&key)
    .bind(&value)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ File Dialog Command ============

/// Save file with dialog
#[tauri::command]
async fn save_file_with_dialog(
    app: tauri::AppHandle,
    default_name: String,
    content: String,
) -> Result<bool, String> {
    use tauri_plugin_dialog::DialogExt;

    let extension = default_name.rsplit('.').next().unwrap_or("txt");

    let extensions: Vec<&str> = match extension {
        "json" => vec!["json"],
        "txt" => vec!["txt"],
        "csv" => vec!["csv"],
        _ => vec!["*"],
    };

    let file_path = app
        .dialog()
        .file()
        .add_filter(extension, &extensions)
        .set_file_name(&default_name)
        .blocking_save_file();

    match file_path {
        Some(path) => {
            let path_buf = path.as_path().ok_or("Invalid path")?;
            std::fs::write(path_buf, content).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

// ============ Tree Data Commands ============

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TreeItem {
    #[sqlx(rename = "type_")]
    pub r#type: String,
    pub id: String,
    pub parent_id: Option<String>,
    pub data: String,
    pub sort_order: i32,
}

/// Get tree data
#[tauri::command]
async fn get_tree_data(app: tauri::AppHandle) -> Result<Vec<TreeItem>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let rows = sqlx::query_as::<_, TreeItem>(
        "SELECT id, parent_id, type as 'type_', data, sort_order FROM tree_data ORDER BY sort_order"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Save tree data (replace all)
#[tauri::command]
async fn save_tree_data(app: tauri::AppHandle, items: Vec<TreeItem>) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    // Clear existing
    sqlx::query("DELETE FROM tree_data")
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    // Insert new
    for item in items {
        sqlx::query(
            "INSERT INTO tree_data (id, parent_id, type, data, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&item.id)
        .bind(&item.parent_id)
        .bind(&item.r#type)
        .bind(&item.data)
        .bind(item.sort_order)
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(chrono::Utc::now().timestamp_millis())
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============ Tab Commands ============

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct TabRecord {
    pub id: String,
    pub connection_id: String,
    pub tab_type: String,
    pub title: String,
    pub state: String,
    pub closable: i32,
    pub sort_order: i32,
}

/// Get tabs for a connection
#[tauri::command]
async fn get_tabs(app: tauri::AppHandle, connection_id: String) -> Result<Vec<TabRecord>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let rows = sqlx::query_as::<_, TabRecord>(
        "SELECT id, connection_id, tab_type, title, state, closable, sort_order FROM tab_instances WHERE connection_id = ? ORDER BY sort_order"
    )
    .bind(&connection_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

/// Save tabs (replace all for connection)
#[tauri::command]
async fn save_tabs(app: tauri::AppHandle, connection_id: String, tabs: Vec<TabRecord>) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    // Clear existing
    sqlx::query("DELETE FROM tab_instances WHERE connection_id = ?")
        .bind(&connection_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    // Insert new
    for tab in tabs {
        sqlx::query(
            "INSERT INTO tab_instances (id, connection_id, tab_type, title, state, closable, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&tab.id)
        .bind(&tab.connection_id)
        .bind(&tab.tab_type)
        .bind(&tab.title)
        .bind(&tab.state)
        .bind(tab.closable)
        .bind(tab.sort_order)
        .bind(chrono::Utc::now().timestamp_millis())
        .bind(chrono::Utc::now().timestamp_millis())
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============ Search History Commands ============

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct SearchHistoryRecord {
    pub id: String,
    pub connection_id: Option<String>,
    pub index_name: String,
    pub query: String,
    pub created_at: i64,
}

/// Get search history
#[tauri::command]
async fn get_search_history(app: tauri::AppHandle, connection_id: Option<String>) -> Result<Vec<SearchHistoryRecord>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let rows = match connection_id {
        Some(cid) => sqlx::query_as::<_, SearchHistoryRecord>(
            "SELECT id, connection_id, index_name, query, created_at FROM search_history WHERE connection_id = ? ORDER BY created_at DESC LIMIT 50"
        )
        .bind(&cid)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?,
        None => sqlx::query_as::<_, SearchHistoryRecord>(
            "SELECT id, connection_id, index_name, query, created_at FROM search_history ORDER BY created_at DESC LIMIT 50"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?,
    };

    Ok(rows)
}

/// Save search history
#[tauri::command]
async fn save_search_history(app: tauri::AppHandle, item: SearchHistoryRecord) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query(
        "INSERT INTO search_history (id, connection_id, index_name, query, created_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&item.id)
    .bind(&item.connection_id)
    .bind(&item.index_name)
    .bind(&item.query)
    .bind(item.created_at)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ SQL History Commands ============

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct SqlHistoryRecord {
    pub id: String,
    pub connection_id: Option<String>,
    pub query: String,
    pub created_at: i64,
}

/// Get SQL history
#[tauri::command]
async fn get_sql_history(app: tauri::AppHandle, connection_id: Option<String>) -> Result<Vec<SqlHistoryRecord>, String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    let rows = match connection_id {
        Some(cid) => sqlx::query_as::<_, SqlHistoryRecord>(
            "SELECT id, connection_id, query, created_at FROM sql_history WHERE connection_id = ? ORDER BY created_at DESC LIMIT 50"
        )
        .bind(&cid)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?,
        None => sqlx::query_as::<_, SqlHistoryRecord>(
            "SELECT id, connection_id, query, created_at FROM sql_history ORDER BY created_at DESC LIMIT 50"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?,
    };

    Ok(rows)
}

/// Save SQL history
#[tauri::command]
async fn save_sql_history(app: tauri::AppHandle, item: SqlHistoryRecord) -> Result<(), String> {
    let pool = app.state::<SqlitePool>();
    let pool = pool.inner();

    sqlx::query(
        "INSERT INTO sql_history (id, connection_id, query, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(&item.id)
    .bind(&item.connection_id)
    .bind(&item.query)
    .bind(item.created_at)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Application Entry Point ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize database in a blocking manner
            tauri::async_runtime::block_on(async {
                match database::init_database(&app_handle).await {
                    Ok(pool) => {
                        // Manage the pool state
                        app_handle.manage(pool);
                        println!("Database initialized successfully");
                    }
                    Err(e) => {
                        eprintln!("Failed to initialize database: {}", e);
                        panic!("Database initialization failed: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_connections,
            save_connection,
            delete_connection,
            get_history,
            save_history_item,
            delete_history_item,
            clear_history,
            get_settings,
            save_settings,
            get_setting,
            save_setting,
            save_file_with_dialog,
            get_tree_data,
            save_tree_data,
            get_tabs,
            save_tabs,
            get_search_history,
            save_search_history,
            get_sql_history,
            save_sql_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}