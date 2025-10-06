# 索引配置

## 概述

索引配置用于控制代码库索引过程的各个方面，包括批处理大小、并发数、超时设置、重试机制等。

## 配置项说明

### 索引基础配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `INDEXING_BATCH_SIZE` | `50` | 索引批处理大小 |
| `INDEXING_MAX_CONCURRENCY` | `3` | 索引最大并发数 |
| `INDEXING_ENABLE_PARALLEL` | `true` | 是否启用并行索引 |
| `INDEXING_TIMEOUT_MS` | `3000` | 索引操作超时时间（毫秒） |
| `INDEXING_RETRY_ATTEMPTS` | `3` | 索引重试次数 |
| `INDEXING_ENABLE_INCREMENTAL` | `true` | 是否启用增量索引 |
| `INDEXING_STRATEGY` | `smart` | 索引策略，可选值：`full`, `incremental`, `smart` |
| `INDEXING_ENABLE_AUTO_OPTIMIZATION` | `true` | 是否启用自动优化 |
| `INDEXING_OPTIMIZATION_THRESHOLD` | `1000` | 自动优化阈值 |

## 使用这些配置项的文件

### 1. 索引配置服务
- **文件**: `src/config/service/IndexingConfigService.ts`
- **用途**: 管理索引配置参数，加载环境变量并验证配置

### 2. 索引服务
- **文件**: `src/service/index/IndexService.ts`
- **用途**: 使用索引配置控制索引过程的各个方面

### 3. 索引逻辑服务
- **文件**: `src/service/index/IndexingLogicService.ts`
- **用途**: 根据配置执行具体的索引逻辑

### 4. 项目配置服务
- **文件**: `src/config/service/ProjectConfigService.ts`
- **用途**: 使用索引配置管理项目级别的索引设置

## 配置验证

索引配置会在索引过程开始前进行验证，确保批处理大小、并发数等参数在合理范围内。

## 示例配置

```bash
# 默认配置
INDEXING_BATCH_SIZE=50
INDEXING_MAX_CONCURRENCY=3
INDEXING_ENABLE_PARALLEL=true
INDEXING_TIMEOUT_MS=300000
INDEXING_RETRY_ATTEMPTS=3
INDEXING_ENABLE_INCREMENTAL=true
INDEXING_STRATEGY=smart
INDEXING_ENABLE_AUTO_OPTIMIZATION=true
INDEXING_OPTIMIZATION_THRESHOLD=1000

# 高性能配置（适用于大型项目）
INDEXING_BATCH_SIZE=100
INDEXING_MAX_CONCURRENCY=5
INDEXING_ENABLE_PARALLEL=true
INDEXING_TIMEOUT_MS=600000
INDEXING_RETRY_ATTEMPTS=5
INDEXING_ENABLE_INCREMENTAL=true
INDEXING_STRATEGY=smart
INDEXING_ENABLE_AUTO_OPTIMIZATION=true
INDEXING_OPTIMIZATION_THRESHOLD=2000

# 低资源环境配置
INDEXING_BATCH_SIZE=20
INDEXING_MAX_CONCURRENCY=1
INDEXING_ENABLE_PARALLEL=false
INDEXING_TIMEOUT_MS=1800
INDEXING_RETRY_ATTEMPTS=2
INDEXING_ENABLE_INCREMENTAL=true
INDEXING_STRATEGY=incremental
INDEXING_ENABLE_AUTO_OPTIMIZATION=false
INDEXING_OPTIMIZATION_THRESHOLD=500
```

## 配置项详细说明

- `INDEXING_BATCH_SIZE`: 控制每次索引操作处理的文件或代码块数量
- `INDEXING_MAX_CONCURRENCY`: 控制同时进行的索引操作数量
- `INDEXING_ENABLE_PARALLEL`: 是否启用并行索引以提高性能
- `INDEXING_TIMEOUT_MS`: 索引操作的超时时间，防止长时间挂起
- `INDEXING_RETRY_ATTEMPTS`: 索引失败时的重试次数
- `INDEXING_ENABLE_INCREMENTAL`: 是否启用增量索引，只索引变更的部分
- `INDEXING_STRATEGY`: 索引策略，控制如何进行索引
  - `full`: 完整索引整个项目
  - `incremental`: 只索引变更的部分
  - `smart`: 智能选择索引策略
- `INDEXING_ENABLE_AUTO_OPTIMIZATION`: 是否在索引过程中自动优化
- `INDEXING_OPTIMIZATION_THRESHOLD`: 触发自动优化的数据量阈值