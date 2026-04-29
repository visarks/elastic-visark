# elastic-visark

一款用于可视化和管理 Elasticsearch 集群的现代化桌面应用，基于 Vue 3 和 Tauri 构建。

![版本](https://img.shields.io/badge/version-0.1.37-blue)
![许可证](https://img.shields.io/badge/license-MIT-green)
![平台](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)

## 功能特性

### 集群管理
- **概览仪表盘** - 实时集群健康状态和统计信息
- **索引管理** - 浏览、创建、删除和管理 Elasticsearch 索引
- **节点监控** - 查看集群节点信息和资源使用情况
- **分片分析** - 分析分片分布和再平衡

### 数据探索
- **搜索界面** - 功能完整的查询构建器
- **SQL 查询** - 使用 SQL 语法查询 Elasticsearch
- **REST API 客户端** - API 请求构建器和响应查看器
- **索引模板** - 管理索引模板

### 可视化
- **查询结果表格** - 搜索结果的表格视图
- **JSON 查看器** - 层级式 JSON 响应查看器
- **聚合构建器** - 构建和可视化聚合查询

### 工具
- **设置管理** - 配置连接设置和偏好设置
- **查询历史** - 追踪和回放历史查询
- **关于对话框** - 应用信息和更新

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **UI 组件库**: Naive UI
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **桌面框架**: Tauri 2.x
- **图表库**: ECharts
- **代码编辑器**: Monaco Editor

## 环境要求

- Node.js 18+
- pnpm 8+
- Rust 1.70+
- Tauri CLI 2.x

## 安装

### 前置条件

1. 安装 Node.js（推荐 LTS 版本）
2. 安装 pnpm：
   ```bash
   npm install -g pnpm
   ```

3. 安装 Rust：
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

4. 安装 Tauri CLI：
   ```bash
   pnpm add -g @tauri-apps/cli
   ```

### 开发环境搭建

1. 克隆仓库：
   ```bash
   git clone https://gitee.com/visarks/elastic-visark-tauri.git
   cd elastic-visark-tauri
   ```

2. 安装依赖：
   ```bash
   pnpm install
   ```

3. 启动开发服务器：
   ```bash
   pnpm tauri dev
   ```

### 构建

构建生产版本：

```bash
pnpm tauri build
```

可执行文件将生成在 `src-tauri/target/release/bundle/` 目录下。

## 项目结构

```
elastic-visark-tauri/
├── src/                      # Vue 前端源码
│   ├── assets/               # 静态资源
│   ├── components/           # 可复用组件
│   │   └── layout/          # 布局组件
│   ├── views/               # 页面组件
│   │   ├── cluster/         # 集群管理
│   │   ├── home/            # 首页
│   │   ├── index/           # 索引详情
│   │   ├── search/          # 搜索界面
│   │   ├── settings/        # 设置页面
│   │   ├── sql/             # SQL 查询
│   │   └── template/        # 索引模板
│   ├── stores/              # Pinia 状态管理
│   ├── types/               # TypeScript 类型定义
│   ├── utils/               # 工具函数
│   └── router/              # Vue Router 配置
├── src-tauri/               # Tauri 后端源码
│   ├── icons/               # 应用图标
│   ├── src/                 # Rust 源码
│   │   └── main.rs          # 入口文件
│   ├── Cargo.toml           # Rust 依赖
│   └── tauri.conf.json      # Tauri 配置
├── public/                  # 公共资源
├── index.html               # HTML 入口
├── package.json             # Node 依赖
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
└── CLAUDE.md                # 项目规范
```

## 配置

### Elasticsearch 连接

在设置页面配置 Elasticsearch 连接：
- 主机地址（默认：http://localhost:9200）
- 认证方式（用户名/密码或 API Key）
- 连接超时时间

### 应用设置

- 主题（浅色/深色模式）
- 查询历史保留时间
- 结果预览限制

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + K` | 打开命令面板 |
| `Ctrl/Cmd + S` | 保存当前查询 |
| `Ctrl/Cmd + Enter` | 执行查询 |
| `Ctrl/Cmd + Shift + C` | 复制结果 |

## 许可证

MIT 许可证 -详见 LICENSE 文件。

## 致谢

基于 [Tauri](https://tauri.app/)、[Vue](https://vuejs.org/) 和 [Naive UI](https://www.naiveui.com/) 构建。
