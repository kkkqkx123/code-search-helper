
# 第一步实施计划：MCP主要服务和转换层

## 目标
创建MCP主要服务和API转换层，使用模拟数据进行功能验证，为前端提供必要的API端点。

## 实施步骤

### 1. 项目基础结构搭建

#### 1.1 创建核心目录结构
```
src/
├── api/                    # API转换层
├── config/                 # 配置管理
├── core/                   # 核心服务
├── database/              # 数据库客户端
├── embedders/             # 嵌入模型
├── mcp/                   # MCP协议处理
├── services/              # 业务服务
├── types/                 # 类型定义
└── utils/                 # 工具函数
```

#### 1.2 初始化package.json
```json
{
  "name": "code-search-helper",
  "version": "1.0.0",
  "description": "代码库索引+检索MCP系统",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "ts-node src/main.ts",
    "test": "jest",
    "lint": "eslint src/**/*.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.4",
    "express": "^5.1.0",
    "inversify": "^7.9.1",
    "reflect-metadata": "^0.2.2",
    "winston": "^3.17.0",
    "dotenv": "^17.2.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/node": "^24.3.0",
    "@types/cors": "^2.8.17",
    "typescript": "^5.9.2",
    "ts-node": "^10.9.2",
    "jest": "^30.1.1",
    "@types/jest": "^30.0.0",
    "eslint": "^9.34.0"
  }
}
```

### 2. 核心服务实现

#### 2.1 依赖注入容器 (src/core/DIContainer.ts)
- 定义类型符号（TYPES）
- 创建核心模块、MCP模块、API模块、服务模块
- 实现单例模式的容器管理

#### 2.2 日志服务 (src/core/LoggerService.ts)
- 基于Winston的日志系统
- 支持控制台和文件输出
- 不同环境（开发、测试、生产）的配置

#### 2.3 配置服务 (src/config/ConfigService.ts)
- 环境变量管理
- 类型安全的配置访问
- 支持多环境配置

#### 2.4 错误处理服务 (src/core/ErrorHandlerService.ts)
- 统一的错误处理机制
- 错误分类和日志记录
- 错误上下文信息保存

### 3. MCP服务实现

#### 3.1 MCP服务器 (src/mcp/MCPServer.ts)
```typescript
// 主要功能：
// - 初始化MCP服务器
// - 注册工具处理器
// - 处理代码索引请求
// - 处理代码搜索请求
// - 处理状态查询请求
```

**工具定义：**
- `codebase.index.create` - 创建代码索引
- `codebase.index.search` - 搜索代码
- `codebase.status.get` - 获取索引状态

#### 3.2 工具处理器实现
- 参数验证和解析
- 调用相应的业务服务
- 结果格式化和返回

### 4. API转换层实现

#### 4.1 API服务器 (src/api/APIServer.ts)
- Express.js服务器初始化
- 中间件配置（CORS、日志、错误处理）
- 路由注册和管理

#### 4.2 控制器实现
**搜索控制器 (src/api/controllers/SearchController.ts):**
- `POST /api/search` - 代码搜索
- `GET /api/search/suggestions` - 搜索建议
- 请求参数验证
- 响应格式标准化

**索引控制器 (src/api/controllers/IndexController.ts):**
- `POST /api/index` - 创建索引
- `GET /api/index/status` - 索引状态查询
- `DELETE /api/index` - 删除索引

### 5. 