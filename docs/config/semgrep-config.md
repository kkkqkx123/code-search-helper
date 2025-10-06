# 静态分析配置 (Semgrep)

## 概述

静态分析配置用于控制Semgrep静态代码分析工具的集成和使用，包括启用状态、CLI路径、规则目录、超时设置等。

## 配置项说明

### Semgrep基础配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SEMGREP_ENABLED` | `true` | 是否启用Semgrep静态分析 |
| `SEMGREP_CLI_PATH` | `semgrep` | Semgrep CLI工具路径 |
| `SEMGREP_RULES_DIR` | `./config/semgrep-rules` | Semgrep规则目录路径 |
| `SEMGREP_TIMEOUT` | `300` | Semgrep分析超时时间（秒） |

### Semgrep高级配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SEMGREP_MAX_TARGET_BYTES` | `1000000` | 单次扫描最大目标字节数 |
| `SEMGREP_MAX_CONCURRENT_SCANS` | `5` | 最大并发扫描数 |
| `SEMGREP_CACHE_ENABLED` | `true` | 是否启用扫描结果缓存 |
| `SEMGREP_CACHE_TTL` | `3600` | 扫描结果缓存生存时间（秒） |
| `SEMGREP_SCAN_ON_CHANGE` | `true` | 文件变更时是否自动扫描 |
| `SEMGREP_RESULT_RETENTION_DAYS` | `30` | 扫描结果保留天数 |

### Semgrep增强规则配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SEMGREP_ENHANCED_RULES_PATH` | `./config/enhanced-rules` | 增强规则路径 |

### Semgrep二进制路径配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SEMGREP_BINARY_PATH` | `semgrep` | Semgrep二进制文件路径 |

### Semgrep功能配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `SEMGREP_ENABLE_CONTROL_FLOW` | `false` | 是否启用控制流分析 |
| `SEMGREP_ENABLE_DATA_FLOW` | `false` | 是否启用数据流分析 |
| `SEMGREP_ENABLE_TAINT_ANALYSIS` | `false` | 是否启用污点分析 |

## 使用这些配置项的文件

### 1. Semgrep配置服务
- **文件**: `src/config/service/SemgrepConfigService.ts`
- **用途**: 管理Semgrep配置参数，加载环境变量并验证配置

### 2. 静态分析服务
- **文件**: `ref/src/service/graph/StaticAnalysisService.ts` (可能在其他位置)
- **用途**: 使用Semgrep配置执行静态代码分析

### 3. 代码分析协调器
- **文件**: `ref/src/service/storage/StorageCoordinator.ts` (可能在其他位置)
- **用途**: 集成Semgrep分析结果到存储流程

## 配置验证

Semgrep配置会在应用程序启动时进行验证，确保CLI路径和规则目录存在且可访问。

## 示例配置

```bash
# 默认配置
SEMGREP_ENABLED=true
SEMGREP_CLI_PATH=semgrep
SEMGREP_RULES_DIR=./config/semgrep-rules
SEMGREP_TIMEOUT=300
SEMGREP_MAX_TARGET_BYTES=1000000
SEMGREP_MAX_CONCURRENT_SCANS=5
SEMGREP_CACHE_ENABLED=true
SEMGREP_CACHE_TTL=3600
SEMGREP_SCAN_ON_CHANGE=true
SEMGREP_RESULT_RETENTION_DAYS=30
SEMGREP_ENHANCED_RULES_PATH=./config/enhanced-rules
SEMGREP_BINARY_PATH=semgrep
SEMGREP_ENABLE_CONTROL_FLOW=false
SEMGREP_ENABLE_DATA_FLOW=false
SEMGREP_ENABLE_TAINT_ANALYSIS=false

# 高性能配置
SEMGREP_ENABLED=true
SEMGREP_CLI_PATH=/usr/local/bin/semgrep
SEMGREP_RULES_DIR=./config/semgrep-rules
SEMGREP_TIMEOUT=600
SEMGREP_MAX_TARGET_BYTES=5000000
SEMGREP_MAX_CONCURRENT_SCANS=10
SEMGREP_CACHE_ENABLED=true
SEMGREP_CACHE_TTL=7200
SEMGREP_SCAN_ON_CHANGE=true
SEMGREP_RESULT_RETENTION_DAYS=60
SEMGREP_ENHANCED_RULES_PATH=./config/enhanced-rules
SEMGREP_BINARY_PATH=/usr/local/bin/semgrep
SEMGREP_ENABLE_CONTROL_FLOW=true
SEMGREP_ENABLE_DATA_FLOW=true
SEMGREP_ENABLE_TAINT_ANALYSIS=true

# 低资源环境配置
SEMGREP_ENABLED=false
SEMGREP_CLI_PATH=semgrep
SEMGREP_RULES_DIR=./config/semgrep-rules
SEMGREP_TIMEOUT=180
SEMGREP_MAX_TARGET_BYTES=50000
SEMGREP_MAX_CONCURRENT_SCANS=2
SEMGREP_CACHE_ENABLED=true
SEMGREP_CACHE_TTL=1800
SEMGREP_SCAN_ON_CHANGE=false
SEMGREP_RESULT_RETENTION_DAYS=7
```

## 配置项详细说明

- `SEMGREP_ENABLED`: 控制是否启用Semgrep静态分析功能
- `SEMGREP_CLI_PATH`: Semgrep命令行工具的路径
- `SEMGREP_RULES_DIR`: Semgrep规则文件的目录路径
- `SEMGREP_TIMEOUT`: 单次扫描操作的超时时间
- `SEMGREP_MAX_TARGET_BYTES`: 单次扫描处理的最大文件字节数
- `SEMGREP_MAX_CONCURRENT_SCANS`: 同时执行的最大扫描数量
- `SEMGREP_CACHE_ENABLED`: 是否缓存扫描结果以提高性能
- `SEMGREP_CACHE_TTL`: 缓存结果的有效时间
- `SEMGREP_SCAN_ON_CHANGE`: 文件变更时是否自动触发扫描
- `SEMGREP_RESULT_RETENTION_DAYS`: 扫描结果的保留天数
- `SEMGREP_ENHANCED_RULES_PATH`: 增强规则的路径
- `SEMGREP_BINARY_PATH`: Semgrep二进制文件的路径
- `SEMGREP_ENABLE_CONTROL_FLOW`: 是否启用控制流分析功能
- `SEMGREP_ENABLE_DATA_FLOW`: 是否启用数据流分析功能
- `SEMGREP_ENABLE_TAINT_ANALYSIS`: 是否启用污点分析功能