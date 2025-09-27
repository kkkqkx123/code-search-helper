# 配置管理模块迁移指南

## 概述

本文档介绍了如何将项目中的配置管理从简单的环境变量使用迁移到一个集中式、类型安全的配置管理模块。该模块参考了 `@/ref/src/service/config` 的实现，并根据当前项目需求进行了适配。

## 迁移前状态

在迁移之前，项目中的配置管理主要依赖于直接访问环境变量（`process.env`），这种方式存在以下问题：

1. 缺乏类型安全
2. 没有配置验证
3. 难以管理复杂的配置结构
4. 不同服务中存在重复的配置访问逻辑

## 新配置模块架构

### 1. 配置类型定义 (ConfigTypes.ts)

定义了所有配置的类型接口，包括：

- `Config` - 主配置接口
- `QdrantConfig` - Qdrant相关配置
- `DatabaseConfig` - 数据库配置
- `LoggingConfig` - 日志配置
- `ServerConfig` - 服务器配置

### 2. 配置服务 (ConfigService.ts)

核心配置服务类，提供以下功能：

- 加载配置
- 验证配置
- 提供类型安全的配置访问
- 配置热重载支持

### 3. 配置工厂 (ConfigFactory.ts)

提供高级配置访问方法，简化配置获取过程。

## 迁移步骤

### 1. 创建配置模块

创建了以下文件：

- `src/config/ConfigTypes.ts` - 配置类型定义
- `src/config/ConfigService.ts` - 配置服务实现
- `src/config/index.ts` - 导出模块

### 2. 更新Qdrant服务

将QdrantService从直接使用环境变量迁移到使用ConfigService：

- 移除了直接访问 `process.env` 的代码
- 添加了对ConfigService的依赖注入
- 从配置服务获取Qdrant相关配置

### 3. 更新依赖注入系统

- 创建了 `src/types.ts` 定义依赖注入标识符
- 创建了 `src/core/DIContainer.ts` 管理依赖注入容器
- 更新了相关服务使用依赖注入装饰器

## 依赖注入更新

### TYPES定义

```typescript
export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  QdrantService: Symbol.for('QdrantService'),
};
```

### 服务装饰器

所有服务现在使用 `@injectable()` 装饰器，依赖通过构造函数注入。

## 使用示例

### 获取配置

```typescript
import { ConfigService } from '../config/ConfigService';

// 在服务构造函数中注入ConfigService
constructor(@inject(TYPES.ConfigService) private configService: ConfigService) {
  // 获取特定配置
  const qdrantConfig = this.configService.get('qdrant');
}
```

### 配置验证

配置服务使用Joi进行配置验证，确保配置项的类型和值符合预期。

## 当前支持的配置项

### Qdrant配置

- `host` - Qdrant服务器主机地址
- `port` - Qdrant服务器端口
- `apiKey` - API密钥（可选）
- `useHttps` - 是否使用HTTPS
- `timeout` - 请求超时时间
- `collection` - 集合名称

## 测试

配置模块包含完整的单元测试，确保配置加载和验证功能正常工作。

## 未来扩展

1. 添加更多配置项（数据库、日志、服务器等）
2. 支持配置文件热重载
3. 集成外部配置管理服务
4. 添加配置加密功能

## 注意事项

1. 所有新服务都应该使用依赖注入获取配置服务
2. 配置项应该在ConfigTypes.ts中定义相应的类型
3. 配置验证规则应该在ConfigService.ts中更新
4. 确保环境变量设置正确，以便配置服务能够正确加载值