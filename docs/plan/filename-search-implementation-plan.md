# 文件名搜索功能实现方案（纯向量架构）

## 设计原则
- **架构一致性**：完全基于现有向量搜索基础设施
- **语义优先**：支持自然语言查询，符合LLM用户需求
- **渐进实现**：分阶段构建，快速验证核心功能
- **零外部依赖**：不使用ripgrep等外部工具，保持架构纯粹性

## 核心架构设计

### 1. 向量索引结构
```typescript
interface FileVectorIndex {
  id: string;                    // 文件唯一ID
  projectId: string;            // 项目ID
  filePath: string;              // 完整路径
  fileName: string;              // 文件名（不含路径）
  directory: string;             // 目录路径
  extension: string;             // 文件扩展名
  
  // 向量表示
  nameVector: number[];          // 文件名语义向量
  pathVector: number[];          // 路径语义向量
  combinedVector: number[];      // 路径+名称组合向量
  
  // 元数据
  semanticDescription: string;   // AI生成的语义描述
  lastModified: Date;            // 修改时间
  fileSize: number;              // 文件大小
  fileType: 'file' | 'directory'; // 文件类型
}
```

### 2. 搜索服务分层
```
FileSearchService (顶层接口)
├── VectorFileSearchCore (向量搜索核心)
├── FileIndexManager (索引管理)
└── FileQueryProcessor (查询处理器)
```

## 实现阶段

### 阶段一：基础向量索引（1周）
**目标**：建立文件名和路径的向量索引

**核心任务**：
- [ ] 扩展`QdrantService`支持文件向量collection
- [ ] 实现`FileVectorIndexer`索引构建服务
- [ ] 添加文件系统监听，增量更新索引
- [ ] 基础文件名语义搜索API
- [ ] **新建文件**：`src/api/routes/FileSearchRoutes.ts`（从ref目录迁移接口定义）
- [ ] **新建文件**：`src/service/filesearch/FileVectorIndexer.ts`（核心索引服务）
- [ ] **新建文件**：`src/service/filesearch/FileSearchService.ts`（搜索服务）

**技术实现**：
```typescript
class FileVectorIndexer {
  constructor(
    private qdrantService: QdrantService,
    private embedder: BaseEmbedder
  ) {}

  async indexFile(filePath: string, projectId: string): Promise<void> {
    const fileName = path.basename(filePath);
    const directory = path.dirname(filePath);
    
    // 生成向量
    const nameVector = await this.embedder.embed(fileName);
    const pathVector = await this.embedder.embed(filePath);
    const combinedVector = await this.embedder.embed(`${directory} ${fileName}`);
    
    // 生成语义描述
    const semanticDescription = await this.generateSemanticDescription(fileName, directory);
    
    // 存储到Qdrant
    await this.qdrantService.upsert('file_vectors', {
      id: this.generateFileId(filePath, projectId),
      vector: {
        name: nameVector,
        path: pathVector,
        combined: combinedVector
      },
      payload: { filePath, fileName, directory, projectId, semanticDescription }
    });
  }
}
```

### 阶段二：智能查询处理（1周）
**目标**：支持自然语言文件搜索

**核心任务**：
- [ ] 实现`FileQueryIntentClassifier`查询分类器
- [ ] 支持语义描述搜索："找到所有认证相关的配置文件"
- [ ] 支持路径模式搜索："搜索src/services下的测试文件"
- [ ] 集成到`SearchCoordinator`
- [ ] **修改文件**：`src/api/routes/index.ts`（添加FileSearchRoutes导出）
- [ ] **修改文件**：`src/core/DIContainer.ts`（添加文件搜索服务依赖注入）
- [ ] **新建文件**：`src/service/filesearch/FileQueryProcessor.ts`（查询处理器）
- [ ] **新建文件**：`src/service/filesearch/FileQueryIntentClassifier.ts`（意图分类器）

**查询类型支持**：
```typescript
type FileQueryType = 
  | 'EXACT_FILENAME'      // config.json
  | 'SEMANTIC_DESCRIPTION' // 认证相关的配置文件
  | 'PATH_PATTERN'        // src/services下的文件
  | 'EXTENSION_SEARCH'    // 所有.ts文件
  | 'HYBRID_QUERY';       // 结合多种条件

class FileQueryProcessor {
  async processQuery(query: string, options: SearchOptions): Promise<FileSearchResult[]> {
    const intent = await this.classifyQueryIntent(query);
    
    switch (intent.type) {
      case 'SEMANTIC_DESCRIPTION':
        return this.semanticSearch(query, options);
      case 'EXACT_FILENAME':
        return this.filenameSearch(query, options);
      case 'PATH_PATTERN':
        return this.pathPatternSearch(query, options);
      default:
        return this.hybridSearch(query, options);
    }
  }
}
```

### 阶段三：高级功能（1周）
**目标**：完善搜索体验和性能

**核心任务**：
- [ ] 搜索缓存机制
- [ ] 结果相关性评分优化
- [ ] 支持文件内容预览
- [ ] 批量文件操作集成
- [ ] **修改文件**：`src/api/ApiServer.ts`（注册文件搜索路由）
- [ ] **修改文件**：`src/service/search/SearchCoordinator.ts`（扩展支持文件搜索协调）
- [ ] **新建文件**：`src/service/filesearch/FileSearchCache.ts`（搜索缓存服务）

## 集成方案

### 1. 从ref目录迁移的文件
**需要迁移的核心接口和类型定义**（从`ref/src/api/routes/FileSystemRoutes.ts`）：
- `FileSearchRequest`接口 - 文件搜索请求格式
- `FileContentRequest`接口 - 文件内容获取请求
- `FileSystemTraversalRequest`接口 - 文件系统遍历请求
- 路由方法签名和响应格式定义

**注意**：仅迁移接口定义和设计理念，具体实现需基于现有架构重新构建

### 2. 依赖注入配置
```typescript
// 在DIContainer中添加
container.bind<FileSearchService>(TYPES.FileSearchService).to(FileSearchService);
container.bind<FileVectorIndexer>(TYPES.FileVectorIndexer).to(FileVectorIndexer);
container.bind<FileQueryProcessor>(TYPES.FileQueryProcessor).to(FileQueryProcessor);
```

### 3. SearchCoordinator扩展
```typescript
class SearchCoordinator {
  async coordinateSearch(query: SearchQuery): Promise<SearchResponse> {
    // 文件搜索检测
    if (this.isFileSearchQuery(query)) {
      return this.fileSearchService.search(query.text, query.options);
    }
    
    // 现有搜索逻辑
    return this.coordinateRegularSearch(query);
  }
  
  private isFileSearchQuery(query: SearchQuery): boolean {
    return query.text.includes('文件') || 
           query.text.includes('找到') ||
           query.text.includes('搜索') && this.hasFileKeywords(query.text);
  }
}
```

**注意**：如果`SearchCoordinator.ts`不存在，需要在`src/service/`目录下新建

### 4. API接口设计
```typescript
interface FileSearchAPI {
  // 基础文件搜索
  POST /api/search/files
  {
    query: string;           // 搜索查询
    projectId?: string;      // 项目ID
    options?: {
      maxResults?: number;   // 最大结果数
      fileTypes?: string[];  // 文件类型过滤
      pathPattern?: string;  // 路径模式
    }
  }
  
  // 响应
  {
    results: Array<{
      filePath: string;
      fileName: string;
      directory: string;
      relevanceScore: number;
      semanticDescription: string;
    }>;
    total: number;
    queryType: FileQueryType;
  }
}
```

**API路由注册**：在`src/api/ApiServer.ts`中添加文件搜索路由注册

## 性能优化

### 1. 向量索引优化
- **分层索引**：按项目和目录层级组织
- **预计算向量**：文件创建时立即索引
- **增量更新**：监听文件系统变化
- **批量操作**：支持批量文件索引

### 2. 查询性能
- **多向量搜索**：同时搜索name、path、combined向量
- **结果合并**：智能合并多向量搜索结果
- **缓存策略**：缓存常见查询结果
- **分页支持**：大数据集分页返回

### 3. 内存管理
- **流式处理**：大结果集流式返回
- **向量压缩**：使用量化技术减少内存占用
- **连接池**：复用Qdrant连接

## 用户体验特性

### 自然语言支持示例
```
"找到所有与用户认证相关的配置文件"
"搜索src/services目录下的所有测试文件"  
"找到上周修改过的TypeScript文件"
"找到所有可能是控制器文件的代码"
"找到包含数据库配置的文件"
```

### 智能理解能力
- **语义关联**：理解"配置文件"包含.json、.yaml、.config等
- **时间理解**：支持"最近修改"、"昨天创建"等时间描述
- **功能识别**：识别文件的功能用途（控制器、服务、工具等）
- **项目结构**：理解典型的项目目录结构

## 测试策略

### 单元测试
- 向量生成准确性测试
- 查询意图分类测试
- 索引构建正确性测试

### 集成测试
- 端到端文件搜索测试
- 性能基准测试
- 大规模数据测试

### 用户验收测试
- 自然语言查询准确性
- 搜索结果相关性
- 响应时间满意度

## 部署考虑

### 资源需求
- **Qdrant存储**：每百万文件约需要2-5GB向量存储
- **内存使用**：搜索时约需要500MB-1GB内存
- **CPU资源**：向量计算需要一定的CPU资源

### 监控指标
- 索引构建时间
- 搜索响应时间
- 向量存储使用量
- 搜索准确率

## 风险评估

### 技术风险
- **向量质量**：语义理解可能不够准确
- **索引一致性**：文件系统变化与索引同步
- **性能瓶颈**：大规模数据下的查询性能

### 缓解措施
- 多模型向量生成对比
- 实时文件系统监听
- 分层索引和缓存优化

## 具体文件修改清单

### 需要新建的8个文件：
1. `src/api/routes/FileSearchRoutes.ts` - 文件搜索API路由（迁移ref目录接口定义）
2. `src/service/filesearch/FileVectorIndexer.ts` - 文件向量索引服务
3. `src/service/filesearch/FileSearchService.ts` - 文件搜索核心服务
4. `src/service/filesearch/FileQueryProcessor.ts` - 查询处理器
5. `src/service/filesearch/FileQueryIntentClassifier.ts` - 查询意图分类器
6. `src/service/filesearch/FileSearchCache.ts` - 搜索缓存服务
7. `src/service/search/SearchCoordinator.ts` - 搜索协调器（如不存在则新建）
8. `src/service/filesearch/index.ts` - 文件搜索服务模块导出

### 需要修改的4个文件：
1. `src/api/routes/index.ts` - 添加FileSearchRoutes导出
2. `src/core/DIContainer.ts` - 添加文件搜索服务依赖注入
3. `src/api/ApiServer.ts` - 注册文件搜索路由
4. `src/types.ts` - 添加文件搜索相关类型定义（如需要）

### 从ref目录迁移的内容：
**仅迁移接口定义和类型**（从`ref/src/api/routes/FileSystemRoutes.ts`）：
- `FileSearchRequest`接口定义
- `FileContentRequest`接口定义  
- `FileSystemTraversalRequest`接口定义
- 路由响应格式定义
- **注意**：不迁移具体实现代码，仅参考设计理念

**需要参考的ref目录文件**：
- `ref/src/api/routes/FileSystemRoutes.ts` - 接口定义和路由结构参考
- `ref/src/service/lsp/utils.ts` - 文件类型检测和路径处理工具函数参考
- `ref/src/api/routes/IndexingRoutes.ts` - 路由设计模式参考

## 总结

纯向量文件搜索方案充分利用了现有技术栈，提供了：

✅ **架构一致性**：完全符合现有向量搜索设计  
✅ **语义能力**：支持自然语言智能查询  
✅ **零依赖**：无需外部工具，简化部署  
✅ **扩展性**：易于扩展到多维度搜索  
✅ **用户体验**：贴合LLM用户的使用习惯  

**实施路径**：
- **第1周**：完成基础向量索引（新建6个文件）
- **第2周**：实现智能查询处理（修改3个文件，新建2个文件）
- **第3周**：完善高级功能和性能优化（修改1个文件）

**关键依赖**：
- 利用现有`QdrantService`进行向量存储
- 利用现有`EmbedderFactory`生成文件向量
- 集成现有项目配置和错误处理机制
- 遵循现有代码风格和架构模式

预期3周完成核心功能，提供智能、高效的文件搜索能力。