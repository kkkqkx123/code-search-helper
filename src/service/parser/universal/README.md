
# 通用文件处理系统

本目录包含通用文件处理系统的实现，用于处理各种类型的文件，包括备份文件、无扩展名文件和内容与扩展名不匹配的文件。

## 组件概述

### 核心组件

1. **UniversalTextSplitter** - 通用文本分段器
   - 提供多种分段策略：语义边界分段、括号平衡分段、行数分段
   - 支持内存保护和大小限制
   - 适用于各种文件类型和内容

2. **ErrorThresholdManager** - 错误阈值管理器
   - 监控错误计数，当达到阈值时触发降级处理
   - 自动重置计数器
   - 强制清理缓存和临时对象

3. **MemoryGuard** - 内存监控和保护
   - 监控内存使用情况
   - 在达到限制时触发清理或降级处理
   - 提供内存使用历史和趋势分析

4. **BackupFileProcessor** - 备份文件处理器
   - 识别各种备份文件格式（.bak, .backup, .old, .tmp等）
   - 推断原始文件类型和语言
   - 支持Vim和Emacs等编辑器的备份文件

5. **ExtensionlessFileProcessor** - 无扩展名文件处理器
   - 基于内容检测语言类型
   - 支持shebang检测
   - 语法模式和文件结构模式匹配

6. **ProcessingGuard** - 处理保护器
   - 整合所有保护机制
   - 提供统一的文件处理接口
   - 智能选择处理策略

7. **UniversalProcessingConfig** - 配置管理
   - 管理所有配置参数
   - 支持环境变量配置
   - 提供配置验证功能

## 使用方法

### 基本使用

```typescript
import { ProcessingGuard } from './universal/ProcessingGuard';
import { LoggerService } from '../utils/LoggerService';

// 创建处理保护器
const logger = new LoggerService();
const processingGuard = new ProcessingGuard(logger);

// 初始化
processingGuard.initialize();

// 处理文件
const result = await processingGuard.processFile(filePath, content);
console.log(`处理结果: ${result.chunks.length} 个块, 语言: ${result.language}`);

// 销毁
processingGuard.destroy();
```

### 依赖注入

```typescript
import { Container } from 'inversify';
import { TYPES } from '../../types';
import { 
  ProcessingGuard,
  UniversalTextSplitter,
  ErrorThresholdManager,
  MemoryGuard,
  BackupFileProcessor,
  ExtensionlessFileProcessor
} from './universal';

// 注册依赖
const container = new Container();
container.bind<ProcessingGuard>(TYPES.ProcessingGuard).to(ProcessingGuard).inSingletonScope();
container.bind<UniversalTextSplitter>(TYPES.UniversalTextSplitter).to(UniversalTextSplitter).inSingletonScope();
container.bind<ErrorThresholdManager>(TYPES.ErrorThresholdManager).to(ErrorThresholdManager).inSingletonScope();
container.bind<MemoryGuard>(TYPES.MemoryGuard).to(MemoryGuard).inSingletonScope();
container.bind<BackupFileProcessor>(TYPES.BackupFileProcessor).to(BackupFileProcessor).inSingletonScope();
container.bind<ExtensionlessFileProcessor>(TYPES.ExtensionlessFileProcessor).to(ExtensionlessFileProcessor).inSingletonScope();

// 使用
const processingGuard = container.get<ProcessingGuard>(TYPES.ProcessingGuard);
```

## 配置

### 环境变量

可以通过以下环境变量配置系统行为：

```bash
# 错误处理配置
UNIVERSAL_MAX_ERRORS=5
UNIVERSAL_ERROR_RESET_INTERVAL=60000

# 内存限制配置
UNIVERSAL_MEMORY_LIMIT_MB=500
UNIVERSAL_MEMORY_CHECK_INTERVAL=5000

# 分段参数配置
UNIVERSAL_MAX_CHUNK_SIZE=2000
UNIVERSAL_CHUNK_OVERLAP=200
UNIVERSAL_MAX_LINES_PER_CHUNK=50

# 备份文件处理配置
UNIVERSAL_BACKUP_PATTERNS=.bak,.backup,.old,.tmp
```

### 程序配置

```typescript
import { UniversalProcessingConfig } from './universal/UniversalProcessingConfig';

const config = new UniversalProcessingConfig();

// 获取配置
const errorConfig = config.getErrorConfig();
const memoryConfig = config.getMemoryConfig();
const chunkingConfig = config.getChunkingConfig();
const backupConfig = config.getBackupFileConfig();

// 更新配置
config.setErrorConfig(10