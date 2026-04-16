use sqlx::sqlite::{SqlitePool, SqlitePoolOptions, SqliteConnectOptions};
use sqlx::Executor;
use tauri::Manager;
use std::str::FromStr;
use std::path::PathBuf;

pub async fn init_database(app: &tauri::AppHandle) -> Result<SqlitePool, String> {
    // Get app data directory
    let app_dir: PathBuf = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    println!("App data directory: {:?}", app_dir);

    // Create directory if it doesn't exist
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app data dir '{}': {}", app_dir.display(), e))?;
        println!("Created app data directory: {:?}", app_dir);
    }

    let db_path = app_dir.join("visark.db");
    println!("Database path: {:?}", db_path);

    // Create the database file if it doesn't exist
    if !db_path.exists() {
        std::fs::File::create(&db_path)
            .map_err(|e| format!("Failed to create database file '{}': {}", db_path.display(), e))?;
        println!("Created database file: {:?}", db_path);
    }

    // Use absolute path with proper URL encoding
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    println!("Database URL: {}", db_url);

    // Create connect options with WAL mode
    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(|e| format!("Failed to parse database URL: {}", e))?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .create_if_missing(true);

    println!("Connecting to database...");

    // Create pool
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;

    println!("Database connected successfully");

    // Run migrations
    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), String> {
    let migrations = [
        include_str!("../migrations/001_initial.sql"),
        include_str!("../migrations/002_add_tab_is_active.sql"),
    ];

    for migration_sql in migrations {
        // Ignore errors for ALTER TABLE statements (column may already exist)
        let _ = pool.execute(migration_sql).await;
    }

    // Run initial migration (CREATE TABLE statements should always succeed)
    let migration_sql = include_str!("../migrations/001_initial.sql");
    pool.execute(migration_sql)
        .await
        .map_err(|e| format!("Failed to run migrations: {}", e))?;

    Ok(())
}