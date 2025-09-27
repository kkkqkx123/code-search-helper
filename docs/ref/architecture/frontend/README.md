# 前端架构文档

本目录包含 Codebase Index MCP 前端应用的完整架构设计文档。

## 文档结构

```
frontend/
├── README.md                    # 本文件 - 文档索引
├── architecture-overview.md     # 架构设计总览
├── component-architecture.md    # 组件架构设计
├── development-workflow.md     # 开发工作流
└── build-configuration.md      # 构建配置详解
```

## 快速导航

### 🏗️ [架构设计总览](architecture-overview.md)
- 技术栈选择
- 项目结构
- 架构设计原则
- 核心功能模块
- 性能优化策略
- 安全考虑

### 🧩 [组件架构设计](component-architecture.md)
- 组件设计原则
- 组件层次结构
- 组件分类体系
- 组件通信模式
- 状态管理架构
- 组件样式架构
- 组件测试策略
- 组件性能优化

### 🔄 [开发工作流](development-workflow.md)
- 开发环境设置
- 功能开发流程
- 代码质量检查
- 测试流程
- 开发规范和最佳实践
- 持续集成和部署

### ⚙️ [构建配置详解](build-configuration.md)
- Vite 配置详解
- TypeScript 配置
- 代码质量工具配置
- 测试配置
- 性能优化配置
- 资源优化配置

## 技术栈概览

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 19.1.1 | UI 框架 |
| 语言 | TypeScript | 5.9.2 | 类型安全 |
| 构建 | Vite | 7.1.5 | 构建工具 |
| 路由 | React Router | 7.1.3 | 路由管理 |
| 状态 | React Query | 3.39.3 | 服务端状态管理 |
| 可视化 | D3.js | 7.9.0 | 数据可视化 |
| 网络 | Vis.js | 10.0.1 | 网络图展示 |
| HTTP | Axios | 1.7.9 | HTTP 客户端 |
| 测试 | Jest | 30.1.3 | 测试框架 |
| 代码 | ESLint | 9.35.0 | 代码质量 |
| 格式 | Prettier | 3.6.2 | 代码格式化 |

## 项目结构

```
frontend/
├── public/                    # 静态资源
├── src/
│   ├── api/                   # API 适配器层
│   ├── components/           # React 组件
│   ├── contexts/            # React Context
│   ├── hooks/               # 自定义 Hooks
│   ├── services/            # 业务服务层
│   ├── styles/              # 样式文件
│   ├── types/               # TypeScript 类型
│   ├── utils/               # 工具函数
│   ├── App.tsx              # 主应用组件
│   └── main.tsx             # 应用入口
├── __tests__/               # 测试文件
├── __mocks__/               # 测试模拟
└── 配置文件                 # 各种配置文件
```

## 快速开始

### 环境要求
- Node.js >= 18.0
- npm >= 8.0

### 安装和运行
```bash
# 安装依赖
cd frontend
npm install

# 开发服务器
npm run dev

# 生产构建
npm run build

# 运行测试
npm run test
```

### 可用脚本
```bash
npm run dev          # 启动开发服务器
npm run build        # 生产环境构建
npm run preview      # 预览构建结果
npm run test         # 运行测试
npm run test:watch   # 测试监听模式
npm run test:coverage # 测试覆盖率
npm run lint         # 代码规范检查
npm run lint:fix     # 自动修复规范问题
npm run format       # 代码格式化
npm run format:check # 检查代码格式
```

## 核心特性

### 🎯 现代化架构
- 基于 React 19 和 TypeScript
- 组件化设计模式
- 响应式布局系统
- 主题切换支持

### 🚀 高性能优化
- 代码分割和懒加载
- 资源压缩和优化
- 图片和字体优化
- Service Worker 缓存

### 🔧 开发体验
- 热模块替换（HMR）
- 类型安全检查
- 自动化测试
- 代码质量工具

### 📊 数据可视化
- D3.js 图表库
- Vis.js 网络图
- 交互式图形界面
- 实时数据更新

### 🔒 安全特性
- 输入验证和清理
- XSS 防护
- CSRF 防护
- 安全 HTTP 头

## 开发指南

### 创建新组件
1. 参考 [开发工作流](development-workflow.md) 中的组件开发流程
2. 遵循组件架构设计原则
3. 编写完整的测试用例
4. 确保代码质量和性能

### 状态管理
1. 优先使用本地状态（useState）
2. 服务端状态使用 React Query
3. 全局状态使用 Context API
4. 避免过度工程化

### 样式开发
1. 使用 CSS Modules
2. 遵循 BEM 命名规范
3. 使用 CSS 变量主题系统
4. 确保响应式设计

### 性能优化
1. 使用 React.memo 优化组件
2. 合理使用 useMemo 和 useCallback
3. 实现虚拟滚动处理长列表
4. 监控和优化核心指标

## 部署指南

### 构建产物
- 静态 HTML、CSS、JavaScript 文件
- 优化后的图片和字体资源
- Source map 文件（调试用）
- Service Worker 文件（PWA 支持）

### 部署环境
- 支持任何静态文件服务器
- 推荐配合 CDN 使用
- 支持 Docker 容器化部署
- 支持 CI/CD 自动化部署

### 环境配置
- 通过环境变量配置 API 地址
- 支持多环境部署（开发、测试、生产）
- 灵活的配置管理策略

## 监控和维护

### 性能监控
- 核心 Web 指标监控
- 用户体验指标跟踪
- 错误日志收集
- 性能瓶颈分析

### 代码质量
- 自动化代码审查
- 测试覆盖率监控
- 依赖安全检查
- 代码复杂度分析

### 更新策略
- 定期更新依赖版本
- 渐进式升级策略
- 向后兼容性保证
- 详细的变更日志

## 贡献指南

### 代码贡献
1. 遵循现有代码风格
2. 编写清晰的提交信息
3. 包含完整的测试用例
4. 更新相关文档

### 文档贡献
1. 保持文档的准确性
2. 使用清晰的语言表达
3. 包含实际的代码示例
4. 及时更新过时的内容

### 问题报告
1. 使用问题模板
2. 提供详细的复现步骤
3. 包含环境信息
4. 添加相关的日志信息

## 相关资源

- [React 官方文档](https://react.dev/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)
- [Vite 指南](https://vitejs.dev/guide/)
- [React Query 文档](https://tanstack.com/query/latest)
- [D3.js 教程](https://d3js.org/)
- [Testing Library](https://testing-library.com/)

## 许可证

本项目采用 MIT 许可证 - 详见项目根目录的 LICENSE 文件。