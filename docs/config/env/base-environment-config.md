# 基础环境配置

## 概述

基础环境配置包括应用程序运行所需的核心环境变量，如运行环境、端口、日志级别等。

## 配置项说明

### 应用程序配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `development` | 应用程序运行环境，可选值：`development`、`production`、`test` |
| `PORT` | `3010` | 应用程序监听端口 |

## 使用这些配置项的文件

### 1. 主应用入口
- **文件**: `src/main.ts`
- **用途**: 根据 `NODE_ENV` 确定运行模式，根据 `PORT` 启动HTTP服务器

### 2. 配置服务
- **文件**: `src/config/service/EnvironmentConfigService.ts`
- **用途**: 加载和验证环境变量配置

## 配置验证

基础环境配置会在应用程序启动时进行验证，确保必要的环境变量已设置。

## 示例配置

```bash
# 生产环境配置示例
NODE_ENV=production
PORT=3010
```

```bash
# 开发环境配置示例
NODE_ENV=development
PORT=3010