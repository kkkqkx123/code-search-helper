# 文件处理配置

## 概述

文件处理配置用于控制应用程序处理文件的方式，包括文件大小限制、支持的扩展名、索引批处理大小、文本块大小和重叠大小。

## 配置项说明

### 文件处理配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_FILE_SIZE` | `10485760` (10MB) | 单个文件的最大大小（字节） |
| `SUPPORTED_EXTENSIONS` | `.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h` | 支持的文件扩展名列表 |
| `INDEX_BATCH_SIZE` | `100` | 索引批处理大小 |
| `CHUNK_SIZE` | `1000` | 文本块大小（字符数） |
| `OVERLAP_SIZE` | `200` | 文本块重叠大小（字符数） |

## 使用这些配置项的文件

### 1. 文件处理配置服务
- **文件**: `src/config/service/FileProcessingConfigService.ts`
- **用途**: 管理文件处理配置参数，加载环境变量并验证配置

### 2. 文件系统服务
- **文件**: `src/service/filesystem/FileWatcherService.ts`
- **用途**: 使用MAX_FILE_SIZE配置限制处理的文件大小

### 3. 索引服务
- **文件**: `src/service/index/IndexService.ts`
- **用途**: 使用INDEX_BATCH_SIZE配置控制索引批处理大小

### 4. 解析器服务
- **文件**: `src/service/parser/core/config/LanguageConfigManager.ts`
- **用途**: 使用文件大小限制配置控制解析器性能

## 配置验证

文件处理配置会在应用程序启动时进行验证，确保文件大小限制、批处理大小等参数在合理范围内。

## 示例配置

```bash
# 默认配置
MAX_FILE_SIZE=10485760
SUPPORTED_EXTENSIONS=.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h
INDEX_BATCH_SIZE=100
CHUNK_SIZE=1000
OVERLAP_SIZE=200

# 针对大型项目的配置
MAX_FILE_SIZE=52428800  # 50MB
SUPPORTED_EXTENSIONS=.ts,.js,.py,.java,.go,.rs,.cpp,.c,.h,.tsx,.jsx
INDEX_BATCH_SIZE=200
CHUNK_SIZE=2000
OVERLAP_SIZE=400

# 针对小型项目的配置
MAX_FILE_SIZE=5242880   # 5MB
SUPPORTED_EXTENSIONS=.ts,.js,.py
INDEX_BATCH_SIZE=50
CHUNK_SIZE=500
OVERLAP_SIZE=100
```

## 配置项详细说明

- `MAX_FILE_SIZE`: 控制应用程序处理的单个文件最大大小，超出此限制的文件将被跳过
- `SUPPORTED_EXTENSIONS`: 指定应用程序将处理的文件扩展名列表，用逗号分隔
- `INDEX_BATCH_SIZE`: 控制索引操作的批处理大小，较大的值可以提高索引速度但需要更多内存
- `CHUNK_SIZE`: 将文件分割成的文本块大小，用于嵌入和搜索
- `OVERLAP_SIZE`: 相邻文本块之间的重叠大小，有助于保持上下文连续性