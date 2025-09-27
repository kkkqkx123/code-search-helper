# 代码库索引与检索MCP服务

## 📖 项目概述

本项目是一个基于Model Context Protocol (MCP) 的智能代码库索引和检索服务，旨在为LLM提供高效的代码库分析和搜索能力。系统采用模块化架构设计，集成了多种先进技术栈，提供多维度代码分析和检索功能。

## 🎯 核心功能

### 1. 多技术栈集成
- **LSP集成**: 语言服务器协议支持，提供精确的代码理解
- **向量数据库**: Qdrant集成，支持语义相似性搜索
- **图数据库**: Nebula Graph集成，支持代码关系分析
- **Tree-sitter**: 多语言语法解析，支持智能代码片段提取
- **Semgrep**: 静态代码分析，安全漏洞检测

### 2. 智能检索能力
- 语义搜索（基于嵌入向量）
- 关键词搜索
- 混合搜索（语义+关键词+图关系）
- 代码结构分析
- 跨文件引用追踪

### 3. 多嵌入器支持
- OpenAI Embeddings
- Ollama本地模型
- Gemini API
- Mistral AI
- SiliconFlow
- 自定义嵌入器

## 🚀 快速开始

### 1. 安装依赖

```bash
# 安装主项目依赖
npm install

# 安装前端依赖
cd frontend
npm install
cd ..
```

### 2. 开发模式运行

```bash
# 启动后端开发服务器
npm run dev
```
端口为3010

```bash
# 启动前端开发服务器
cd frontend; npm run dev
```
访问 http://localhost:3011 查看前端界面

### 3. 构建项目

```bash
# 构建主项目
npm run build

# 构建前端
cd frontend
npm run build
cd ..
```

### 4. 新增开发依赖

```bash
npm i -D 依赖 --legacy-peer-deps
```

## 🧪 测试

### 运行集成测试

```bash
npm run test:integration
```

### 测试工具模块

```bash
npm run test:utils
```

## 📁 项目结构

```
code-search-helper/
├── 📁 config/                 # 配置文件
├── 📁 src/                    # 主项目源代码
│   ├── 📁 api/               # API路由和控制器
│   ├── 📁 database/          # 数据库服务
│   ├── 📁 embedders/         # 嵌入器提供商
│   ├── 📁 mcp/              # MCP协议处理
│   ├── 📁 utils/            # 工具函数
│   └── main.ts              # 应用入口
├── 📁 ref/                  # 参考模块（从其他项目迁移）
│   ├── 📁 database/         # 数据库服务
│   ├── 📁 embedders/        # 嵌入器提供商
│   ├── 📁 mcp/             # MCP协议实现
│   ├── 📁 service/         # 各种服务实现
│   └── 📁 utils/           # 工具函数
├── 📁 frontend/             # 前端代码（独立package.json）
├── 📁 data/                # 数据文件
│   └── 📁 mock/            # 模拟数据文件
├── 📁 docs/                # 项目文档
│   ├── 📁 plan/            # 实施计划
│   └── 📁 ref/             # 参考文档
├── 📁 scripts/             # 脚本文件
└── package.json            # 主项目依赖配置
```

### ref目录说明

`ref/` 目录包含了从其他项目迁移来的模块，这些模块可以作为相应部分的参考实现。这些模块包括：
- 数据库服务（Qdrant、Nebula Graph等）
- 嵌入器提供商（OpenAI、Ollama、Gemini等）
- MCP协议实现
- 各种服务实现（图分析、解析、搜索等）
- 工具函数

相关的文档可以在 `docs/ref/` 目录中找到。

## 🔄 模块集成计划

系统采用分阶段集成策略，详细计划请参考 [模块集成计划](docs/plan/module-integration-plan.md)。

### 阶段一：基础框架与核心服务（1-2周）
- 配置管理系统
- 日志和错误处理
- 基础工具函数
- MCP服务器框架

### 阶段二：数据存储与嵌入器（2-3周）
- 向量数据库集成 (Qdrant)
- 嵌入器服务集成

### 阶段三：代码解析与搜索（3-4周）
- 代码解析基础功能
- 基本搜索工作流

### 阶段四：高级功能集成（4-6周）
- 图数据库服务
- LSP集成
- 静态分析
- 高级搜索算法

## 🛠️ 开发指南

### 环境要求
- Node.js 18.0+
- npm 8.0+
- Docker (用于数据库服务)

### 技术栈
- **后端**: TypeScript, Express.js, 各种AI和数据库集成
- **前端**: 原生HTML + CSS + TypeScript (仅用于测试)
- **构建工具**: Vite
- **数据库**: Qdrant (向量数据库), Nebula Graph (图数据库)
- **AI集成**: OpenAI, Ollama, Gemini, Mistral, SiliconFlow等嵌入器

### 代码规范
- 使用TypeScript
- 遵循ESLint规则
- 使用Prettier格式化代码
- 前端保持轻量级，无框架依赖
