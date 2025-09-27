
# 代码库索引+检索MCP系统

## 项目概述

本项目是一个基于MCP（Model Context Protocol）的代码库索引和检索系统，集成了多种先进技术来提供高效的代码分析能力。系统支持LSP、向量数据库、图数据库、tree-sitter等多种检索增强方式，并提供转换层为前端提供必要的API端点。

## 系统架构

### 核心组件

1. **MCP服务层** - 提供MCP协议接口，支持与其他LLM工具集成
2. **API转换层** - 将MCP接口转换为REST API，供前端调用
3. **检索引擎** - 集成多种检索技术：
   - 向量相似性搜索（Qdrant）
   - 图数据库查询（Nebula Graph）
   - LSP增强搜索
   - Tree-sitter语法分析
4. **前端界面** - 简洁的HTML+CSS+TS实现，支持可视化调试

### 技术栈

- **后端**: TypeScript, Node.js 18+, InversifyJS (依赖注入)
- **数据库**: Qdrant (向量数据库), Nebula Graph (图数据库)
- **解析**: Tree-sitter (多语言语法分析)
- **静态分析**: Semgrep
- **嵌入模型**: OpenAI, Ollama, Gemini, Mistral等
- **前端**: 原生HTML, CSS, TypeScript (无框架依赖)

## 项目结构

```
code-search-helper/
├── src/                    # 主服务源代码
│   ├── api/               # API层和转换层
│   ├── config/            # 配置管理
│   ├── core/              # 核心服务（DI容器、日志、错误处理）
│   ├── database/          # 数据库客户端
│   ├── embedders/         # 嵌入模型提供商
│   ├── mcp/               # MCP协议处理
│   ├── services/          # 业务服务层
│   └── utils/             # 工具函数
├── frontend/              # 前端应用
│   ├── index.html         # 主页面
│   ├── src/               # TypeScript源码
│   ├── styles/            # CSS样式
│   └── package.json       # 前端独立包管理
├── data/                  # 模拟数据目录
│   └── mock/              # JSON模拟数据
├── docs/                  # 项目文档
│   ├── plan/              # 实施计划
│   └── ref/               # 参考文档
└── config/                # 配置文件
```

## 功能特性

### 1. 代码索引
- 多语言代码解析（支持TypeScript, JavaScript, Python, Java, Go, Rust等）
- 智能代码片段提取
- 向量嵌入生成和存储
- 图关系构建和存储

### 2. 智能检索
- 语义搜索（基于向量相似性）
- 图搜索（基于代码依赖关系）
- 混合搜索（多模态结果融合）
- LSP增强搜索（基于语言服务器协议）

### 3. 静态分析
- Semgrep规则扫描
- 安全漏洞检测
- 代码质量检查
- 语义分析增强

### 4. 可视化界面
- 搜索结果展示
- 代码片段预览
- 依赖关系图
- 性能监控面板

## 部署和运行

### 开发环境
```bash
# 安装依赖
npm install

# 启动数据库服务
docker-compose up -d qdrant nebula-graph

# 开发模式运行
npm run dev
```

### 前端开发
```bash
cd frontend
npm install
npm run dev
```

### 生产部署
```bash
# 构建生产版本
npm run build

# 启动服务
npm start
```

## 集成和使用

### MCP协议集成
系统通过MCP协议与其他LLM工具集成，支持标准的工具调用格式。

### API调用示例
```typescript
// 搜索代码
POST /api/search
{
  "query": "用户认证函数",
  "options": {
    "limit": 10,
    "includeGraph": true
  }
}

// 索引代码库
POST /api/index
{
  "projectPath": "/path/to/project",
  "options": {
    "recursive": true,
    "includePatterns": ["*.ts", "*.js"]
  }
}
```

## 监控和运维

- **健康检查**: `/health` 端点
- **性能指标**: Prometheus指标导出
- **日志管理**: Winston日志系统
-