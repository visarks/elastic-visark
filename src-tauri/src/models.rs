/// Connection configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub url: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Request history record
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct History {
    pub id: String,
    pub connection_id: String,
    pub connection_name: String,
    pub start_time: i64,
    pub end_time: i64,
    pub curl: String,
    pub status: String,
    pub duration: i64,
}

/// Application settings
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Settings {
    #[serde(default = "default_retention_days")]
    pub history_retention_days: i64,
}

fn default_retention_days() -> i64 {
    7
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            history_retention_days: 7,
        }
    }
}