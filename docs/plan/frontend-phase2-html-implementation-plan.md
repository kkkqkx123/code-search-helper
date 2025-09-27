# 阶段二：前端HTML实现计划（简化版）

## 📋 概述

本计划详细说明如何为阶段二（数据存储与嵌入器集成）实现纯HTML+CSS+TypeScript前端页面。基于对现有代码的分析，前端仅用于测试目的，采用轻量级技术栈。

## 🎯 实现目标

**主要目标**: 创建支持项目索引构建和查询的HTML页面

**具体目标**:
1. 创建项目索引构建表单页面
2. 创建已索引项目查询页面  
3. 实现页面间导航和切换
4. 集成后端API调用
5. 提供用户友好的状态反馈

## 🛠️ 技术栈要求

**前端技术**:
- **框架**: 原生HTML + CSS + TypeScript
- **构建工具**: Vite
- **UI组件**: 自定义轻量级组件，无外部框架依赖
- **通信**: REST API + Fetch API
- **样式**: 纯CSS，使用CSS变量支持主题

**部署要求**:
- 单页面应用，通过显示/隐藏实现页面切换
- 无路由依赖，保持简单性
- 最小化外部依赖

## 📁 前端结构

```
frontend/
├── index.html              # 主HTML文件（包含所有页面）
├── package.json           # 前端依赖配置
├── vite.config.js         # Vite构建配置
├── src/
│   └── __tests__/         # 测试文件
└── 无其他目录结构，保持简单
```

## 📄 页面设计

### 1. 主页面结构（单页面应用）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>代码库索引与检索系统</title>
    <style>
        /* 全局样式和页面切换逻辑 */
        .page {
            display: none;
        }
        .page.active {
            display: block;
        }
    </style>
</head>
<body>
    <!-- 导航菜单 -->
    <nav class="main-nav">
        <button onclick="showPage('search')">代码搜索</button>
        <button onclick="showPage('index-project')">构建索引</button>
        <button onclick="showPage('projects')">已索引项目</button>
    </nav>

    <!-- 搜索页面 -->
    <div id="search-page" class="page active">
        <!-- 现有搜索功能 -->
    </div>

    <!-- 项目索引构建页面 -->
    <div id="index-project-page" class="page">
        <!-- 新增：项目索引表单 -->
    </div>

    <!-- 已索引项目页面 -->
    <div id="projects-page" class="page">
        <!-- 新增：项目列表 -->
    </div>

    <script type="module">
        // 页面切换逻辑
        function showPage(pageId) {
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(`${pageId}-page`).classList.add('active');
        }
    </script>
</body>
</html>
```

## 🔧 API端点需求

基于ref分析，需要以下后端API支持：

### 项目索引相关API
```typescript
// 创建项目索引
POST /api/v1/indexing/create
{
  "projectPath": "/path/to/project",
  "options": {
    "embedder": "siliconflow",
    "batchSize": 100,
    "maxFiles": 1000
  }
}

// 获取项目列表
GET /api/v1/projects

// 获取项目详情
GET /api/v1/projects/{projectId}

// 删除项目
DELETE /api/v1/projects/{projectId}

// 重新索引项目
POST /api/v1/projects/{projectId}/reindex

// 获取索引进度
GET /api/v1/projects/{projectId}/progress
```

### 前端API服务封装
```typescript
class ProjectService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = 'http://localhost:3010') {
    this.apiBaseUrl = apiBaseUrl;
  }

  // 创建项目索引
  async createProjectIndex(projectPath: string, options: any): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/indexing/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath, options })
    });
    return response.json();
  }

  // 获取项目列表
  async getProjects(): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/projects`);
    return response.json();
  }

  // 删除项目
  async deleteProject(projectId: string): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}`, {
      method: 'DELETE'
    });
    return response.json();
  }
}
```

## 📋 需要从ref移植的模块

### 后端模块（需要先集成）
1. **数据库服务模块**
   - `ref/src/database/QdrantService.ts` - 向量数据库服务
   - `ref/src/database/ProjectIdManager.ts` - 项目ID管理
   - `ref/src/database/ProjectLookupService.ts` - 项目查找服务

2. **嵌入器服务模块**
   - `ref/src/embedders/EmbedderFactory.ts` - 嵌入器工厂
   - `ref/src/embedders/OpenAIEmbedder.ts` - OpenAI嵌入器
   - `ref/src/embedders/OllamaEmbedder.ts` - Ollama嵌入器

3. **API路由模块**
   - `ref/src/api/routes/ProjectRoutes.ts` - 项目相关API
   - `ref/src/api/routes/IndexingRoutes.ts` - 索引相关API

### 前端无需移植模块
- 前端保持简单HTML结构
- 无需复杂状态管理
- 直接使用Fetch API调用后端服务

## 🎨 UI组件设计

### 项目索引表单组件
```html
<div class="form-container">
  <h2>构建项目索引</h2>
  <form id="project-index-form">
    <div class="form-group">
      <label for="project-path">项目路径:</label>
      <input type="text" id="project-path" required 
             placeholder="/path/to/your/project">
    </div>
    
    <div class="form-group">
      <label for="embedder">嵌入器:</label>
      <select id="embedder">
        <option value="openai">OpenAI</option>
        <option value="ollama">Ollama</option>
      </select>
    </div>

    <div class="form-actions">
      <button type="submit" id="index-button">开始构建</button>
      <button type="button" id="cancel-button">取消</button>
    </div>
  </form>

  <div id="indexing-progress" class="progress-container" style="display: none;">
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
    <div class="progress-text">处理中: 0%</div>
  </div>
</div>
```

### 项目列表组件
```html
<div class="projects-container">
  <h2>已索引项目</h2>
  <div class="projects-toolbar">
    <button id="refresh-projects">刷新</button>
  </div>
  
  <table class="projects-table">
    <thead>
      <tr>
        <th>项目名称</th>
        <th>路径</th>
        <th>文件数</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody id="projects-list">
      <!-- 动态填充 -->
    </tbody>
  </table>
</div>
```

## 🔄 实施步骤

### 第一阶段：后端API准备（1-2天）
1. 集成必要的后端模块
2. 实现项目管理和索引API
3. 测试API端点可用性

### 第二阶段：前端页面实现（2-3天）
1. 在现有HTML中添加新页面结构
2. 实现页面切换逻辑
3. 创建项目索引表单
4. 实现项目列表展示

### 第三阶段：功能集成（1-2天）
1. 集成API调用
2. 实现状态管理和错误处理
3. 添加加载状态和进度指示

### 第四阶段：测试优化（1天）
1. 功能测试
2. 用户体验优化
3. 错误处理完善

## ⚠️ 注意事项

1. **保持简单性**: 前端仅用于测试，避免过度工程化
2. **错误处理**: 提供清晰的错误提示和状态反馈
3. **进度指示**: 长时间操作需要进度显示
4. **响应式设计**: 确保在不同设备上正常显示

## 📊 验收标准

### 功能验收
1. ✅ 能够成功显示项目索引表单
2. ✅ 能够提交项目路径并开始构建
3. ✅ 能够显示构建进度和状态
4. ✅ 能够展示已索引项目列表
5. ✅ 能够删除和重新索引项目

### 技术验收
1. ✅ 纯HTML+CSS+TypeScript实现
2. ✅ 无外部框架依赖
3. ✅ 单页面应用结构
4. ✅ 完整的API集成

---

*文档版本: 2.0*
*创建日期: 2025-09-27*
*最后更新: 2025-09-27*