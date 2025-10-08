# Nebula 测试空间清理工具

## 概述

这个工具用于清理 Nebula Graph 数据库中在测试过程中创建的空间。它会自动识别和删除测试空间，但会保留重要的空间（如 `test_space`）。

## 功能特性

- ✅ 自动连接到 Nebula 数据库
- ✅ 列出所有现有的空间
- ✅ 根据模式识别测试空间
- ✅ 安全删除测试空间（保留重要空间）
- ✅ 支持模拟运行模式（预览将要删除的空间）
- ✅ 详细的日志输出
- ✅ 错误处理和连接管理

## 安装要求

- Node.js 14+ 
- Nebula Graph 数据库运行在 `127.0.0.1:9669`（默认配置）
- 项目已安装 `@nebula-contrib/nebula-nodejs` 依赖

## 使用方法

### 1. 使用 PowerShell 脚本（推荐）

```powershell
# 基本用法（使用默认配置）
.\cleanup-nebula-test-spaces.ps1

# 模拟运行（预览将要删除的空间）
.\cleanup-nebula-test-spaces.ps1 -DryRun

# 自定义服务器配置
.\cleanup-nebula-test-spaces.ps1 -Host "192.168.1.100" -Port 9669 -Username "admin" -Password "password"

# 显示帮助信息
.\cleanup-nebula-test-spaces.ps1 -Help
```

### 2. 直接使用 TypeScript 脚本

```bash
# 使用 ts-node 运行
npx ts-node cleanup-nebula-test-spaces.ts

# 或者先编译再运行
npx tsc cleanup-nebula-test-spaces.ts
node cleanup-nebula-test-spaces.js
```

## 配置说明

### 默认连接配置

```typescript
const NEBULA_CONFIG = {
  servers: ['127.0.0.1:9669'],  // Nebula 服务器地址
  userName: 'root',              // 用户名
  password: 'nebula',            // 密码
  space: 'test_space',           // 默认空间（用于执行系统命令）
  poolSize: 1,                   // 连接池大小
  bufferSize: 10,                // 命令缓存大小
  executeTimeout: 30000,         // 执行超时时间（毫秒）
  pingInterval: 3000             // 心跳间隔（毫秒）
};
```

### 测试空间识别模式

根据实际查询结果，脚本会自动识别以下模式的测试空间：
- `direct_test_*` - 以 `direct_test_` 开头的空间（直接测试创建）
- `test_auto_create_*` - 以 `test_auto_create_` 开头的空间（自动创建测试）
- `test_project_*` - 以 `test_project_` 开头的空间（项目测试）
- `testspace\d+` - 以 `testspace` 开头后跟数字的空间
- `testspace_\d+` - 以 `testspace_` 开头后跟数字的空间

### 保护的空间

以下空间会被保留，不会被删除：

- `test_space` - 主要的测试空间
- `nebula` - 默认空间
- `codebase` - 主代码库空间

## 示例输出

```
=== Nebula 测试空间清理工具 ===

配置信息:
  服务器: 127.0.0.1:9669
  用户名: root
  默认空间: test_space

测试空间模式:
  - /^direct_test_/
  - /^test_auto_create_/
  - /^test_project_/
  - /^testspace\d+$/
  - /^testspace_\d+$/

保护的空间:
  - test_space
  - nebula
  - codebase

开始清理...

正在连接到 Nebula 数据库...
✓ 客户端连接就绪
✓ 已连接到 test_space 空间
正在列出所有空间...
找到 23 个空间:
  - direct_test_1759890162742
  - direct_test_1759890209659
  - direct_test_1759890284073
  - test_auto_create_1759890212983
  - test_auto_create_1759890287412
  - test_project_1759890223014
  - test_project_1759890297437
  - test_space
  - testspace1759887377
  - testspace_1759888499934
  - project_project_alpha
  - project_project_beta
  - project_project_gamma

识别出 19 个测试空间需要删除:
  - direct_test_1759890162742
  - direct_test_1759890209659
  - direct_test_1759890284073
  - test_auto_create_1759890212983
  - test_auto_create_1759890287412
  - test_project_1759890223014
  - test_project_1759890297437
  - testspace1759887377
  - testspace_1759888499934

开始删除测试空间...
正在删除空间: direct_test_1759890162742
✓ 成功删除空间: direct_test_1759890162742
正在删除空间: direct_test_1759890209659
✓ 成功删除空间: direct_test_1759890209659
...

清理完成！
✓ 成功删除: 19 个空间
✓ 数据库连接已关闭

=== 清理完成 ===
```

## 安全说明

1. **备份重要数据**：在执行清理操作前，请确保重要数据已备份
2. **模拟运行**：首次使用建议先使用 `-DryRun` 参数预览将要删除的空间
3. **权限检查**：确保数据库用户有足够的权限执行 `DROP SPACE` 操作
4. **网络连接**：确保网络连接稳定，避免操作中断

## 故障排除

### 连接失败

如果连接失败，请检查：

1. Nebula Graph 服务是否正常运行
2. 服务器地址和端口是否正确
3. 用户名和密码是否正确
4. 防火墙设置是否允许连接

### 权限错误

如果出现权限错误，请确保数据库用户有执行以下操作的权限：

- `SHOW SPACES` - 查看空间列表
- `DROP SPACE` - 删除空间

### TypeScript 编译错误

如果遇到 TypeScript 编译错误，可以尝试：

1. 安装项目依赖：`npm install`
2. 使用 ts-node 直接运行：`npx ts-node cleanup-nebula-test-spaces.ts`

## 相关脚本

- `create-test-space.ts` - 创建测试空间
- `test-nebula-simple.ts` - 简单的连接测试
- `diagnose-nebula.ts` - Nebula 连接诊断

## 开发说明

### 修改配置

可以在 `cleanup-nebula-test-spaces.ts` 文件中修改：

- `NEBULA_CONFIG` - 数据库连接配置
- `TEST_SPACE_PATTERNS` - 测试空间识别模式
- `PROTECTED_SPACES` - 保护的空间列表

### 添加新功能

脚本采用模块化设计，可以轻松添加新功能：

- 添加新的空间识别模式
- 实现更复杂的空间筛选逻辑
- 添加数据库备份功能
- 实现批量操作优化

## 许可证

本项目基于 MIT 许可证开源。