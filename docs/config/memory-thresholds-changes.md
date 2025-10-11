# 内存阈值配置变更说明

## 变更概述

为了统一内存阈值的配置格式并适应高内存使用率的开发环境，我们对内存相关配置项进行了以下调整：

## 主要变更

### 1. 配置格式统一
- **变更前**: 内存阈值使用百分比值（如 75、80、90）
- **变更后**: 统一使用0-1的小数形式（如 0.75、0.80、0.90）

### 2. 内存监控阈值调整
为了适应高内存使用率的开发环境，提高了内存监控的触发阈值：

- **警告阈值**: 0.85 → 0.90 (85% → 90%)
- **严重阈值**: 0.90 → 0.94 (90% → 94%)
- **紧急阈值**: 0.95 → 0.98 (95% → 98%)

## 受影响的配置项

| 配置项 | 变更前 | 变更后 | 说明 |
|--------|--------|--------|------|
| `MEMORY_THRESHOLD` | `75` | `0.80` | 一般内存使用阈值 |
| `BATCH_MEMORY_THRESHOLD` | `75` | `0.80` | 批处理操作内存阈值 |
| `INFRA_QDRANT_BATCH_MEMORY_THRESHOLD` | `80` | `0.80` | Qdrant批处理内存阈值 |
| `INFRA_NEBULA_BATCH_MEMORY_THRESHOLD` | `80` | `0.80` | Nebula批处理内存阈值 |
| `MEMORY_WARNING_THRESHOLD` | `0.85` | `0.90` | 内存警告阈值 |
| `MEMORY_CRITICAL_THRESHOLD` | `0.90` | `0.94` | 内存严重阈值 |
| `MEMORY_EMERGENCY_THRESHOLD` | `0.95` | `0.98` | 内存紧急阈值 |

## 受影响的代码文件

### 核心配置服务
- `src/config/service/MemoryMonitorConfigService.ts`
- `src/config/service/BatchProcessingConfigService.ts`
- `src/infrastructure/config/InfrastructureConfigService.ts`

### 内存监控服务
- `src/service/memory/MemoryMonitorService.ts`

### 环境变量工具
- `src/config/utils/environment-variables.ts` (使用 parseRateEnv 函数)

## 配置验证更新

- `BatchProcessingConfigService.ts` 中的验证范围从 `10-95` 更新为 `0.1-0.95`
- `InfrastructureConfigService.ts` 使用 `getEnvFloatValue` 替代 `getEnvNumberValue`

## 迁移指南

### 对于新环境
直接使用新的0-1格式配置即可：

```bash
MEMORY_THRESHOLD=0.80
BATCH_MEMORY_THRESHOLD=0.80
MEMORY_WARNING_THRESHOLD=0.90
MEMORY_CRITICAL_THRESHOLD=0.94
MEMORY_EMERGENCY_THRESHOLD=0.98
```

### 对于现有环境
如果您的环境仍在使用旧的百分比值，系统会自动转换：
- 旧配置：`MEMORY_THRESHOLD=75`
- 新配置：`MEMORY_THRESHOLD=0.75`

建议尽快更新为新的0-1格式以确保一致性。

## 兼容性说明

- 代码中已添加了对新旧格式的兼容处理
- 使用 `parseRateEnv` 函数可以正确处理0-1的小数值
- 环境变量映射保持不变

## 测试验证

变更已通过以下测试：
1. 配置服务初始化测试
2. 内存监控阈值验证测试
3. 批处理配置加载测试
4. 环境变量解析测试

## 注意事项

1. 所有内存阈值现在必须使用0-1的小数形式
2. 确保配置文件中的值不超过1.0
3. 更新相关的部署脚本和配置管理工具
4. 监控应用程序的内存使用行为，确保新阈值适合您的环境

## 相关文档

- [内存配置文档](./env/memory-config.md)
- [环境变量概览](./env/overview.md)
- [基础设施配置](./env/infrastructure-config.md)