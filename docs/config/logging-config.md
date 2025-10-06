# 日志配置

## 概述

日志配置用于控制应用程序的日志记录行为，包括日志级别和输出格式。

## 配置项说明

### 日志级别配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LOG_LEVEL` | `debug` | 日志级别，可选值：`debug`, `info`, `warn`, `error` |

### 日志格式配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `LOG_FORMAT` | `json` | 日志输出格式，可选值：`json`, `text` |

## 使用这些配置项的文件

### 1. 日志配置服务
- **文件**: `src/config/service/LoggingConfigService.ts`
- **用途**: 管理日志配置参数，加载环境变量并验证配置

### 2. 通用日志服务
- **文件**: `src/utils/logger.ts`
- **用途**: 根据配置设置日志级别和输出格式

### 3. 数据库日志服务
- **文件**: `src/database/common/DatabaseLoggerService.ts`
- **用途**: 根据通用日志配置设置数据库操作的日志级别

### 4. 主应用入口
- **文件**: `src/main.ts`
- **用途**: 在应用启动时根据日志配置更新日志服务级别

## 配置验证

日志配置会在应用程序启动时进行验证，确保日志级别是有效的值（debug, info, warn, error）。

## 示例配置

```bash
# 开发环境日志配置
LOG_LEVEL=debug
LOG_FORMAT=json

# 生产环境日志配置
LOG_LEVEL=info
LOG_FORMAT=json

# 简单文本格式日志
LOG_LEVEL=warn
LOG_FORMAT=text
```

## 日志级别说明

- `debug`: 详细调试信息，主要用于开发和故障排除
- `info`: 一般信息消息，记录应用程序正常运行状态
- `warn`: 警告信息，表示可能的问题但不影响程序运行
- `error`: 错误信息，表示发生错误但程序仍可继续运行