# Ignore 模块与热更新模块整合技术实施方案

## 概述

本文档详细描述了如何整合 ignore 模块与热更新模块，解决代码重复、资源浪费和维护困难的问题。

## 当前架构分析

### 问题点

1. **重复的默认忽略规则**
   - `src/service/ignore/defaultIgnorePatterns.ts` (159行)
   - `src/service/filesystem/defaultIgnorePatterns.ts` (158行)
   - 内容几乎完全相同，存在严重的代码重复

2. **独立的热更新实现**
   - `IgnoreRuleManager` 实现了自己的文件监听机制
   - `FileWatcherService` 也有独立的文件监听
   - 两个系统可能同时监听相同文件，造成资源浪费

3. **配置不一致**
   - 热更新配置工厂使用硬编码的忽略规则
   - 不同模块使用不同的默认忽略规则源

## 解决方案架构

### 1. 统一忽略规则管理

#### 1.1 创建统一的默认忽略规则
```typescript
// src/service/ignore/UnifiedDefaultIgnorePatterns.ts
export const UNIFIED_DEFAULT_IGNORE_PATTERNS: string[] = [
  // 合并两个文件的所有规则，去重后排序
  // 作为唯一的默认忽略规则源
];
```

#### 1.2 创建统一忽略规则服务
```typescript
// src/service/ignore/UnifiedIgnoreRuleService.ts
export class UnifiedIgnoreRuleService extends EventEmitter {
  private rules: Map<string, string[]> = new Map();
  private ruleSources: Map<string, RuleSource[]> = new Map();
  
  // 统一的规则获取接口
  async getIgnorePatterns(projectPath: string): Promise<string[]>
  
  // 规则更新通知
  private notifyRuleChange(projectPath: string, patterns: string[]): void
  
  // 规则来源追踪
  private trackRuleSource(projectPath: string, source: RuleSource): void
}
```

### 2. 配置工厂模式优化

#### 2.1 创建忽略配置工厂
```typescript
// src/config/factories/IgnoreConfigFactory.ts
export class IgnoreConfigFactory {
  static createDefaultIgnorePatterns(): string[] {
    return UNIFIED_DEFAULT_IGNORE_PATTERNS;
  }
  
  static createProjectIgnorePatterns(projectPath: string): Promise<string[]> {
    // 使用统一服务获取项目特定的忽略规则
  }
}
```

#### 2.2 更新热更新配置工厂
```typescript
// src/config/factories/HotReloadConfigFactory.ts
export class HotReloadConfigFactory {
  static createDefaultGlobalConfig(): HotReloadGlobalConfig {
    return {
      // ... 其他配置
      defaultIgnorePatterns: IgnoreConfigFactory.createDefaultIgnorePatterns(),
      // ... 其他配置
    };
  }
}
```

### 3. 热更新协调器

#### 3.1 创建热更新协调器
```typescript
// src/service/filesystem/HotReloadCoordinator.ts
export class HotReloadCoordinator {
  private fileWatchers: Map<string, FSWatcher> = new Map();
  private watchedFiles: Map<string, Set<string>> = new Map();
  
  // 统一的文件监听管理
  async startWatching(projectPath: string, files: string[]): Promise<void>
  
  async stopWatching(projectPath: string): Promise<void>
  
  // 文件变化处理
  private handleFileChange(projectPath: string, filePath: string): void
  
  // 事件分发
  private dispatchChangeEvent(event: FileChangeEvent): void
}
```

## 实施步骤

### 阶段 1: 创建统一基础设施

#### 步骤 1.1: 创建统一的默认忽略规则
1. 创建 `src/service/ignore/UnifiedDefaultIgnorePatterns.ts`
2. 合并现有两个默认忽略规则文件的内容
3. 去重并排序规则
4. 添加详细的注释说明每个规则的用途

#### 步骤 1.2: 创建忽略配置工厂
1. 创建 `src/config/factories/IgnoreConfigFactory.ts`
2. 实现静态方法获取默认忽略规则
3. 实现项目特定忽略规则获取方法

#### 步骤 1.3: 更新热更新配置工厂
1. 修改 `HotReloadConfigFactory` 使用 `IgnoreConfigFactory`
2. 确保所有默认配置使用统一的忽略规则

### 阶段 2: 重构现有模块

#### 步骤 2.1: 重构 IgnoreRuleManager
1. 移除文件监听逻辑
2. 专注于规则解析和管理
3. 使用统一的默认忽略规则
4. 通过事件机制通知规则变化

#### 步骤 2.2: 重构 FileWatcherService
1. 移除忽略规则管理逻辑
2. 使用 `UnifiedIgnoreRuleService` 获取忽略规则
3. 简化文件监听逻辑

#### 步骤 2.3: 重构 FileSystemTraversal
1. 移除忽略规则缓存逻辑
2. 使用 `UnifiedIgnoreRuleService` 获取忽略规则
3. 简化遍历逻辑

### 阶段 3: 创建热更新协调器

#### 步骤 3.1: 创建 HotReloadCoordinator
1. 实现统一的文件监听管理
2. 实现事件分发机制
3. 避免重复监听相同文件

#### 步骤 3.2: 集成现有模块
1. 将 `IgnoreRuleManager` 的文件监听迁移到协调器
2. 将 `FileWatcherService` 的文件监听迁移到协调器
3. 建立事件通知机制

### 阶段 4: 清理和优化

#### 步骤 4.1: 删除重复代码
1. 删除 `src/service/filesystem/defaultIgnorePatterns.ts`
2. 清理不再需要的导入和引用
3. 更新所有引用使用统一规则

#### 步骤 4.2: 添加测试
1. 为 `UnifiedIgnoreRuleService` 添加测试
2. 为 `IgnoreConfigFactory` 添加测试
3. 为 `HotReloadCoordinator` 添加测试
4. 更新现有测试以适应新架构

## 代码示例

### 统一忽略规则服务
```typescript
export class UnifiedIgnoreRuleService extends EventEmitter {
  private rules: Map<string, string[]> = new Map();
  private ruleSources: Map<string, RuleSource[]> = new Map();
  
  constructor(
    private logger: LoggerService,
    private hotReloadCoordinator: HotReloadCoordinator
  ) {
    super();
  }
  
  async getIgnorePatterns(projectPath: string): Promise<string[]> {
    if (this.rules.has(projectPath)) {
      return this.rules.get(projectPath)!;
    }
    
    const patterns = await this.loadIgnorePatterns(projectPath);
    this.rules.set(projectPath, patterns);
    
    // 注册文件监听
    await this.registerFileWatchers(projectPath);
    
    return patterns;
  }
  
  private async loadIgnorePatterns(projectPath: string): Promise<string[]> {
    const patterns: string[] = [];
    const sources: RuleSource[] = [];
    
    // 1. 默认规则
    patterns.push(...UNIFIED_DEFAULT_IGNORE_PATTERNS);
    sources.push({ type: 'default', count: UNIFIED_DEFAULT_IGNORE_PATTERNS.length });
    
    // 2. .gitignore 规则
    const gitignorePatterns = await GitignoreParser.getAllGitignorePatterns(projectPath);
    patterns.push(...gitignorePatterns);
    sources.push({ type: 'gitignore', count: gitignorePatterns.length });
    
    // 3. .indexignore 规则
    const indexignorePatterns = await GitignoreParser.parseIndexignore(projectPath);
    patterns.push(...indexignorePatterns);
    sources.push({ type: 'indexignore', count: indexignorePatterns.length });
    
    this.ruleSources.set(projectPath, sources);
    return [...new Set(patterns)]; // 去重
  }
  
  private async registerFileWatchers(projectPath: string): Promise<void> {
    const filesToWatch = [
      path.join(projectPath, '.gitignore'),
      path.join(projectPath, '.indexignore')
    ];
    
    // 添加子目录的 .gitignore 文件
    const subDirs = await this.getSubDirectories(projectPath);
    for (const subDir of subDirs) {
      filesToWatch.push(path.join(subDir, '.gitignore'));
    }
    
    await this.hotReloadCoordinator.startWatching(projectPath, filesToWatch);
  }
  
  private async handleRuleFileChange(projectPath: string, filePath: string): Promise<void> {
    this.logger.info(`Ignore rule file changed: ${filePath} for project: ${projectPath}`);
    
    // 重新加载规则
    const newPatterns = await this.loadIgnorePatterns(projectPath);
    this.rules.set(projectPath, newPatterns);
    
    // 发出规则变化事件
    this.emit('rulesChanged', projectPath, newPatterns, filePath);
  }
}
```

### 热更新协调器
```typescript
export class HotReloadCoordinator {
  private fileWatchers: Map<string, Map<string, FSWatcher>> = new Map();
  private eventListeners: Map<string, Set<(event: FileChangeEvent) => void>> = new Map();
  
  async startWatching(projectPath: string, files: string[]): Promise<void> {
    if (!this.fileWatchers.has(projectPath)) {
      this.fileWatchers.set(projectPath, new Map());
    }
    
    const projectWatchers = this.fileWatchers.get(projectPath)!;
    
    for (const file of files) {
      // 避免重复监听同一文件
      if (projectWatchers.has(file)) {
        continue;
      }
      
      try {
        const watcher = fsSync.watch(file, (eventType) => {
          if (eventType === 'change') {
            this.handleFileChange(projectPath, file);
          }
        });
        
        projectWatchers.set(file, watcher);
      } catch (error) {
        // 文件不存在，创建轮询检查
        this.createPollingWatcher(projectPath, file);
      }
    }
  }
  
  private handleFileChange(projectPath: string, filePath: string): void {
    const event: FileChangeEvent = {
      type: 'change',
      path: filePath,
      timestamp: new Date()
    };
    
    // 通知所有监听器
    const listeners = this.eventListeners.get(projectPath);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
  
  addEventListener(projectPath: string, listener: (event: FileChangeEvent) => void): void {
    if (!this.eventListeners.has(projectPath)) {
      this.eventListeners.set(projectPath, new Set());
    }
    
    this.eventListeners.get(projectPath)!.add(listener);
  }
  
  removeEventListener(projectPath: string, listener: (event: FileChangeEvent) => void): void {
    const listeners = this.eventListeners.get(projectPath);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}
```

## 测试策略

### 单元测试
1. `UnifiedIgnoreRuleService` 的规则加载和缓存
2. `IgnoreConfigFactory` 的配置生成
3. `HotReloadCoordinator` 的文件监听管理

### 集成测试
1. 忽略规则热更新流程
2. 多模块协作测试
3. 性能测试

### 回归测试
1. 确保现有功能不受影响
2. 验证配置一致性
3. 测试边界情况

## 风险评估

### 高风险
1. 大规模重构可能引入新的 bug
2. 性能可能受到影响

### 中风险
1. 现有接口可能需要调整
2. 测试覆盖可能不足

### 低风险
1. 配置格式变化
2. 日志格式调整

## 缓解措施

1. **分阶段实施**：每个阶段都有明确的测试验证
2. **向后兼容**：保留现有接口，逐步迁移
3. **详细测试**：确保每个组件都有充分的测试覆盖
4. **性能监控**：在实施过程中持续监控性能指标
5. **回滚计划**：准备快速回滚方案，以防出现问题

## 总结

通过这个整合方案，我们可以：
1. 消除代码重复，提高维护性
2. 优化资源使用，提高性能
3. 统一配置管理，确保一致性
4. 建立清晰的架构，便于未来扩展

这个方案既解决了当前的问题，又为未来的发展提供了良好的基础。