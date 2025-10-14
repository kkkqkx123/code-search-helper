# 热更新机制配置参数说明

本文档总结了文件系统模块热更新机制中使用的各项参数及其默认值。

## 全局热更新配置

全局热更新配置定义了系统范围内热更新的行为。

### 参数列表

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | boolean | true | 是否启用热更新功能 |
| defaultDebounceInterval | number | 500 | 默认防抖间隔（毫秒） |
| defaultWatchPatterns | string[] | `['**/*.{js,ts,jsx,tsx,json,md,py,go,java,css,html,scss}']` | 默认监视的文件模式 |
| defaultIgnorePatterns | string[] | `['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/target/**', '**/venv/**', '**/.vscode/**', '**/.idea/**', '**/logs/**', '**/*.log', '**/coverage/**', '**/tmp/**', '**/temp/**']` | 默认忽略的文件模式 |
| defaultMaxFileSize | number | 10485760 (10MB) | 默认最大文件大小（字节） |
| defaultErrorHandling.maxRetries | number | 3 | 默认最大重试次数 |
| defaultErrorHandling.alertThreshold | number | 5 | 默认告警阈值 |
| defaultErrorHandling.autoRecovery | boolean | true | 是否自动恢复 |
| enableDetailedLogging | boolean | false | 是否启用详细日志 |
| maxConcurrentProjects | number | 5 | 最大并发项目数 |

## 项目特定热更新配置

每个项目可以有独立的热更新配置，继承全局默认值。

### 参数列表

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | boolean | 继承全局配置 | 是否启用该项目的热更新功能 |
| debounceInterval | number | 继承全局配置 | 防抖间隔（毫秒） |
| watchPatterns | string[] | 继承全局配置 | 监视的文件模式 |
| ignorePatterns | string[] | 继承全局配置 | 忽略的文件模式 |
| maxFileSize | number | 继承全局配置 | 最大文件大小（字节） |
| errorHandling.maxRetries | number | 继承全局配置 | 最大重试次数 |
| errorHandling.alertThreshold | number | 继承全局配置 | 告警阈值 |
| errorHandling.autoRecovery | boolean | 继承全局配置 | 是否自动恢复 |

## 热更新状态信息

热更新状态信息用于跟踪每个项目的热更新运行状态。

### 参数列表

| 参数名 | 类型 | 说明 |
|--------|------|------|
| enabled | boolean | 是否已启用 |
| isWatching | boolean | 是否正在监视 |
| watchedPaths | string[] | 监视的路径列表 |
| lastChange | Date \| null | 最后一次变更时间 |
| changesCount | number | 变更计数 |
| errorsCount | number | 错误计数 |
| lastError | Date \| null | 最后一次错误时间 |

## 热更新指标信息

热更新指标信息用于收集和监控热更新性能数据。

### 参数列表

| 参数名 | 类型 | 说明 |
|--------|------|------|
| filesProcessed | number | 已处理的文件数 |
| changesDetected | number | 检测到的变更数 |
| averageProcessingTime | number | 平均处理时间（毫秒） |
| lastUpdated | Date | 最后更新时间 |
| errorCount | number | 错误总数 |
| errorBreakdown | Record<string, number> | 按错误类型分类的错误计数 |
| recoveryStats.autoRecovered | number | 自动恢复次数 |
| recoveryStats.manualIntervention | number | 手动干预次数 |
| recoveryStats.failedRecoveries | number | 恢复失败次数 |

## 热更新错误处理配置

错误处理配置用于控制热更新过程中错误的处理方式。

### 参数列表

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|
| maxRetries | number | 3 | 最大重试次数 |
| alertThreshold | number | 5 | 告警阈值 |
| autoRecovery | boolean | true | 是否自动恢复 |

## 环境变量配置

热更新机制支持通过环境变量进行配置。

### 全局环境变量

| 环境变量名 | 对应参数 | 默认值 | 说明 |
|------------|----------|--------|------|
| HOT_RELOAD_ENABLED | enabled | true | 是否启用热更新 |
| HOT_RELOAD_DEFAULT_DEBOUNCE_INTERVAL | defaultDebounceInterval | 500 | 默认防抖间隔 |
| HOT_RELOAD_DEFAULT_MAX_FILE_SIZE | defaultMaxFileSize | 10485760 | 默认最大文件大小 |
| HOT_RELOAD_DEFAULT_MAX_RETRIES | defaultErrorHandling.maxRetries | 3 | 默认最大重试次数 |
| HOT_RELOAD_DEFAULT_ALERT_THRESHOLD | defaultErrorHandling.alertThreshold | 5 | 默认告警阈值 |
| HOT_RELOAD_DEFAULT_AUTO_RECOVERY | defaultErrorHandling.autoRecovery | true | 默认是否自动恢复 |
| HOT_RELOAD_ENABLE_DETAILED_LOGGING | enableDetailedLogging | false | 是否启用详细日志 |
| HOT_RELOAD_MAX_CONCURRENT_PROJECTS | maxConcurrentProjects | 5 | 最大并发项目数 |

## 错误代码定义

热更新机制使用以下错误代码来标识不同类型的错误：

- `FILE_WATCH_FAILED`: 文件监视失败
- `CHANGE_DETECTION_FAILED`: 变更检测失败
- `INDEX_UPDATE_FAILED`: 索引更新失败
- `PERMISSION_DENIED`: 权限被拒绝
- `FILE_TOO_LARGE`: 文件过大
- `HOT_RELOAD_DISABLED`: 热更新已禁用
- `PROJECT_NOT_FOUND`: 项目未找到
- `INVALID_CONFIG`: 无效配置