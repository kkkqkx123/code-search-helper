# 哈希值与项目路径映射关系实现方案

## 概述

本文档描述了如何实现和维护哈希值与原始项目路径之间的持久化映射关系，以便能够通过生成的安全名称反向查找原始项目路径。

## 需求背景

在之前的修复中，我们实现了`generateSafeProjectName`方法，将项目路径转换为符合数据库命名规范的安全名称。然而，这种转换是单向的，无法通过生成的哈希值反向获取原始项目路径。为了满足某些场景下的需求（如调试、日志记录、管理界面展示等），我们需要维护一个持久化的映射关系。

## 设计方案

### 1. 数据存储方案

使用项目已有的SQLite数据库来存储映射关系，避免引入新的依赖。

#### 表结构设计
```sql
CREATE TABLE IF NOT EXISTS project_path_mapping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE NOT NULL,
    original_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. 实现方式

#### 2.1 创建映射管理服务

在`src/database/`目录下创建`ProjectPathMappingService.ts`：

```typescript
import { injectable, inject } from 'inversify';
import { DatabaseService } from './DatabaseService';
import { LoggerService } from '../utils/LoggerService';

@injectable()
export class ProjectPathMappingService {
  constructor(
    @inject(DatabaseService) private dbService: DatabaseService,
    @inject(LoggerService) private logger: LoggerService
  ) {
    this.initializeTable();
  }

  private async initializeTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS project_path_mapping (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        original_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    try {
      await this.dbService.execute(createTableSQL);
      this.logger.info('Project path mapping table initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize project path mapping table', error);
      throw error;
    }
  }

  /**
   * 保存路径映射关系
   * @param hash 生成的安全名称哈希部分
   * @param originalPath 原始项目路径
   */
  async saveMapping(hash: string, originalPath: string): Promise<void> {
    const insertSQL = `
      INSERT OR REPLACE INTO project_path_mapping (hash, original_path, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `;
    
    try {
      await this.dbService.execute(insertSQL, [hash, originalPath]);
      this.logger.debug(`Saved mapping: ${hash} -> ${originalPath}`);
    } catch (error) {
      this.logger.error(`Failed to save mapping for hash: ${hash}`, error);
      throw error;
    }
  }

  /**
   * 根据哈希值获取原始路径
   * @param hash 安全名称的哈希部分
   * @returns 原始项目路径，如果未找到则返回null
   */
  async getOriginalPath(hash: string): Promise<string | null> {
    const selectSQL = `
      SELECT original_path FROM project_path_mapping WHERE hash = ?
    `;
    
    try {
      const result = await this.dbService.get(selectSQL, [hash]);
      return result ? result.original_path : null;
    } catch (error) {
      this.logger.error(`Failed to get original path for hash: ${hash}`, error);
      throw error;
    }
  }

  /**
   * 获取所有映射关系
   * @returns 所有映射关系的数组
   */
  async getAllMappings(): Promise<Array<{hash: string, originalPath: string, createdAt: Date}>> {
    const selectSQL = `
      SELECT hash, original_path as originalPath, created_at as createdAt 
      FROM project_path_mapping 
      ORDER BY created_at DESC
    `;
    
    try {
      const results = await this.dbService.all(selectSQL);
      return results;
    } catch (error) {
      this.logger.error('Failed to get all mappings', error);
      throw error;
    }
  }

  /**
   * 删除指定的映射关系
   * @param hash 安全名称的哈希部分
   */
  async deleteMapping(hash: string): Promise<void> {
    const deleteSQL = `
      DELETE FROM project_path_mapping WHERE hash = ?
    `;
    
    try {
      await this.dbService.execute(deleteSQL, [hash]);
      this.logger.debug(`Deleted mapping for hash: ${hash}`);
    } catch (error) {
      this.logger.error(`Failed to delete mapping for hash: ${hash}`, error);
      throw error;
    }
  }
}
```

#### 2.2 修改HashUtils.generateSafeProjectName方法

更新`src/utils/HashUtils.ts`中的`generateSafeProjectName`方法，使其能够保存映射关系：

```typescript
// 需要添加注入依赖或者通过参数传递的方式使用ProjectPathMappingService
static generateSafeProjectName(
  projectId: string, 
  prefix: string = 'project', 
  maxLength: number = 63,
  saveMapping: boolean = false,
  mappingService?: ProjectPathMappingService
): string {
  try {
    // 1. 首先尝试直接使用项目ID（如果它已经符合规范）
    const directPattern = /^[a-zA-Z0-9_-]{1,63}$/;
    if (directPattern.test(projectId) && !projectId.startsWith('_')) {
      return `${prefix}-${projectId}`;
    }
    
    // 2. 如果不符合规范，使用哈希值
    const hash = crypto.createHash('sha256').update(projectId).digest('hex');
    
    // 3. 提取哈希的前部分，确保总长度不超过限制
    const prefixLength = prefix.length + 1; // +1 for the hyphen
    const maxHashLength = maxLength - prefixLength;
    const shortHash = hash.substring(0, Math.min(maxHashLength, 16)); // 使用最多16位哈希
    
    const safeName = `${prefix}-${shortHash}`;
    
    // 4. 保存映射关系（如果需要）
    if (saveMapping && mappingService) {
      mappingService.saveMapping(shortHash, projectId).catch(error => {
        // 记录错误但不中断主流程
        console.error('Failed to save project path mapping:', error);
      });
    }
    
    return safeName;
  } catch (error) {
    // 如果出现任何错误，返回一个基于时间戳的安全名称
    const timestamp = Date.now().toString(36);
    return `${prefix}-${timestamp}`;
  }
}
```

#### 2.3 更新配置服务

更新`QdrantConfigService`和`NebulaConfigService`中的方法，传入映射服务：

```typescript
// 在QdrantConfigService中
getCollectionNameForProject(projectId: string): string {
  try {
    // 1. 检查显式环境配置
    const explicitName = process.env.QDRANT_COLLECTION;
    if (explicitName && explicitName !== 'code-snippets') {
      this.logger.warn('Using explicit QDRANT_COLLECTION configuration, which may override project isolation');
      // 验证显式配置的命名是否符合规范
      if (!this.validateNamingConvention(explicitName)) {
        this.logger.error(`Explicit QDRANT_COLLECTION name "${explicitName}" does not follow naming conventions, this may cause issues.`);
      }
      return explicitName;
    }
    
    // 2. 使用项目隔离的动态命名，确保符合命名规范
    const dynamicName = HashUtils.generateSafeProjectName(
      projectId, 
      'project', 
      63, 
      true, 
      this.projectPathMappingService
    );
    
    // 验证动态生成的命名是否符合规范（应该总是通过，但作为双重检查）
    if (!this.validateNamingConvention(dynamicName)) {
      this.logger.error(`Generated collection name "${dynamicName}" does not follow naming conventions.`);
      throw new Error(`Generated collection name "${dynamicName}" is invalid`);
    }
    
    return dynamicName;
  } catch (error) {
    this.errorHandler.handleError(
      error instanceof Error ? error : new Error('Unknown error in getCollectionNameForProject'),
      { component: 'QdrantConfigService', operation: 'getCollectionNameForProject', projectId }
    );
    throw error;
  }
}
```

### 3. 提供查询接口

#### 3.1 创建REST API端点

在`src/api/`目录下创建相关路由：

```typescript
// src/api/routes/projectMappingRoutes.ts
import { Router } from 'express';
import { ProjectPathMappingService } from '../../database/ProjectPathMappingService';

export const createProjectMappingRouter = (mappingService: ProjectPathMappingService): Router => {
  const router = Router();

  // 获取所有映射关系
  router.get('/', async (req, res) => {
    try {
      const mappings = await mappingService.getAllMappings();
      res.json(mappings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve mappings' });
    }
  });

  // 根据哈希值获取原始路径
  router.get('/:hash', async (req, res) => {
    try {
      const { hash } = req.params;
      const originalPath = await mappingService.getOriginalPath(hash);
      
      if (originalPath) {
        res.json({ hash, originalPath });
      } else {
        res.status(404).json({ error: 'Mapping not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve mapping' });
    }
  });

  // 删除映射关系
  router.delete('/:hash', async (req, res) => {
    try {
      const { hash } = req.params;
      await mappingService.deleteMapping(hash);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete mapping' });
    }
  });

  return router;
};
```

#### 3.2 注册路由

在应用的路由配置中注册新的端点：

```typescript
// 在适当的路由配置文件中
import { createProjectMappingRouter } from './routes/projectMappingRoutes';

// 假设已经注入了ProjectPathMappingService
const projectMappingRouter = createProjectMappingRouter(projectPathMappingService);
app.use('/api/project-mappings', projectMappingRouter);
```

## 使用示例

### 1. 通过API查询映射关系

```bash
# 获取所有映射关系
curl http://localhost:3010/api/project-mappings

# 根据哈希值获取原始路径
curl http://localhost:3010/api/project-mappings/7309b226edd38773
```

### 2. 在代码中使用

```typescript
// 获取原始路径
const originalPath = await projectPathMappingService.getOriginalPath('7309b226edd38773');
console.log(originalPath); // 输出: D:/ide/tool/code-search-helper
```

## 注意事项

1. **性能考虑**：映射关系存储在数据库中，查询会有一定的I/O开销，但对于管理操作来说是可以接受的。

2. **数据一致性**：当项目被删除时，应考虑同时清理对应的映射关系。

3. **安全性**：API端点应添加适当的身份验证和授权机制，防止未授权访问。

4. **错误处理**：在保存映射关系时出现错误不应影响主流程，应记录日志但继续执行。

## 总结

通过以上实现方案，我们可以：
1. 维护哈希值与原始项目路径之间的持久化映射关系
2. 提供API接口查询映射关系
3. 利用现有SQLite数据库，无需引入新的依赖
4. 保证系统的向后兼容性

这个方案既满足了通过哈希值反向查找原始路径的需求，又保持了系统的简洁性和可维护性。