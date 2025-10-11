# 内存配置

## 概述

内存配置用于控制应用程序的内存使用和管理，包括内存阈值、最大内存限制和垃圾回收设置。

## 配置项说明

### 内存管理配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MEMORY_THRESHOLD` | `0.80` | 内存使用阈值（0-1的小数形式，如0.80表示80%） |
| `BATCH_MEMORY_THRESHOLD` | `0.80` | 批处理操作内存阈值（0-1的小数形式） |
| `MAX_MEMORY_MB` | `2048` | 最大内存限制（MB） |
| `MEMORY_WARNING_THRESHOLD` | `0.90` | 内存使用警告阈值（0-1的小数形式） |
| `MEMORY_CRITICAL_THRESHOLD` | `0.94` | 内存使用临界阈值（0-1的小数形式） |
| `MEMORY_EMERGENCY_THRESHOLD` | `0.98` | 内存使用紧急阈值（0-1的小数形式） |
| `NODE_OPTIONS` | `--max-old-space-size=2048` | Node.js运行时内存选项 |

## 使用这些配置项的文件

### 1. 批处理配置服务
- **文件**: `src/config/service/BatchProcessingConfigService.ts`
- **用途**: 使用MEMORY_THRESHOLD和BATCH_MEMORY_THRESHOLD配置批处理操作的内存管理

### 2. 存储服务
- **文件**: `ref/src/service/storage/BatchProcessingService.ts`
- **用途**: 根据内存阈值控制批处理操作

### 3. 图批处理优化器
- **文件**: `src/service/graph/performance/GraphBatchOptimizer.ts`
- **用途**: 使用内存阈值调整批处理大小

### 4. 通用批处理优化器
- **文件**: `src/infrastructure/batching/BatchOptimizer.ts`
- **用途**: 根据内存使用情况优化批处理操作

### 5. 主应用入口
- **文件**: `src/main.ts`
- **用途**: 使用NODE_OPTIONS设置Node.js运行时内存限制

## 配置验证

内存配置会在应用程序启动时进行验证，确保内存阈值在合理范围内（0-1的小数形式）。

## 示例配置

```bash
# 默认配置
MEMORY_THRESHOLD=0.80
BATCH_MEMORY_THRESHOLD=0.80
MAX_MEMORY_MB=2048
MEMORY_WARNING_THRESHOLD=0.90
MEMORY_CRITICAL_THRESHOLD=0.94
MEMORY_EMERGENCY_THRESHOLD=0.98
NODE_OPTIONS=--max-old-space-size=2048

# 高内存环境配置
MEMORY_THRESHOLD=0.80
BATCH_MEMORY_THRESHOLD=0.80
MAX_MEMORY_MB=4096
MEMORY_WARNING_THRESHOLD=0.85
MEMORY_CRITICAL_THRESHOLD=0.90
MEMORY_EMERGENCY_THRESHOLD=0.95
NODE_OPTIONS=--max-old-space-size=4096

# 低内存环境配置
MEMORY_THRESHOLD=0.60
BATCH_MEMORY_THRESHOLD=0.60
MAX_MEMORY_MB=1024
MEMORY_WARNING_THRESHOLD=0.75
MEMORY_CRITICAL_THRESHOLD=0.85
MEMORY_EMERGENCY_THRESHOLD=0.90
NODE_OPTIONS=--max-old-space-size=1024
```

## 配置项详细说明

- `MEMORY_THRESHOLD`: 一般内存使用阈值，超过此值可能触发优化措施
- `BATCH_MEMORY_THRESHOLD`: 批处理操作的内存阈值，用于控制批处理大小
- `MAX_MEMORY_MB`: 应用程序最大可用内存量
- `MEMORY_WARNING_THRESHOLD`: 发出内存使用警告的阈值
- `MEMORY_CRITICAL_THRESHOLD`: 内存使用临界阈值，可能影响性能
- `MEMORY_EMERGENCY_THRESHOLD`: 内存使用紧急阈值，需要立即采取措施
- `NODE_OPTIONS`: Node.js运行时选项，用于设置V8引擎的内存限制