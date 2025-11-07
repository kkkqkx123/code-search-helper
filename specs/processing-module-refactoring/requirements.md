# 代码处理模块重构需求规格说明

## 概述

本文档描述了对 `src/service/parser/processing` 目录下混乱模块的重构需求。基于对上游模块（TreeSitterCoreService、DynamicParserManager、TreeSitterService）和下游模块（ChunkToVectorCoordinationService、GraphDataMappingService）的分析，当前模块存在功能重叠、配置管理混乱、模块边界不清等问题，需要通过重构建立清晰的模块结构、统一的配置体系和高效的组件复用机制。

## 模块职责分析

### 上游模块职责
- **TreeSitterCoreService**: 提供AST解析、语言检测、查询执行等核心功能
- **DynamicParserManager**: 管理动态解析器加载、缓存和性能优化
- **TreeSitterService**: 提供统一的TreeSitter服务接口，委托给核心服务

### 下游模块职责
- **ChunkToVectorCoordinationService**: 协调代码分段到向量嵌入的转换，处理文件级别的协调工作
- **GraphDataMappingService**: 将代码块和分析结果映射为图数据库节点和关系

### Processing模块的核心职责
基于上下游分析，Processing模块应该专注于：
1. **代码分割策略**: 实现各种代码分割算法（行级、语义、AST、括号平衡等）
2. **后处理优化**: 对分割结果进行合并、过滤、重平衡等优化
3. **策略协调**: 选择合适的分割策略并协调执行
4. **结果标准化**: 提供统一的分割结果格式

### Processing模块不应承担的职责
- **AST解析**: 由上游TreeSitter模块负责
- **语言检测**: 由上游Detection模块负责
- **向量嵌入**: 由下游ChunkToVectorCoordinationService负责
- **图映射**: 由下游GraphDataMappingService负责
- **文件I/O操作**: 由调用方负责
- **系统级错误处理**: 由Infrastructure模块负责

## 模块需求说明

### 1. 核心模块 (core/)

**作用**: 定义整个处理系统的基础接口和类型，提供模块间的契约保障

**包含文件**:
- `core/interfaces/IProcessingStrategy.ts` - 处理策略接口
- `core/interfaces/IStrategyFactory.ts` - 策略工厂接口
- `core/interfaces/IProcessingContext.ts` - 处理上下文接口
- `core/interfaces/IPostProcessor.ts` - 后处理器接口
- `core/interfaces/IConfigManager.ts` - 配置管理器接口
- `core/types/ProcessingTypes.ts` - 处理相关类型定义
- `core/types/ContextTypes.ts` - 上下文类型定义
- `core/types/ResultTypes.ts` - 结果类型定义
- `core/types/ConfigTypes.ts` - 配置类型定义
- `core/index.ts` - 核心模块统一导出

**协作模块**:
- 为 `strategies/` 模块提供基础接口
- 为 `factory/` 模块提供工厂接口
- 为 `coordinator/` 模块提供上下文和结果类型
- 为 `post-processing/` 模块提供后处理器接口

### 2. 类型系统模块 (types/) - 重新设计

**作用**: 提供统一的类型定义系统，替代原有的分散类型定义，确保类型一致性和复用性

**包含文件**:
- `types/CodeChunk.ts` - 代码块核心类型定义
  - `CodeChunk` 接口 - 统一的代码块结构
  - `ChunkMetadata` 接口 - 代码块元数据
  - `ChunkType` 枚举 - 代码块类型分类
- `types/Processing.ts` - 处理相关类型定义
  - `ProcessingResult` 接口 - 处理结果结构
  - `ProcessingOptions` 接口 - 处理选项配置
  - `ProcessingStrategy` 枚举 - 处理策略类型
- `types/Context.ts` - 上下文类型定义
  - `ProcessingContext` 接口 - 统一处理上下文
  - `ContextMetadata` 接口 - 上下文元数据
  - `ContextBuilder` 类 - 上下文构建器
- `types/Config.ts` - 配置类型定义
  - `ProcessingConfig` 接口 - 主配置结构
  - `ChunkingConfig` 接口 - 分块配置
  - `PerformanceConfig` 接口 - 性能配置
  - `LanguageConfig` 接口 - 语言配置
- `types/PostProcessing.ts` - 后处理类型定义
  - `PostProcessor` 接口 - 统一后处理器接口
  - `PostProcessingContext` 接口 - 后处理上下文
  - `PostProcessingResult` 接口 - 后处理结果
- `types/Strategy.ts` - 策略类型定义
  - `StrategyConfig` 接口 - 策略配置
  - `StrategyResult` 接口 - 策略执行结果
  - `StrategyPerformance` 接口 - 策略性能统计
- `types/Utils.ts` - 工具类型定义
  - `FileFeatures` 接口 - 文件特征
  - `LanguageFeatures` 接口 - 语言特征
  - `ComplexityMetrics` 接口 - 复杂度指标
- `types/index.ts` - 类型模块统一导出

**类型设计原则**:
1. **统一性**: 所有相关类型集中定义，避免重复
2. **层次性**: 类型按功能模块分层，便于管理
3. **扩展性**: 支持类型扩展和泛型，便于未来扩展
4. **兼容性**: 保持与现有代码的兼容性，提供类型适配器

**协作模块**:
- 为所有其他模块提供类型定义
- 替代原有的 `splitting-types.ts` 和 `Context.ts`
- 为 `post-processing/` 模块提供统一的类型支持
- 为 `strategies/` 模块提供策略相关类型
- 为 `src\service\parser\config\UnifiedConfigManager.ts` 模块提供策略相关类型

### 3. 策略模块 (strategies/)

**作用**: 实现各种代码分割策略，提供可扩展的策略体系

**包含文件**:
- `strategies/base/BaseStrategy.ts` - 策略基类，提供通用实现
- `strategies/implementations/LineStrategy.ts` - 行级分割策略
- `strategies/implementations/SemanticStrategy.ts` - 语义分割策略
- `strategies/implementations/ASTStrategy.ts` - AST分割策略
- `strategies/implementations/BracketStrategy.ts` - 括号平衡策略
- `strategies/index.ts` - 策略模块统一导出

**协作模块**:
- 依赖 `core/` 模块的接口定义
- 使用 `types/` 模块的类型定义
- 与 `factory/` 模块协作进行策略创建
- 与 `coordinator/` 模块协作进行策略执行
- 使用 `utils/` 模块的工具函数

### 4. 工厂模块 (factory/)

**作用**: 创建和管理策略实例，提供策略的注册、创建和缓存功能

**包含文件**:
- `factory/StrategyFactory.ts` - 策略工厂实现
- `factory/index.ts` - 工厂模块导出

**协作模块**:
- 依赖 `core/` 模块的工厂接口
- 使用 `types/` 模块的类型定义
- 管理 `strategies/` 模块的所有策略实例
- 为 `coordinator/` 模块提供策略创建服务
- 使用 `config/` 模块的配置信息

### 5. 协调器模块 (coordinator/)

**作用**: 协调代码分割策略的选择和执行，管理分割流程

**包含文件**:
- `coordinator/ProcessingCoordinator.ts` - 主协调器实现
- `coordinator/index.ts` - 协调器模块导出

**核心职责**:
- 根据输入特征选择合适的分割策略
- 协调策略执行和后处理流程
- 提供统一的分割接口给下游模块

**协作模块**:
- 使用 `core/` 模块的接口和类型
- 使用 `types/` 模块的类型定义
- 通过 `factory/` 模块获取策略实例
- 调用 `strategies/` 模块执行具体策略
- 协调 `post-processing/` 模块进行后处理
- 接收上游模块的AST和语言检测结果

### 6. 后处理模块 (post-processing/) - 使用新的类型定义

**作用**: 对分割结果进行优化和调整，提高代码块质量

**包含文件**:
- `post-processing/processors/AdvancedMergingPostProcessor.ts` - 高级合并处理器
- `post-processing/processors/BoundaryOptimizationPostProcessor.ts` - 边界优化处理器
- `post-processing/processors/IntelligentFilterPostProcessor.ts` - 智能过滤处理器
- `post-processing/processors/OverlapPostProcessor.ts` - 重叠处理器
- `post-processing/processors/SmartRebalancingPostProcessor.ts` - 智能重平衡处理器
- `post-processing/processors/SymbolBalancePostProcessor.ts` - 符号平衡处理器
- `post-processing/PostProcessorCoordinator.ts` - 后处理协调器
- `post-processing/IPostProcessor.ts` - 后处理器接口（重构）
- `post-processing/index.ts` - 后处理模块导出

**核心职责**:
- 优化分割结果的质量和结构
- 提供多种后处理算法
- 支持可配置的后处理流程

**类型系统更新**:
- 使用 `types/PostProcessing.ts` 中定义的统一接口
- 替代原有的 `IChunkPostProcessor` 接口
- 使用 `types/CodeChunk.ts` 中的 `CodeChunk` 类型
- 使用 `types/Context.ts` 中的上下文类型
- 使用 `types/Config.ts` 中的配置类型

**协作模块**:
- 实现 `core/` 模块定义的后处理器接口
- 使用 `types/` 模块的统一类型定义
- 接收 `coordinator/` 模块的处理结果
- 使用 `utils/` 模块的工具函数
- 使用 `constants/` 模块的常量定义

### 7. 常量模块 (constants/)

**作用**: 定义processing模块专用的常量和配置参数

**包含文件**:
- `constants/processing-constants.ts` - 处理相关常量
- `constants/priority-constants.ts` - 优先级常量
- `constants/index.ts` - 常量模块导出

**协作模块**:
- 为 `strategies/` 模块提供策略常量
- 为 `post-processing/` 模块提供处理参数
- 为 `coordinator/` 模块提供配置常量

### 8. 工具模块 (utils/)

**作用**: 提供processing模块专用的工具函数和算法

**包含文件**:
- `utils/SemanticBoundaryAnalyzer.ts` - 语义边界分析器
- `utils/ChunkRebalancer.ts` - 块重平衡器
- `utils/index.ts` - 工具模块导出

**协作模块**:
- 使用 `types/` 模块的类型定义
- 为 `strategies/` 模块提供算法支持
- 为 `post-processing/` 模块提供优化工具
- 为 `coordinator/` 模块提供辅助函数

### 9. 配置模块 (src/service/parser/config/) 

**作用**: 提供parser级别的统一配置管理服务

**包含文件**:
- `config/ProcessingConfig.ts` - 配置接口定义
- `config/ConfigManager.ts` - 配置管理器实现
- `config/LanguageConfigs.ts` - 语言特定配置
- `config/DefaultConfigs.ts` - 默认配置定义
- `config/index.ts` - 配置模块导出

**协作模块**:
- 使用 `types/` 模块的配置类型定义
- 为整个 `parser/` 模块提供配置服务
- 与 `detection/` 模块协作提供检测配置
- 与 `processing/` 模块协作提供处理配置

### 10. 检测模块 (src/service/parser/detection/detection/)

**作用**: 提供parser级别的文件特征检测和语言识别服务

**包含文件**:
- `detection/FileFeatureDetector.ts` - 文件特征检测器
- `detection/LanguageDetectionService.ts` - 语言检测服务
- `detection/BackupFileProcessor.ts` - 备份文件处理器
- `detection/UnifiedDetectionService.ts` - 统一检测服务
- `detection/IFileFeatureDetector.ts` - 检测器接口
- `detection/index.ts` - 检测模块导出

**协作模块**:
- 使用 `types/` 模块的类型定义
- 为整个 `parser/` 模块提供检测服务
- 与 `config/` 模块协作获取检测配置
- 为 `processing/` 模块提供文件特征信息

### 11. Parser通用工具模块 (src/service/parser/utils/)

**作用**: 提供parser级别的通用工具类和函数

**包含文件**:
- `utils/language/FileUtils.ts` - 文件路径处理工具
- `utils/language/LanguageExtensionMap.ts` - 语言映射管理
- `utils/language/LanguageFeatureDetector.ts` - 智能语言检测
- `utils/language/LanguageWeights.ts` - 语言权重配置
- `utils/language/index.ts` - 语言工具导出
- `utils/ContentHashIDGenerator.ts` - 内容哈希生成器
- `utils/SyntaxValidator.ts` - 语法验证器
- `utils/index.ts` - 工具模块导出

**协作模块**:
- 使用 `types/` 模块的类型定义
- 为整个 `parser/` 模块提供通用工具
- 与 `detection/` 模块协作进行语言检测
- 与 `config/` 模块协作进行配置管理

### 12. Parser通用常量模块 (src/service/parser/constants/)`

**作用**: 定义parser级别的通用常量

**包含文件**:
- `constants/language-constants.ts` - 语言相关常量
- `constants/backup-constants.ts` - 备份文件常量
- `constants/index.ts` - 常量模块导出

**协作模块**:
- 为整个 `parser/` 模块提供常量定义
- 与 `detection/` 模块协作提供检测常量
- 与 `utils/` 模块协作提供工具常量

### 13. 基础设施工具模块 (src/infrastructure/)

**作用**: 提供系统级别的基础设施服务

**包含文件**:
- `infrastructure/monitoring/` - 性能监控工具
- `infrastructure/protection/` - 保护机制
- `infrastructure/caching/` - 缓存服务

**协作模块**:
- 为整个系统提供基础设施服务
- 与 `processing/` 模块协作提供监控和保护
- 与 `parser/` 模块协作提供缓存服务

## 模块间依赖关系

### 核心依赖链
1. `core/` → 所有其他模块的基础依赖
2. `types/` → 为所有其他模块提供类型定义
3. `config/` → `core/` + `types/` + 为其他模块提供配置
4. `detection/` → `core/` + `types/` + `config/` + `constants/`
5. `utils/` → `core/` + `types/` + `constants/`
6. `strategies/` → `core/` + `types/` + `utils/` + `constants/`
7. `factory/` → `core/` + `types/` + `strategies/` + `config/`
8. `post-processing/` → `core/` + `types/` + `utils/` + `constants/`
9. `coordinator/` → `core/` + `types/` + `factory/` + `detection/` + `post-processing/`

### 外部依赖
1. `infrastructure/` → 为所有模块提供基础服务
2. `parser/utils/` → 为整个parser模块提供通用工具
3. `parser/constants/` → 为整个parser模块提供常量

### 类型系统依赖
- 所有模块都依赖 `types/` 模块提供的类型定义
- `types/` 模块替代了原有的分散类型定义文件
- 后处理模块完全使用新的类型系统，不再依赖旧的类型文件

## 重构目标

### 结构目标
1. 建立清晰的模块层次结构
2. 消除功能重叠和模块边界模糊
3. 实现高内聚、低耦合的模块设计
4. 提供统一的接口和类型定义

### 功能目标
1. 统一配置管理体系
2. 优化策略创建和管理机制
3. 简化处理流程和协调逻辑
4. 提高组件复用率

### 性能目标
1. 减少不必要的对象创建
2. 优化配置加载和缓存机制
3. 提高处理效率和响应速度
4. 降低内存使用和CPU消耗

### 质量目标
1. 提高代码可读性和可维护性
2. 增强类型安全和错误处理
3. 完善测试覆盖和文档
4. 保持向后兼容性
