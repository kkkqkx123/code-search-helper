# 配置总述

## 概述

本项目使用环境变量进行配置管理，所有配置项都定义在 `.env.example` 文件中。配置系统被组织为多个逻辑模块，每个模块负责特定的功能领域。

## 配置模块概览

### 1. 基础环境配置
- **文件**: `docs/config/base-environment-config.md`
- **功能**: 控制应用程序的基本运行环境，包括运行模式和端口设置
- **主要配置项**: `NODE_ENV`, `PORT`

### 2. 数据库配置
- **文件**: `docs/config/database-config.md`
- **功能**: 管理Qdrant向量数据库和NebulaGraph图数据库的连接参数
- **主要配置项**: `QDRANT_HOST`, `QDRANT_PORT`, `NEBULA_HOST`, `NEBULA_PORT`, `NEBULA_USERNAME`, `NEBULA_PASSWORD`

### 3. 嵌入器配置
- **文件**: `docs/config/embedder-config.md`
- **功能**: 配置各种嵌入模型提供商，如OpenAI、Ollama、Gemini、Mistral等
- **主要配置项**: `EMBEDDING_PROVIDER`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `SILICONFLOW_API_KEY`

### 4. 日志配置
- **文件**: `docs/config/logging-config.md`
- **功能**: 控制应用程序的日志记录行为
- **主要配置项**: `LOG_LEVEL`, `LOG_FORMAT`

### 5. 监控配置
- **文件**: `docs/config/monitoring-config.md`
- **功能**: 管理应用程序的性能监控和指标收集
- **主要配置项**: `ENABLE_METRICS`, `METRICS_PORT`, `SEARCH_MOCK_MODE`

### 6. 文件处理配置
- **文件**: `docs/config/file-processing-config.md`
- **功能**: 控制文件处理参数，包括大小限制、支持的扩展名等
- **主要配置项**: `MAX_FILE_SIZE`, `SUPPORTED_EXTENSIONS`, `INDEX_BATCH_SIZE`, `CHUNK_SIZE`, `OVERLAP_SIZE`

### 7. 内存配置
- **文件**: `docs/config/memory-config.md`
- **功能**: 管理应用程序的内存使用和垃圾回收
- **主要配置项**: `MEMORY_THRESHOLD`, `BATCH_MEMORY_THRESHOLD`, `MAX_MEMORY_MB`, `MEMORY_WARNING_THRESHOLD`, `NODE_OPTIONS`

### 8. 静态分析配置
- **文件**: `docs/config/semgrep-config.md`
- **功能**: 配置Semgrep静态代码分析工具的集成
- **主要配置项**: `SEMGREP_ENABLED`, `SEMGREP_CLI_PATH`, `SEMGREP_RULES_DIR`, `SEMGREP_TIMEOUT`

### 9. Redis配置
- **文件**: `docs/config/redis-config.md`
- **功能**: 管理Redis缓存服务的连接和配置
- **主要配置项**: `REDIS_ENABLED`, `REDIS_URL`, `REDIS_MAXMEMORY`, `REDIS_TTL_EMBEDDING`, `REDIS_TTL_SEARCH`

### 10. 基础设施配置
- **文件**: `docs/config/infrastructure-config.md`
- **功能**: 控制底层基础设施服务的各个方面
- **主要配置项**: `INFRA_COMMON_ENABLE_CACHE`, `INFRA_QDRANT_CACHE_DEFAULT_TTL`, `INFRA_NEBULA_PERFORMANCE_MONITORING_INTERVAL`, `INFRA_TRANSACTION_TIMEOUT`

### 11. 索引配置
- **文件**: `docs/config/indexing-config.md`
- **功能**: 管理代码库索引过程的参数
- **主要配置项**: `INDEXING_BATCH_SIZE`, `INDEXING_MAX_CONCURRENCY`, `INDEXING_TIMEOUT_MS`, `INDEXING_STRATEGY`

### 12. 项目命名配置
- **文件**: `docs/config/project-naming-config.md`
- **功能**: 控制不同数据库中项目相关资源的命名规则
- **主要配置项**: `PROJECT_QDRANT_DEFAULT_COLLECTION`, `PROJECT_QDRANT_NAMING_PATTERN`, `PROJECT_NEBULA_DEFAULT_SPACE`, `PROJECT_ALLOW_REINDEX`

## 配置优先级

配置系统遵循以下优先级顺序（从高到低）：

1. **环境变量**: 直接从系统环境变量加载的值（最高优先级）
2. **配置文件**: 从 `.env` 文件加载的值
3. **默认值**: 代码中定义的默认值（最低优先级）

## 配置验证

所有配置项在应用程序启动时都会进行验证，确保值在合理范围内。验证失败会导致应用程序启动失败，并提供详细的错误信息。

## 最佳实践

1. **开发环境**: 使用完整的配置集，启用详细日志和监控
2. **测试环境**: 使用模拟模式和简化的配置
3. **生产环境**: 优化性能相关的配置，设置适当的资源限制
4. **安全**: 避免在配置文件中硬编码敏感信息，使用环境变量管理API密钥等敏感数据

## 配置管理建议

1. **版本控制**: 将 `.env.example` 文件纳入版本控制，但排除实际的 `.env` 文件
2. **文档更新**: 当添加新配置项时，同步更新相应的文档
3. **命名规范**: 遵循一致的命名规范，使用描述性的配置项名称
4. **默认值**: 为所有配置项提供合理的默认值，确保应用程序在没有显式配置时也能正常运行