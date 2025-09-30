# 搜索过滤功能增强计划

## 概述

本文档描述了为前后端查询功能新增最大查询数量（maxResults）和匹配度阈值（minScore）过滤功能的详细实现方案。

## 功能需求

新增两个查询参数：
1. **maxResults** (number): 最大查询结果数量，用于限制返回的搜索结果数量
2. **minScore** (number): 最小匹配度阈值，用于过滤掉相似度较低的搜索结果（范围：0-1）

## 后端调整方案

### 1. API接口更新

#### 1.1 搜索请求参数扩展

**当前实现** (`src/api/ApiServer.ts`):
```typescript
// 当前搜索端点
this.app.post('/api/search', async (req, res) => {
  const { query, options } = req.body;
  // ...
});
```

**修改方案**:
- 在options参数中新增maxResults和minScore字段
- 保持向后兼容性，这两个参数为可选

```typescript
interface SearchOptions {
  projectId?: string;
  maxResults?: number;  // 新增：最大结果数量
  minScore?: number;    // 新增：最小匹配度阈值
}
```

#### 1.2 Mock模式过滤逻辑

**修改位置**: `src/api/ApiServer.ts` 中的 `performSearch` 方法

**当前逻辑**:
```typescript
const filteredResults = mockResults.results
  .filter((result: any) =>
    result.highlightedContent.toLowerCase().includes(query.toLowerCase())
  )
  .map(/* ... */);
```

**新增过滤逻辑**:
```typescript
let filteredResults = mockResults.results
  .filter((result: any) =>
    result.highlightedContent.toLowerCase().includes(query.toLowerCase())
  )
  .map(/* ... */);

// 应用匹配度阈值过滤
if (options?.minScore !== undefined) {
  filteredResults = filteredResults.filter((result: any) => 
    result.score >= options.minScore
  );
}

// 应用最大数量限制
if (options?.maxResults !== undefined && options.maxResults > 0) {
  filteredResults = filteredResults.slice(0, options.maxResults);
}
```

#### 1.3 真实数据库查询模式

**修改位置**: `src/api/ApiServer.ts` 中的 `performSearch` 方法

**当前逻辑**:
```typescript
const searchResults = await this.qdrantService.search(
  projectId,
  query,
  100  // 固定返回100条结果
);
```

**修改方案**:
```typescript
const searchResults = await this.qdrantService.search(
  projectId,
  query,
  options?.maxResults || 100,  // 使用用户指定的最大数量
  options?.minScore            // 传入最小匹配度阈值
);
```

#### 1.4 QdrantService搜索方法更新

**修改位置**: `src/database/QdrantService.ts` 或相关搜索实现

**需要新增**:
- 支持最小匹配度阈值参数
- 在向量搜索查询中应用分数过滤

```typescript
async search(
  projectId: string, 
  query: string, 
  limit: number = 100,
  minScore?: number
): Promise<SearchResult[]> {
  // 执行向量搜索
  const searchParams = {
    collectionName: projectId,
    vector: queryVector,
    limit: limit,
    score_threshold: minScore, // Qdrant支持分数阈值
    // ... 其他参数
  };
  
  // ... 搜索逻辑
}
```

### 2. 数据库查询层调整

#### 2.1 索引路由更新

**修改位置**: `ref/src/api/routes/IndexingRoutes.ts`

**当前实现**:
```typescript
const searchQuery: SearchQuery = req.body;
const results = await this.indexService.search(
  searchQuery.query,
  searchQuery.projectId,
  searchQuery
);
```

**SearchQuery接口更新**:
```typescript
interface SearchQuery {
  query: string;
  projectId: string;
  maxResults?: number;  // 新增
  minScore?: number;    // 新增
  // ... 其他现有字段
}
```

#### 2.2 IndexService搜索方法

**需要确保**: IndexService的search方法能够接收并正确处理新的过滤参数

## 前端调整方案

### 1. API客户端更新

#### 1.1 搜索方法参数扩展

**修改位置**: `frontend/src/services/ApiClient.ts` 或相关API客户端

**当前实现**:
```typescript
async search(query: string, projectId?: string): Promise<SearchResult> {
  // ...
}
```

**修改方案**:
```typescript
interface SearchOptions {
  projectId?: string;
  maxResults?: number;
  minScore?: number;
}

async search(
  query: string, 
  projectId?: string,
  options?: SearchOptions
): Promise<SearchResult> {
  const requestBody = {
    query,
    options: {
      projectId,
      maxResults: options?.maxResults,
      minScore: options?.minScore
    }
  };
  // ... 发送请求
}
```

### 2. 搜索页面UI更新

#### 2.1 搜索表单扩展

**修改位置**: `frontend/src/pages/SearchPage.ts`

**新增UI控件**:

1. **最大结果数量输入框**:
```typescript
// 在搜索表单中添加
<div class="form-group">
  <label for="max-results">最大结果数量:</label>
  <input type="number" id="max-results" min="1" max="100" value="10">
</div>
```

2. **最小匹配度滑块**:
```typescript
// 在搜索表单中添加
<div class="form-group">
  <label for="min-score">最小匹配度:</label>
  <input type="range" id="min-score" min="0" max="1" step="0.1" value="0.3">
  <span id="min-score-value">0.3</span>
</div>
```

3. **滑块值实时显示**:
```typescript
// 添加事件监听器
const minScoreSlider = this.container.querySelector('#min-score') as HTMLInputElement;
const minScoreValue = this.container.querySelector('#min-score-value') as HTMLSpanElement;

minScoreSlider.addEventListener('input', (e) => {
  minScoreValue.textContent = (e.target as HTMLInputElement).value;
});
```

#### 2.2 搜索执行逻辑更新

**修改位置**: `SearchPage.performSearch` 方法

**当前实现**:
```typescript
async performSearch(query: string, projectId?: string) {
  // ...
  const result = await this.apiClient.search(query, projectId);
  // ...
}
```

**修改方案**:
```typescript
async performSearch(query: string, projectId?: string) {
  // ...
  
  // 获取过滤参数
  const maxResultsInput = this.container.querySelector('#max-results') as HTMLInputElement;
  const minScoreInput = this.container.querySelector('#min-score') as HTMLInputElement;
  
  const maxResults = maxResultsInput ? parseInt(maxResultsInput.value) : undefined;
  const minScore = minScoreInput ? parseFloat(minScoreInput.value) : undefined;
  
  const searchOptions = {
    projectId,
    maxResults,
    minScore
  };
  
  const result = await this.apiClient.search(query, projectId, searchOptions);
  // ...
}
```

#### 2.3 搜索结果展示优化

**新增功能**:
1. **显示过滤条件**: 在结果区域显示当前应用的过滤条件
2. **结果数量提示**: 显示"显示X条结果（共Y条）"的信息
3. **匹配度显示**: 在每个结果中显示匹配度分数

```typescript
// 在结果显示区域添加过滤条件信息
const filterInfo = document.createElement('div');
filterInfo.className = 'filter-info';
filterInfo.innerHTML = `
  <small>
    ${maxResults ? `最多显示 ${maxResults} 条结果` : ''}
    ${minScore ? `，匹配度 ≥ ${minScore}` : ''}
  </small>
`;
```

### 3. 样式更新

**新增CSS样式**:

```css
/* 过滤控件样式 */
.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: inline-block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input[type="number"],
.form-group input[type="range"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-group input[type="range"] {
  padding: 0;
}

/* 滑块值显示 */
#min-score-value {
  margin-left: 10px;
  font-weight: bold;
  color: #0066cc;
}

/* 过滤信息提示 */
.filter-info {
  margin: 10px 0;
  padding: 8px;
  background-color: #f0f8ff;
  border-left: 3px solid #0066cc;
  border-radius: 3px;
}

/* 匹配度标签 */
.score-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
}

.score-high { background-color: #4caf50; color: white; }
.score-medium { background-color: #ff9800; color: white; }
.score-low { background-color: #f44336; color: white; }
```

## 数据流图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端搜索表单   │───▶│   API客户端     │───▶│   后端API       │
│                 │    │                 │    │                 │
│ • 搜索关键词     │    │ • 构建请求体     │    │ • 解析参数       │
│ • 最大结果数量   │    │ • 添加过滤参数   │    │ • 应用过滤逻辑   │
│ • 最小匹配度     │    │                 │    │ • 返回过滤结果   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   结果显示      │◀───│   结果处理      │◀───│   数据库查询     │
│                 │    │                 │    │                 │
│ • 显示过滤条件   │    │ • 格式化结果     │    │ • 应用数量限制   │
│ • 结果数量提示   │    │ • 错误处理       │    │ • 应用分数过滤   │
│ • 匹配度展示     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 测试方案

### 1. 后端测试

#### 1.1 Mock模式测试
- 测试不同maxResults值的结果数量限制
- 测试不同minScore值的分数过滤效果
- 测试参数组合使用的效果

#### 1.2 真实数据库测试
- 测试Qdrant向量搜索的分数阈值功能
- 测试大数据集下的性能表现
- 测试边界条件（maxResults=0，minScore=1等）

### 2. 前端测试

#### 2.1 UI测试
- 测试输入控件的正常工作
- 测试滑块值的实时更新
- 测试表单验证和错误处理

#### 2.2 集成测试
- 测试完整的搜索流程
- 测试过滤条件的正确传递
- 测试结果的显示和格式化

## 性能考虑

### 1. 后端性能
- 在数据库层面应用过滤，减少数据传输
- 合理使用索引优化查询性能
- 考虑缓存策略提升响应速度

### 2. 前端性能
- 避免频繁的UI更新导致的重绘
- 合理使用防抖机制优化输入体验
- 考虑虚拟滚动处理大量结果展示

## 错误处理

### 1. 参数验证
- maxResults必须为正整数
- minScore必须在0-1范围内
- 提供清晰的错误提示信息

### 2. 异常情况
- 数据库查询失败的处理
- 网络错误的友好提示
- 参数格式错误的验证

## 后续优化

### 1. 高级过滤
- 支持更多过滤条件（文件类型、时间范围等）
- 支持过滤条件的保存和重用
- 支持复杂的布尔查询

### 2. 用户体验
- 添加过滤条件的历史记录
- 支持一键重置所有过滤条件
- 提供更直观的分数可视化

### 3. 性能优化
- 实现搜索结果的增量加载
- 优化大数据集的展示性能
- 添加搜索建议和自动完成