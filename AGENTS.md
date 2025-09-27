# 代码库索引与检索MCP服务

## 📖 项目概述

本项目是一个基于Model Context Protocol (MCP) 的智能代码库索引和检索服务，旨在为LLM提供高效的代码库分析和搜索能力。

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
# 启动开发服务器
npm run dev
```

访问 http://localhost:3000 查看前端界面

### 3. 构建项目

```bash
# 构建主项目
npm run build

# 构建前端
cd frontend
npm run build
cd ..
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
codebase-search-helper/
├── 📁 config/                 # 规则文件，迁移自其他项目，目前未集成
├── 📁 src/                    # 主项目源代码
│   ├── 📁 api/               # API路由和控制器
│   ├── 📁 mcp/              # MCP协议处理
│   ├── 📁 utils/            # 工具函数
│   └── main.ts              # 应用入口
├── 📁 frontend/             # 前端代码（独立package.json）
├── 📁 data/                # 数据文件
│   └── 📁 mock/            # 模拟数据文件
├── 📁 docs/                # 项目文档
├── 📁 scripts/             # 脚本文件
└── package.json            # 主项目依赖配置
```

## 🛠️ 开发指南

### 环境要求
- Node.js 18.0+
- npm 8.0+

### 代码规范
- 使用TypeScript
- 遵循ESLint规则
- 使用Prettier格式化代码

## 🤝 贡献

1. Fork 本项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

MIT