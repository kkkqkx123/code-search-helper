# 监控配置

## 概述

监控配置用于控制应用程序的性能监控、指标收集和健康检查功能。

## 配置项说明

### 基础监控配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `ENABLE_METRICS` | `true` | 是否启用指标收集 |
| `METRICS_PORT` | `9090` | 指标服务端口 |
| `PROMETHEUS_TARGET_DIR` | `./etc/prometheus` | Prometheus配置目录路径 |

### 搜索配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SEARCH_MOCK_MODE` | `false` | 是否启用搜索模拟模式 |

## 使用这些配置项的文件

### 1. 监控配置服务
- **文件**: `src/config/service/MonitoringConfigService.ts` (可能在BatchProcessingConfigService中)
- **用途**: 管理监控配置参数，加载环境变量并验证配置

### 2. 性能监控服务
- **文件**: `src/infrastructure/monitoring/PerformanceMonitor.ts`
- **用途**: 使用监控配置进行性能指标收集和分析

### 3. 批处理配置服务
- **文件**: `src/config/service/BatchProcessingConfigService.ts`
- **用途**: 包含监控相关的配置，如指标间隔和警报阈值

### 4. 主应用入口
- **文件**: `src/main.ts`
- **用途**: 根据监控配置决定是否启动指标服务

## 配置验证

监控配置会在应用程序启动时进行验证，确保端口和路径等参数有效。

## 示例配置

```bash
# 启用监控
ENABLE_METRICS=true
METRICS_PORT=9090
PROMETHEUS_TARGET_DIR=./etc/prometheus

# 禁用监控（测试环境）
ENABLE_METRICS=false

# 自定义指标端口
ENABLE_METRICS=true
METRICS_PORT=9091
```

## 监控功能说明

- `ENABLE_METRICS`: 控制是否收集和暴露应用程序性能指标
- `METRICS_PORT`: Prometheus等监控工具可以从此端口获取指标数据
- `PROMETHEUS_TARGET_DIR`: 指定Prometheus配置文件目录
- `SEARCH_MOCK_MODE`: 在测试环境中启用搜索模拟，避免实际查询数据库