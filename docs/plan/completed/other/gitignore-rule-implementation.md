# .gitignore规则支持实施方案

## 当前状态分析

### 已实现功能
- ✅ GitignoreParser类：能够解析.gitignore文件并转换为glob模式
- ✅ FileSystemTraversal服务：支持`respectGitignore`选项
- ✅ 基础忽略规则：默认忽略node_modules、.git等常见目录

### 缺失功能
- ❌ 只读取根目录.gitignore，不支持一级子目录
- ❌ 缺少.indexignore文件支持
- ❌ 缺少热更新机制
- ❌ 默认忽略规则不完整（参考`docs/plan/defaultIgnore.md`）

## 实施目标

### 第一阶段：基础规则支持
1. 扩展.gitignore读取范围（根目录 + 一级子目录）
2. 实现.indexignore文件支持
3. 集成默认忽略规则

### 第二阶段：热更新机制（后续扩展）
1. 文件监听机制
2. 规则变化检测
3. 索引自动更新

## 详细实施方案

### 1. 扩展GitignoreParser类

#### 新增方法：`getAllGitignorePatterns`
```typescript
/**
 * 获取项目中所有适用的.gitignore规则
 * @param projectRoot 项目根目录
 * @returns 所有适用的忽略规则数组
 */
static async getAllGitignorePatterns(projectRoot: string): Promise<string[]> {
  const patterns: string[] = [];
  
  // 1. 读取根目录.gitignore
  const rootGitignorePath = path.join(projectRoot, '.gitignore');
  const rootPatterns = await this.parseGitignore(rootGitignorePath);
  patterns.push(...rootPatterns);
  
  // 2. 读取一级子目录中的.gitignore文件
  try {
    const entries = await fs.readdir(projectRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDirPath = path.join(projectRoot, entry.name);
        const subGitignorePath = path.join(subDirPath, '.gitignore');
        const subPatterns = await this.parseGitignore(subGitignorePath);
        
        // 为子目录规则添加前缀，确保只在对应目录生效
        const prefixedPatterns = subPatterns.map(pattern => 
          path.join(entry.name, pattern).replace(/\\/g, '/')
        );
        patterns.push(...prefixedPatterns);
      }
    }
  } catch (error) {
    // 忽略读取错误，继续执行
    console.warn(`Failed to read subdirectories: ${error}`);
  }
  
  return patterns.filter(pattern => pattern !== '');
}
```

#### 新增方法：`parseIndexignore`
```typescript
/**
 * 解析.indexignore文件
 * @param projectRoot 项目根目录
 * @returns .indexignore中的规则数组
 */
static async parseIndexignore(projectRoot: string): Promise<string[]> {
  const indexignorePath = path.join(projectRoot, '.indexignore');
  try {
    const content = await fs.readFile(indexignorePath, 'utf-8');
    return this.parseContent(content);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
```

### 2. 扩展FileSystemTraversal服务

#### 修改`traverseDirectory`方法
```typescript
async traverseDirectory(rootPath: string, options?: TraversalOptions): Promise<TraversalResult> {
  const startTime = Date.now();
  let traversalOptions = { ...this.defaultOptions, ...options };

  // 合并所有忽略规则
  const allIgnorePatterns: string[] = [];
  
  // 1. 添加默认忽略规则（参考defaultIgnore.md）
  allIgnorePatterns.push(...this.getDefaultIgnorePatterns());
  
  // 2. 添加.gitignore规则（如果启用）
  if (traversalOptions.respectGitignore) {
    const gitignorePatterns = await GitignoreParser.getAllGitignorePatterns(rootPath);
    allIgnorePatterns.push(...gitignorePatterns);
  }
  
  // 3. 添加.indexignore规则
  const indexignorePatterns = await GitignoreParser.parseIndexignore(rootPath);
  allIgnorePatterns.push(...indexignorePatterns);
  
  // 4. 添加用户自定义排除规则
  if (traversalOptions.excludePatterns) {
    allIgnorePatterns.push(...traversalOptions.excludePatterns);
  }
  
  // 更新排除规则
  traversalOptions = {
    ...traversalOptions,
    excludePatterns: [...new Set(allIgnorePatterns)] // 去重
  };

  // 记录规则信息（调试用）
  this.logger.debug(`[DEBUG] Final ignore patterns for ${rootPath}`, {
    defaultPatterns: this.getDefaultIgnorePatterns().length,
    gitignorePatterns: traversalOptions.respectGitignore ? 
      (await GitignoreParser.getAllGitignorePatterns(rootPath)).length : 0,
    indexignorePatterns: indexignorePatterns.length,
    customPatterns: options?.excludePatterns?.length || 0,
    totalPatterns: traversalOptions.excludePatterns?.length || 0
  });

  // 继续原有逻辑...
  const result: TraversalResult = {
    files: [],
    directories: [],
    errors: [],
    totalSize: 0,
    processingTime: 0,
  };

  try {
    await this.traverseRecursive(rootPath, rootPath, result, traversalOptions);
    result.processingTime = Date.now() - startTime;
    
    this.logger.debug(`[DEBUG] Traversal completed for ${rootPath}`, {
      filesFound: result.files.length,
      directoriesFound: result.directories.length,
      errors: result.errors.length,
      processingTime: result.processingTime,
      ignorePatternsApplied: traversalOptions.excludePatterns?.length || 0
    });
  } catch (error) {
    result.errors.push(
      `Failed to traverse directory: ${error instanceof Error ? error.message : String(error)}`
    );
    result.processingTime = Date.now() - startTime;
    this.logger.error(`[DEBUG] Traversal failed for ${rootPath}`, error);
  }

  return result;
}
```

#### 新增方法：`getDefaultIgnorePatterns`
```typescript
/**
 * 获取默认忽略规则
 * @returns 默认忽略规则数组
 */
private getDefaultIgnorePatterns(): string[] {
  // 参考 docs/plan/defaultIgnore.md 中的完整列表
  return [
    // Version control
    '.git/**',
    '.hg/**',
    '.hgignore',
    '.svn/**',
    
    // Dependency directories
    '**/node_modules/**',
    '**/bower_components/**',
    '**/jspm_packages/**',
    'vendor/**',
    '**/.bundle/**',
    '**/.gradle/**',
    'target/**',
    
    // Logs
    'logs/**',
    '**/*.log',
    '**/npm-debug.log*',
    '**/yarn-debug.log*',
    '**/yarn-error.log*',
    
    // 更多默认规则...（完整列表参考defaultIgnore.md）
    
    // Essential directories
    '**/.venv/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/__pycache__/**'
  ];
}
```

### 3. 创建IgnoreRuleManager服务（热更新准备）

#### 新建文件：`src/service/ignore/IgnoreRuleManager.ts`
```typescript
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GitignoreParser } from '../../utils/GitignoreParser';
import { LoggerService } from '../../utils/LoggerService';

/**
 * 忽略规则管理器
 * 负责管理.gitignore和.indexignore规则，支持热更新
 */
export class IgnoreRuleManager extends EventEmitter {
  private rules: Map<string, string[]> = new Map(); // projectPath -> patterns
  private fileWatchers: Map<string, fs.FileHandle> = new Map();
  
  constructor(private logger: LoggerService) {
    super();
  }
  
  /**
   * 获取项目的所有忽略规则
   */
  async getIgnorePatterns(projectPath: string): Promise<string[]> {
    if (this.rules.has(projectPath)) {
      return this.rules.get(projectPath)!;
    }
    
    const patterns = await this.loadIgnorePatterns(projectPath);
    this.rules.set(projectPath, patterns);
    
    // 启动文件监听（热更新准备）
    await this.startWatching(projectPath);
    
    return patterns;
  }
  
  /**
   * 加载所有忽略规则
   */
  private async loadIgnorePatterns(projectPath: string): Promise<string[]> {
    const patterns: string[] = [];
    
    // 1. 默认规则
    patterns.push(...this.getDefaultIgnorePatterns());
    
    // 2. .gitignore规则
    const gitignorePatterns = await GitignoreParser.getAllGitignorePatterns(projectPath);
    patterns.push(...gitignorePatterns);
    
    // 3. .indexignore规则
    const indexignorePatterns = await GitignoreParser.parseIndexignore(projectPath);
    patterns.push(...indexignorePatterns);
    
    return [...new Set(patterns)]; // 去重
  }
  
  /**
   * 启动文件监听（热更新准备）
   */
  private async startWatching(projectPath: string): Promise<void> {
    // 实现文件变化监听逻辑
    // 当.gitignore或.indexignore文件变化时，触发规则更新事件
    this.logger.debug(`[IgnoreRuleManager] Started watching ignore files for ${projectPath}`);
  }
  
  /**
   * 停止文件监听
   */
  async stopWatching(projectPath: string): Promise<void> {
    // 清理监听器
    this.logger.debug(`[IgnoreRuleManager] Stopped watching ignore files for ${projectPath}`);
  }
  
  /**
   * 获取默认忽略规则
   */
  private getDefaultIgnorePatterns(): string[] {
    // 返回完整的默认忽略规则列表
    // 参考 docs/plan/defaultIgnore.md
    return [
      // 完整默认规则列表...
    ];
  }
}
```

### 4. 集成到索引服务

#### 修改IndexService
```typescript
// 在IndexService中注入IgnoreRuleManager
constructor(
  // ... 现有依赖
  @inject(TYPES.IgnoreRuleManager) private ignoreRuleManager: IgnoreRuleManager
) {}

private async indexProject(projectPath: string, options?: IndexSyncOptions): Promise<void> {
  // 获取忽略规则
  const ignorePatterns = await this.ignoreRuleManager.getIgnorePatterns(projectPath);
  
  // 更新遍历选项
  const traversalOptions = {
    includePatterns: options?.includePatterns,
    excludePatterns: ignorePatterns,
    respectGitignore: false // 禁用内置的.gitignore处理，使用统一规则管理器
  };
  
  // 继续原有索引逻辑...
}
```

## 实施步骤

### 第一步：扩展GitignoreParser（1-2天）
1. 实现`getAllGitignorePatterns`方法
2. 实现`parseIndexignore`方法
3. 添加单元测试

### 第二步：扩展FileSystemTraversal（1-2天）
1. 修改`traverseDirectory`方法集成新规则
2. 实现`getDefaultIgnorePatterns`方法
3. 更新相关测试

### 第三步：创建IgnoreRuleManager（2-3天）
1. 创建新的服务类
2. 实现规则缓存和文件监听基础框架
3. 集成到DI容器

### 第四步：集成到索引流程（1天）
1. 修改IndexService使用新规则管理器
2. 测试完整流程

## 测试策略

### 单元测试
- GitignoreParser扩展功能测试
- FileSystemTraversal规则集成测试
- IgnoreRuleManager功能测试

### 集成测试
- 完整索引流程测试
- 规则生效性验证
- 多级.gitignore文件测试

### 性能测试
- 规则解析性能
- 大项目索引性能影响

## 后续扩展（热更新机制）

### 文件监听实现
```typescript
// 在IgnoreRuleManager中实现
private async setupFileWatcher(projectPath: string, filePath: string): Promise<void> {
  // 使用fs.watch监听文件变化
  // 当文件变化时，重新加载规则并触发更新事件
}
```

### 索引更新机制
```typescript
// 监听规则变化事件
ignoreRuleManager.on('rulesChanged', async (projectPath, newPatterns) => {
  // 检测哪些文件需要从索引中移除
  // 调用索引服务进行增量更新
});
```

## 总结

本实施方案提供了完整的.gitignore规则支持，包括：

1. **扩展的.gitignore读取**：支持根目录和一级子目录
2. **.indexignore文件支持**：提供额外的忽略规则配置
3. **默认规则集成**：参考`docs/plan/defaultIgnore.md`的完整列表
4. **热更新准备**：为后续实现预留了架构支持

实施完成后，项目索引将能够根据.gitignore规则智能忽略无关文件，提高索引质量和效率。