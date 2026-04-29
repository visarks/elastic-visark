# Elastic VisArk

A modern desktop application for visualizing and managing Elasticsearch clusters, built with Vue 3 and Tauri.

![Elastic VisArk](https://img.shields.io/badge/version-0.1.37-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## Features

### Cluster Management
- **Overview Dashboard** - Real-time cluster health status and statistics
- **Index Management** - Browse, create, delete, and manage Elasticsearch indices
- **Node Monitoring** - View cluster node information and resource usage
- **Shard Analysis** - Analyze shard distribution and rebalancing

### Data Exploration
- **Search Interface** - Full-featured search with query builder
- **SQL Query** - Query Elasticsearch using SQL syntax
- **REST API Client** - Direct API request builder and response viewer
- **Index Templates** - Manage index templates

### Visualization
- **Query Results Table** - Tabular view of search results
- **JSON Viewer** - Hierarchical JSON response viewer
- **Aggregations Builder** - Build and visualize aggregation queries

### Tools
- **Settings Management** - Configure connection settings and preferences
- **Query History** - Track and replay previous queries
- **About Dialog** - Application information and updates

## Tech Stack

- **Frontend Framework**: Vue 3 + TypeScript
- **UI Components**: Naive UI
- **State Management**: Pinia
- **Routing**: Vue Router 4
- **Desktop Framework**: Tauri 2.x
- **Charts**: ECharts
- **Code Editor**: Monaco Editor

## Requirements

- Node.js 18+
- pnpm 8+
- Rust 1.70+
- Tauri CLI 2.x

## Installation

### Prerequisites

1. Install Node.js (LTS recommended)
2. Install pnpm:
   ```bash
   npm install -g pnpm
   ```

3. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

4. Install Tauri CLI:
   ```bash
   pnpm add -g @tauri-apps/cli
   ```

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://gitee.com/visarks/elastic-visark-tauri.git
   cd elastic-visark-tauri
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start development server:
   ```bash
   pnpm tauri dev
   ```

### Build

Build for production:

```bash
pnpm tauri build
```

The executable will be generated in `src-tauri/target/release/bundle/`.

## Project Structure

```
elastic-visark-tauri/
├── src/                      # Vue frontend source
│   ├── assets/               # Static assets
│   ├── components/           # Reusable components
│   │   └── layout/           # Layout components
│   ├── views/                # Page components
│   │   ├── cluster/          # Cluster management
│   │   ├── home/             # Home page
│   │   ├── index/            # Index details
│   │   ├── search/           # Search interface
│   │   ├── settings/         # Settings page
│   │   ├── sql/              # SQL query
│   │   └── template/         # Index templates
│   ├── stores/               # Pinia stores
│   ├── types/                # TypeScript types
│   ├── utils/                # Utility functions
│   └── router/               # Vue Router config
├── src-tauri/                # Tauri backend source
│   ├── icons/                # Application icons
│   ├── src/                  # Rust source
│   │   └── main.rs           # Entry point
│   ├── Cargo.toml            # Rust dependencies
│   └── tauri.conf.json       # Tauri configuration
├── public/                   # Public assets
├── index.html                # HTML entry
├── package.json              # Node dependencies
├── tsconfig.json             # TypeScript config
├── vite.config.ts           # Vite config
└── CLAUDE.md                 # Project conventions
```

## Configuration

### Elasticsearch Connection

Configure your Elasticsearch connection in the Settings page:
- Host URL (default: http://localhost:9200)
- Authentication (username/password or API key)
- Connection timeout

### Application Settings

- Theme (light/dark mode)
- Query history retention
- Result preview limits

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + S` | Save current query |
| `Ctrl/Cmd + Enter` | Execute query |
| `Ctrl/Cmd + Shift + C` | Copy results |

## License

MIT License - see LICENSE file for details.

## Acknowledgments

Built with [Tauri](https://tauri.app/), [Vue](https://vuejs.org/), and [Naive UI](https://www.naiveui.com/).
