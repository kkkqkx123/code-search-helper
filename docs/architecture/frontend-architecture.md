# 前端架构设计文档

## 概述

本前端应用是代码库索引与检索系统的用户界面，采用模块化、组件化的架构设计，基于原生TypeScript和Vite构建工具实现。应用遵循现代Web开发最佳实践，具有良好的可维护性和扩展性。

## 技术栈

- **核心语言**: TypeScript
- **构建工具**: Vite
- **模块系统**: ES6 Modules
- **样式管理**: 原生CSS
- **HTTP客户端**: Fetch API

## 架构设计

### 整体架构

前端应用采用分层架构设计，主要分为以下几个层次：

1. **表现层 (Presentation Layer)**: HTML模板和CSS样式
2. **应用层 (Application Layer)**: App主类和路由管理
3. **页面层 (Page Layer)**: 各个功能页面组件
4. **服务层 (Service Layer)**: API客户端服务
5. **工具层 (Utility Layer)**: 工具函数和辅助类

### 核心组件

#### 1. 主应用类 (App.ts)

主应用类是整个前端应用的入口点和协调者，负责：

- 初始化应用组件
- 管理页面切换
- 协调各页面间的数据流
- 维护全局状态

```typescript
export class CodebaseSearchApp {
    private apiClient: ApiClient;
    private searchPage: SearchPage;
    private indexProjectPage: IndexProjectPage;
    private projectsPage: ProjectsPage;
    // ...
}
```

#### 2. 路由管理器 (router/router.ts)

路由管理器负责前端路由控制，包括：

- 页面导航管理
- 浏览器历史记录处理
- 页面状态维护

```typescript
export class Router {
    private currentPage: PageId = 'search';
    private pageChangeCallbacks: ((pageId: PageId) => void)[] = [];
    // ...
}
```

#### 3. 页面组件

##### 搜索页面 (pages/SearchPage.ts)

负责代码搜索功能的展示和交互：

- 搜索表单管理
- 搜索结果展示
- 示例搜索功能

##### 项目索引页面 (pages/IndexProjectPage.ts)

负责项目索引创建功能：

- 索引参数配置
- 索引进度展示
- 索引结果反馈

##### 已索引项目页面 (pages/ProjectsPage.ts)

负责已索引项目的管理：

- 项目列表展示
- 项目操作（重新索引、删除）
- 状态更新

#### 4. API客户端服务 (services/api.ts)

API客户端服务封装了所有与后端的HTTP通信：

- 状态查询
- 代码搜索
- 项目索引管理

```typescript
export class ApiClient {
    async getStatus() { /* ... */ }
    async search(query: string) { /* ... */ }
    async createProjectIndex(projectPath: string, options: { /* ... */ }) { /* ... */ }
    // ...
}
```

## 目录结构

```
frontend/
├── index.html                 # 应用入口HTML文件
├── src/                       # TypeScript源代码
│   ├── App.ts                 # 主应用类
│   ├── pages/                 # 页面组件
│   │   ├── SearchPage.ts      # 搜索页面
│   │   ├── IndexProjectPage.ts # 项目索引页面
│   │   └── ProjectsPage.ts    # 已索引项目页面
│   ├── router/                # 路由管理
│   │   └── router.ts          # 路由器实现
│   ├── services/              # 服务层
│   │   └── api.ts             # API客户端
│   ├── styles/                # 样式文件
│   │   └── main.css           # 主样式文件
│   └── __tests__/             # 测试文件
├── vite.config.ts             # Vite配置文件
├── tsconfig.json              # TypeScript配置
└── package.json               # 项目依赖配置
```

## 数据流设计

1. **用户交互**: 用户通过UI组件触发操作
2. **页面处理**: 页面组件接收用户输入并处理业务逻辑
3. **服务调用**: 页面组件调用API服务与后端通信
4. **数据更新**: 后端返回数据后，页面组件更新UI展示
5. **状态同步**: 页面间通过主应用类进行状态同步

## 样式管理

所有CSS样式都集中管理在`src/styles/main.css`文件中，采用CSS变量定义主题色，确保样式的一致性和可维护性。

## 构建与部署

使用Vite作为构建工具，支持：

- 开发服务器热更新
- 生产环境代码压缩
- 模块打包优化
- TypeScript编译

```bash
# 开发模式运行
npm run dev

# 生产构建
npm run build
```

## 扩展性设计

1. **组件化**: 每个页面都是独立的组件，易于扩展和维护
2. **模块化**: 使用ES6模块系统，支持按需加载
3. **接口抽象**: API客户端封装了所有后端接口，便于替换和扩展
4. **路由机制**: 支持添加新的页面和路由

## 最佳实践

1. **类型安全**: 全面使用TypeScript类型系统
2. **错误处理**: 完善的错误处理和用户反馈机制
3. **代码复用**: 公共功能提取为服务或工具函数
4. **可测试性**: 组件设计考虑了可测试性