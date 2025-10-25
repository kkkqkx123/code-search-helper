# 手动更新索引API接口规范

## 📋 概述

本文档详细定义了手动更新索引功能的API接口规范，包括请求/响应格式、错误处理、状态码等。

## 🔗 API端点总览

### 基础路径
```
/api/v1/indexing
```

### 端点列表

| 方法 | 路径 | 描述 | 状态码 |
|------|------|------|--------|
| POST | `/api/v1/indexing/:projectId/update` | 手动更新项目索引 | 200, 400, 404, 500 |
| GET | `/api/v1/indexing/:projectId/update/progress` | 获取更新进度 | 200, 404 |
| DELETE | `/api/v1/indexing/:projectId/update` | 取消更新操作 | 200, 404 |
| GET | `/api/v1/indexing/:projectId/update/history` | 获取更新历史 | 200, 404 |

## 📝 详细接口规范

### 1. 手动更新索引

**端点**: `POST /api/v1/indexing/:projectId/update`

**描述**: 手动触发项目索引的增量更新，仅更新发生变化的文件。

**请求参数**:

**路径参数**:
- `projectId` (string, required): 项目ID

**请求体**:
```typescript
interface UpdateIndexRequest {
    options?: {
        // 更新选项
        batchSize?: number;           // 批次大小，默认100
        maxConcurrency?: number;      // 最大并发数，默认3
        enableHashComparison?: boolean; // 启用哈希比较，默认true
        forceUpdate?: boolean;        // 强制更新所有文件，默认false
        includePatterns?: string[];   // 包含的文件模式
        excludePatterns?: string[];   // 排除的文件模式
    };
}
```

**请求示例**:
```json
{
    "options": {
        "batchSize": 100,
        "maxConcurrency": 3,
        "enableHashComparison": true,
        "forceUpdate": false
    }
}
```

**响应**:

**成功响应 (200)**:
```typescript
interface UpdateIndexResponse {
    success: true;
    data: {
        projectId: string;
        projectPath: string;
        updateId: string;           // 更新操作ID
        status: 'started' | 'completed' | 'failed' | 'cancelled';
        totalFiles: number;         // 总文件数
        updatedFiles: number;       // 更新的文件数
        deletedFiles: number;       // 删除的文件数
        unchangedFiles: number;     // 未变化的文件数
        errors: Array<{             // 错误列表
            filePath: string;
            error: string;
            timestamp: string;
        }>;
        processingTime: number;     // 处理时间(毫秒)
        startTime: string;          // 开始时间(ISO格式)
        estimatedCompletionTime?: string; // 预计完成时间
    };
}
```

**响应示例**:
```json
{
    "success": true,
    "data": {
        "projectId": "project-123",
        "projectPath": "/path/to/project",
        "updateId": "update-456",
        "status": "started",
        "totalFiles": 1500,
        "updatedFiles": 0,
        "deletedFiles": 0,
        "unchangedFiles": 0,
        "errors": [],
        "processingTime": 0,
        "startTime": "2024-01-15T10:30:00.000Z",
        "estimatedCompletionTime": "2024-01-15T10:35:00.000Z"
    }
}
```

**错误响应**:

**400 Bad Request**:
```json
{
    "success": false,
    "error": "Invalid request parameters",
    "details": {
        "field": "projectId",
        "message": "Project ID is required"
    }
}
```

**404 Not Found**:
```json
{
    "success": false,
    "error": "Project not found",
    "projectId": "project-123"
}
```

**409 Conflict**:
```json
{
    "success": false,
    "error": "Update already in progress",
    "currentStatus": "running",
    "startedAt": "2024-01-15T10:25:00.000Z"
}
```

**500 Internal Server Error**:
```json
{
    "success": false,
    "error": "Internal server error",
    "message": "Failed to start update process"
}
```

### 2. 获取更新进度

**端点**: `GET /api/v1/indexing/:projectId/update/progress`

**描述**: 获取当前更新操作的进度信息。

**请求参数**:

**路径参数**:
- `projectId` (string, required): 项目ID

**查询参数**:
- `updateId` (string, optional): 特定更新操作ID，如果不提供则返回最新进度

**响应**:

**成功响应 (200)**:
```typescript
interface UpdateProgressResponse {
    success: true;
    data: {
        projectId: string;
        updateId: string;
        status: 'running' | 'completed' | 'failed' | 'cancelled';
        progress: {
            percentage: number;           // 进度百分比(0-100)
            currentFile: string;          // 当前处理的文件
            filesProcessed: number;       // 已处理的文件数
            filesTotal: number;           // 总文件数
            estimatedTimeRemaining: number; // 预计剩余时间(秒)
        };
        statistics: {
            totalFiles: number;
            updatedFiles: number;
            deletedFiles: number;
            unchangedFiles: number;
            errorCount: number;
        };
        startTime: string;
        lastUpdated: string;
        currentOperation?: string;        // 当前操作描述
    };
}
```

**响应示例**:
```json
{
    "success": true,
    "data": {
        "projectId": "project-123",
        "updateId": "update-456",
        "status": "running",
        "progress": {
            "percentage": 45,
            "currentFile": "/src/services/IndexService.ts",
            "filesProcessed": 675,
            "filesTotal": 1500,
            "estimatedTimeRemaining": 120
        },
        "statistics": {
            "totalFiles": 1500,
            "updatedFiles": 120,
            "deletedFiles": 5,
            "unchangedFiles": 550,
            "errorCount": 2
        },
        "startTime": "2024-01-15T10:30:00.000Z",
        "lastUpdated": "2024-01-15T10:32:30.000Z",
        "currentOperation": "Processing file changes"
    }
}
```

### 3. 取消更新操作

**端点**: `DELETE /api/v1/indexing/:projectId/update`

**描述**: 取消正在进行的更新操作。

**请求参数**:

**路径参数**:
- `projectId` (string, required): 项目ID

**查询参数**:
- `updateId` (string, optional): 特定更新操作ID，如果不提供则取消最新操作

**响应**:

**成功响应 (200)**:
```json
{
    "success": true,
    "data": {
        "projectId": "project-123",
        "updateId": "update-456",
        "status": "cancelled",
        "cancelledAt": "2024-01-15T10:33:00.000Z",
        "progressAtCancellation": {
            "filesProcessed": 800,
            "filesTotal": 1500,
            "percentage": 53
        }
    }
}
```

**404 Not Found**:
```json
{
    "success": false,
    "error": "No active update operation found",
    "projectId": "project-123"
}
```

### 4. 获取更新历史

**端点**: `GET /api/v1/indexing/:projectId/update/history`

**描述**: 获取项目的更新历史记录。

**请求参数**:

**路径参数**:
- `projectId` (string, required): 项目ID

**查询参数**:
- `limit` (number, optional): 返回记录数量，默认10
- `offset` (number, optional): 偏移量，默认0
- `startDate` (string, optional): 开始日期(ISO格式)
- `endDate` (string, optional): 结束日期(ISO格式)

**响应**:

**成功响应 (200)**:
```typescript
interface UpdateHistoryResponse {
    success: true;
    data: {
        projectId: string;
        totalCount: number;
        updates: Array<{
            updateId: string;
            status: 'completed' | 'failed' | 'cancelled';
            startTime: string;
            endTime: string;
            duration: number; // 毫秒
            statistics: {
                totalFiles: number;
                updatedFiles: number;
                deletedFiles: number;
                unchangedFiles: number;
                errorCount: number;
            };
            error?: string;
        }>;
        pagination: {
            limit: number;
            offset: number;
            total: number;
        };
    };
}
```

**响应示例**:
```json
{
    "success": true,
    "data": {
        "projectId": "project-123",
        "totalCount": 5,
        "updates": [
            {
                "updateId": "update-456",
                "status": "completed",
                "startTime": "2024-01-15T10:30:00.000Z",
                "endTime": "2024-01-15T10:35:00.000Z",
                "duration": 300000,
                "statistics": {
                    "totalFiles": 1500,
                    "updatedFiles": 120,
                    "deletedFiles": 5,
                    "unchangedFiles": 1375,
                    "errorCount": 0
                }
            }
        ],
        "pagination": {
            "limit": 10,
            "offset": 0,
            "total": 5
        }
    }
}
```

## 🔄 WebSocket实时更新

### WebSocket连接

**端点**: `ws://localhost:3010/api/v1/indexing/:projectId/update/ws`

**消息类型**:

1. **进度更新消息**:
```typescript
interface ProgressUpdateMessage {
    type: 'progress';
    data: {
        updateId: string;
        percentage: number;
        currentFile: string;
        filesProcessed: number;
        filesTotal: number;
        estimatedTimeRemaining: number;
    };
}
```

2. **状态变更消息**:
```typescript
interface StatusUpdateMessage {
    type: 'status';
    data: {
        updateId: string;
        status: 'running' | 'completed' | 'failed' | 'cancelled';
        timestamp: string;
    };
}
```

3. **错误消息**:
```typescript
interface ErrorMessage {
    type: 'error';
    data: {
        updateId: string;
        filePath: string;
        error: string;
        timestamp: string;
    };
}
```

4. **完成消息**:
```typescript
interface CompletionMessage {
    type: 'completed';
    data: {
        updateId: string;
        statistics: {
            totalFiles: number;
            updatedFiles: number;
            deletedFiles: number;
            unchangedFiles: number;
            errorCount: number;
        };
        processingTime: number;
    };
}
```

## 🛡️ 安全考虑

### 1. 认证和授权
- 目前系统为本地工具，暂不需要复杂认证
- 可考虑添加简单的API密钥验证
- 限制只能访问用户有权限的项目路径

### 2. 输入验证
- 验证projectId格式和存在性
- 验证文件路径安全性，防止路径遍历攻击
- 限制请求体大小和参数范围

### 3. 速率限制
- 限制同一项目的并发更新操作
- 实现请求频率限制
- 防止恶意大量请求

## 📊 监控指标

### 1. 性能指标
- 更新操作的平均处理时间
- 文件处理速率(文件/秒)
- 内存使用情况
- 错误率和重试次数

### 2. 业务指标
- 每日更新操作数量
- 平均更新的文件数量
- 成功率/失败率
- 用户使用模式分析

## 🔧 错误代码表

| 错误代码 | HTTP状态码 | 描述 | 解决方案 |
|----------|------------|------|----------|
| UPDATE_001 | 400 | 无效的项目ID格式 | 检查projectId参数格式 |
| UPDATE_002 | 404 | 项目不存在 | 验证项目路径和ID |
| UPDATE_003 | 409 | 更新操作已在进行中 | 等待当前操作完成或取消 |
| UPDATE_004 | 429 | 请求频率过高 | 降低请求频率 |
| UPDATE_005 | 500 | 内部服务器错误 | 检查服务器日志 |
| UPDATE_006 | 503 | 服务不可用 | 检查依赖服务状态 |

## 📋 客户端实现建议

### 1. 重试策略
```typescript
class UpdateClient {
    async updateIndexWithRetry(projectId: string, options?: any, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.updateIndex(projectId, options);
            } catch (error) {
                if (attempt === maxRetries) throw error;
                await this.delay(1000 * attempt); // 指数退避
            }
        }
    }
}
```

### 2. 进度轮询
```typescript
class ProgressMonitor {
    async monitorProgress(projectId: string, updateId: string) {
        const interval = setInterval(async () => {
            const progress = await this.getProgress(projectId, updateId);
            this.updateUI(progress);
            
            if (progress.status !== 'running') {
                clearInterval(interval);
            }
        }, 1000); // 每秒轮询一次
    }
}
```

这个API规范提供了完整的手动更新索引功能接口定义，为前后端开发提供了清晰的指导。