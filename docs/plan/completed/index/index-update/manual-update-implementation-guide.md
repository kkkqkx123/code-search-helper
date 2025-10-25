# 手动更新索引功能实现指南

## 📋 实现概述

本文档提供手动更新索引功能的详细实现指南，包括具体的代码实现、集成步骤和测试方法。

## 🏗️ 后端实现

### 1. 扩展IndexService接口

在 `src/service/index/IndexService.ts` 中添加新的接口定义：

```typescript
// 在现有接口定义后添加
export interface UpdateIndexOptions {
    batchSize?: number;
    maxConcurrency?: number;
    enableHashComparison?: boolean;
    forceUpdate?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
}

export interface UpdateIndexResult {
    projectId: string;
    projectPath: string;
    updateId: string;
    status: 'started' | 'completed' | 'failed' | 'cancelled';
    totalFiles: number;
    updatedFiles: number;
    deletedFiles: number;
    unchangedFiles: number;
    errors: Array<{
        filePath: string;
        error: string;
        timestamp: string;
    }>;
    processingTime: number;
    startTime: string;
    estimatedCompletionTime?: string;
}

export interface UpdateProgress {
    projectId: string;
    updateId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress: {
        percentage: number;
        currentFile: string;
        filesProcessed: number;
        filesTotal: number;
        estimatedTimeRemaining: number;
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
    currentOperation?: string;
}
```

### 2. 实现文件变化检测器

创建新的文件变化检测服务：

```typescript
// src/service/filesystem/FileChangeDetector.ts
import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { FileSystemTraversal } from './FileSystemTraversal';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';

export interface FileChanges {
    added: string[];
    modified: string[];
    deleted: string[];
    unchanged: string[];
}

export interface FileHashCache {
    [filePath: string]: {
        hash: string;
        mtime: Date;
        size: number;
        lastChecked: Date;
    };
}

@injectable()
export class FileChangeDetector {
    private fileHashes: Map<string, FileHashCache> = new Map();

    constructor(
        @inject(TYPES.LoggerService) private logger: LoggerService,
        @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
        @inject(TYPES.FileSystemTraversal) private fileSystemTraversal: FileSystemTraversal
    ) {}

    /**
     * 检测文件变化
     */
    async detectChanges(projectPath: string, options?: { enableHashComparison?: boolean }): Promise<FileChanges> {
        const enableHashComparison = options?.enableHashComparison ?? true;
        
        try {
            // 获取当前文件系统状态
            const currentFiles = await this.fileSystemTraversal.getProjectFiles(projectPath);
            
            // 获取缓存的索引文件列表
            const indexedFiles = await this.getIndexedFiles(projectPath);
            
            // 检测变化
            const changes: FileChanges = {
                added: [],
                modified: [],
                deleted: [],
                unchanged: []
            };

            // 检测新增文件
            for (const file of currentFiles) {
                if (!indexedFiles.includes(file)) {
                    changes.added.push(file);
                }
            }

            // 检测删除文件
            for (const file of indexedFiles) {
                if (!currentFiles.includes(file)) {
                    changes.deleted.push(file);
                }
            }

            // 检测修改文件
            const existingFiles = currentFiles.filter(file => indexedFiles.includes(file));
            for (const file of existingFiles) {
                if (enableHashComparison) {
                    const hasChanged = await this.hasFileChanged(projectPath, file);
                    if (hasChanged) {
                        changes.modified.push(file);
                    } else {
                        changes.unchanged.push(file);
                    }
                } else {
                    // 如果不启用哈希比较，则所有现有文件都视为已修改
                    changes.modified.push(file);
                }
            }

            this.logger.info(`File changes detected for project ${projectPath}`, {
                added: changes.added.length,
                modified: changes.modified.length,
                deleted: changes.deleted.length,
                unchanged: changes.unchanged.length
            });

            return changes;
        } catch (error) {
            this.errorHandler.handleError(
                new Error(`Failed to detect file changes: ${error instanceof Error ? error.message : String(error)}`),
                { component: 'FileChangeDetector', operation: 'detectChanges', projectPath }
            );
            throw error;
        }
    }

    /**
     * 检查文件是否发生变化
     */
    private async hasFileChanged(projectPath: string, filePath: string): Promise<boolean> {
        try {
            const currentHash = await this.calculateFileHash(filePath);
            const cacheKey = this.getCacheKey(projectPath, filePath);
            const cachedHash = this.fileHashes.get(cacheKey);

            if (!cachedHash) {
                // 新文件，需要索引
                await this.updateFileHash(projectPath, filePath, currentHash);
                return true;
            }

            const hasChanged = currentHash !== cachedHash.hash;
            if (hasChanged) {
                await this.updateFileHash(projectPath, filePath, currentHash);
            }

            return hasChanged;
        } catch (error) {
            this.logger.warn(`Failed to check file change for ${filePath}:`, error);
            // 如果无法计算哈希，则视为文件已变化
            return true;
        }
    }

    /**
     * 计算文件哈希
     */
    private async calculateFileHash(filePath: string): Promise<string> {
        try {
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            
            const hash = crypto.createHash('sha256');
            hash.update(content);
            hash.update(stats.mtime.toISOString());
            hash.update(stats.size.toString());
            
            return hash.digest('hex');
        } catch (error) {
            throw new Error(`Failed to calculate file hash for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 更新文件哈希缓存
     */
    private async updateFileHash(projectPath: string, filePath: string, hash: string): Promise<void> {
        try {
            const stats = await fs.stat(filePath);
            const cacheKey = this.getCacheKey(projectPath, filePath);
            
            this.fileHashes.set(cacheKey, {
                hash,
                mtime: stats.mtime,
                size: stats.size,
                lastChecked: new Date()
            });
        } catch (error) {
            this.logger.warn(`Failed to update file hash for ${filePath}:`, error);
        }
    }

    /**
     * 获取缓存的索引文件列表
     */
    private async getIndexedFiles(projectPath: string): Promise<string[]> {
        // 这里需要从索引服务获取已索引的文件列表
        // 暂时返回空数组，实际实现需要集成IndexingLogicService
        return [];
    }

    /**
     * 生成缓存键
     */
    private getCacheKey(projectPath: string, filePath: string): string {
        return `${projectPath}:${filePath}`;
    }

    /**
     * 清理项目缓存
     */
    clearProjectCache(projectPath: string): void {
        const prefix = `${projectPath}:`;
        for (const key of this.fileHashes.keys()) {
            if (key.startsWith(prefix)) {
                this.fileHashes.delete(key);
            }
        }
    }
}
```

### 3. 扩展IndexService实现

在 `IndexService` 类中添加手动更新方法：

```typescript
// 在IndexService类中添加以下方法

private updateOperations: Map<string, UpdateOperation> = new Map();

/**
 * 手动更新项目索引（增量更新）
 */
async updateIndex(projectPath: string, options?: UpdateIndexOptions): Promise<UpdateIndexResult> {
    const startTime = Date.now();
    const projectId = this.projectIdManager.getProjectId(projectPath);
    
    if (!projectId) {
        throw new Error(`Project not found: ${projectPath}`);
    }

    // 检查是否已有进行中的更新操作
    const existingOperation = this.updateOperations.get(projectId);
    if (existingOperation && existingOperation.status === 'running') {
        throw new Error(`Update operation already in progress for project: ${projectId}`);
    }

    const updateId = this.generateUpdateId();
    const updateOperation: UpdateOperation = {
        id: updateId,
        projectId,
        projectPath,
        status: 'running',
        startTime: new Date(),
        progress: {
            percentage: 0,
            currentFile: '',
            filesProcessed: 0,
            filesTotal: 0,
            estimatedTimeRemaining: 0
        },
        statistics: {
            totalFiles: 0,
            updatedFiles: 0,
            deletedFiles: 0,
            unchangedFiles: 0,
            errorCount: 0
        }
    };

    this.updateOperations.set(projectId, updateOperation);

    try {
        // 触发更新开始事件
        await this.emit('updateStarted', projectId, updateId);

        // 执行增量更新
        const result = await this.performIncrementalUpdate(projectPath, options, updateOperation);

        // 更新操作状态
        updateOperation.status = 'completed';
        updateOperation.endTime = new Date();
        updateOperation.processingTime = Date.now() - startTime;

        // 触发更新完成事件
        await this.emit('updateCompleted', projectId, result);

        return result;
    } catch (error) {
        // 更新操作失败
        updateOperation.status = 'failed';
        updateOperation.endTime = new Date();
        updateOperation.error = error instanceof Error ? error.message : String(error);

        // 触发更新错误事件
        await this.emit('updateError', projectId, error instanceof Error ? error : new Error(String(error)));

        throw error;
    } finally {
        // 清理操作状态（保留一段时间用于查询）
        setTimeout(() => {
            this.updateOperations.delete(projectId);
        }, 5 * 60 * 1000); // 5分钟后清理
    }
}

/**
 * 执行增量更新
 */
private async performIncrementalUpdate(
    projectPath: string, 
    options: UpdateIndexOptions = {}, 
    operation: UpdateOperation
): Promise<UpdateIndexResult> {
    const startTime = Date.now();
    const projectId = this.projectIdManager.getProjectId(projectPath)!;

    try {
        // 1. 检测文件变化
        operation.currentOperation = 'Detecting file changes';
        await this.updateProgress(projectId, operation);

        const changes = await this.fileChangeDetector.detectChanges(projectPath, {
            enableHashComparison: options.enableHashComparison ?? true
        });

        operation.statistics.totalFiles = changes.added.length + changes.modified.length + changes.deleted.length + changes.unchanged.length;
        operation.progress.filesTotal = operation.statistics.totalFiles;

        // 2. 处理变化的文件
        operation.currentOperation = 'Processing file changes';
        await this.updateProgress(projectId, operation);

        const updateResults = await this.processFileChanges(projectPath, changes, options, operation);

        // 3. 返回结果
        return {
            projectId,
            projectPath,
            updateId: operation.id,
            status: 'completed',
            totalFiles: operation.statistics.totalFiles,
            updatedFiles: updateResults.updatedFiles,
            deletedFiles: updateResults.deletedFiles,
            unchangedFiles: updateResults.unchangedFiles,
            errors: updateResults.errors,
            processingTime: Date.now() - startTime,
            startTime: operation.startTime.toISOString(),
            estimatedCompletionTime: new Date(Date.now() + operation.progress.estimatedTimeRemaining * 1000).toISOString()
        };
    } catch (error) {
        throw new Error(`Incremental update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 处理文件变化
 */
private async processFileChanges(
    projectPath: string,
    changes: FileChanges,
    options: UpdateIndexOptions,
    operation: UpdateOperation
): Promise<{ updatedFiles: number; deletedFiles: number; unchangedFiles: number; errors: Array<{ filePath: string; error: string; timestamp: string }> }> {
    const results = {
        updatedFiles: 0,
        deletedFiles: 0,
        unchangedFiles: changes.unchanged.length,
        errors: [] as Array<{ filePath: string; error: string; timestamp: string }>
    };

    const filesToUpdate = [...changes.added, ...changes.modified];
    const batchSize = options.batchSize || 100;
    const maxConcurrency = options.maxConcurrency || 3;

    // 处理新增和修改的文件
    if (filesToUpdate.length > 0) {
        const batchResults = await this.performanceOptimizer.processBatches(
            filesToUpdate,
            async (batch) => {
                const promises = batch.map(async (file) => {
                    operation.currentFile = file;
                    operation.progress.filesProcessed++;
                    operation.progress.percentage = Math.round((operation.progress.filesProcessed / operation.progress.filesTotal) * 100);
                    
                    // 更新预计剩余时间
                    const elapsedTime = Date.now() - operation.startTime.getTime();
                    const filesPerSecond = operation.progress.filesProcessed / (elapsedTime / 1000);
                    operation.progress.estimatedTimeRemaining = filesPerSecond > 0 
                        ? Math.round((operation.progress.filesTotal - operation.progress.filesProcessed) / filesPerSecond)
                        : 0;

                    await this.updateProgress(operation.projectId, operation);

                    try {
                        await this.performanceOptimizer.executeWithRetry(
                            () => this.indexFile(projectPath, file),
                            `updateFile:${file}`
                        );
                        results.updatedFiles++;
                    } catch (error) {
                        results.errors.push({
                            filePath: file,
                            error: error instanceof Error ? error.message : String(error),
                            timestamp: new Date().toISOString()
                        });
                        operation.statistics.errorCount++;
                    }
                });

                await this.concurrencyService.processWithConcurrency(promises, maxConcurrency);
                return batch.map(file => ({ filePath: file, success: true }));
            },
            'incrementalUpdate'
        );
    }

    // 处理删除的文件
    for (const file of changes.deleted) {
        try {
            await this.removeFileFromIndex(projectPath, file);
            results.deletedFiles++;
            operation.statistics.deletedFiles++;
        } catch (error) {
            results.errors.push({
                filePath: file,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString()
            });
            operation.statistics.errorCount++;
        }
    }

    return results;
}

/**
 * 获取更新进度
 */
getUpdateProgress(projectId: string): UpdateProgress | null {
    const operation = this.updateOperations.get(projectId);
    if (!operation) {
        return null;
    }

    return {
        projectId: operation.projectId,
        updateId: operation.id,
        status: operation.status,
        progress: { ...operation.progress },
        statistics: { ...operation.statistics },
        startTime: operation.startTime.toISOString(),
        lastUpdated: new Date().toISOString(),
        currentOperation: operation.currentOperation
    };
}

/**
 * 取消更新操作
 */
async cancelUpdate(projectId: string): Promise<boolean> {
    const operation = this.updateOperations.get(projectId);
    if (!operation || operation.status !== 'running') {
        return false;
    }

    operation.status = 'cancelled';
    operation.endTime = new Date();

    // 触发取消事件
    await this.emit('updateCancelled', projectId, operation.id);

    return true;
}

/**
 * 生成更新ID
 */
private generateUpdateId(): string {
    return `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 更新进度
 */
private async updateProgress(projectId: string, operation: UpdateOperation): Promise<void> {
    await this.emit('updateProgress', projectId, {
        projectId: operation.projectId,
        updateId: operation.id,
        status: operation.status,
        progress: { ...operation.progress },
        statistics: { ...operation.statistics },
        startTime: operation.startTime.toISOString(),
        lastUpdated: new Date().toISOString(),
        currentOperation: operation.currentOperation
    });
}
```

### 4. 扩展IndexingRoutes

在 `IndexingRoutes` 中添加手动更新端点：

```typescript
// 在setupRoutes方法中添加
this.router.post('/:projectId/update', this.updateIndex.bind(this));
this.router.get('/:projectId/update/progress', this.getUpdateProgress.bind(this));
this.router.delete('/:projectId/update', this.cancelUpdate.bind(this));

// 实现手动更新端点
private async updateIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { projectId } = req.params;
        const { options } = req.body;

        if (!projectId) {
            res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
            return;
        }

        const projectPath = this.projectIdManager.getProjectPath(projectId);
        if (!projectPath) {
            res.status(404).json({
                success: false,
                error: 'Project not found',
            });
            return;
        }

        // 开始手动更新
        const result = await this.indexSyncService.updateIndex(projectPath, options);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        if (error instanceof Error && error.message.includes('already in progress')) {
            res.status(409).json({
                success: false,
                error: 'Update operation already in progress',
            });
        } else {
            this.logger.error('Failed to update index:', { error, projectId: req.params.projectId });
            next(error);
        }
    }
}

private async getUpdateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
            return;
        }

        const progress = this.indexSyncService.getUpdateProgress(projectId);
        if (!progress) {
            res.status(404).json({
                success: false,
                error: 'No active update operation found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: progress,
        });
    } catch (error) {
        this.logger.error('Failed to get update progress:', { error, projectId: req.params.projectId });
        next(error);
    }
}

private async cancelUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            res.status(400).json({
                success: false,
                error: 'projectId is required',
            });
            return;
        }

        const cancelled = await this.indexSyncService.cancelUpdate(projectId);
        if (!cancelled) {
            res.status(404).json({
                success: false,
                error: 'No active update operation found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                projectId,
                message: 'Update operation cancelled successfully'
            },
        });
    } catch (error) {
        this.logger.error('Failed to cancel update:', { error, projectId: req.params.projectId });
        next(error);
    }
}
```

## 🎨 前端实现

### 1. 扩展API客户端

在 `frontend/src/services/api.ts` 中添加手动更新相关方法：

```typescript
// 添加接口定义
export interface UpdateIndexRequest {
    options?: {
        batchSize?: number;
        maxConcurrency?: number;
        enableHashComparison?: boolean;
        forceUpdate?: boolean;
        includePatterns?: string[];
        excludePatterns?: string[];
    };
}

export interface UpdateIndexResponse {
    projectId: string;
    projectPath: string;
    updateId: string;
    status: 'started' | 'completed' | 'failed' | 'cancelled';
    totalFiles: number;
    updatedFiles: number;
    deletedFiles: number;
    unchangedFiles: number;
    errors: Array<{
        filePath: string;
        error: string;
        timestamp: string;
    }>;
    processingTime: number;
    startTime: string;
    estimatedCompletionTime?: string;
}

export interface UpdateProgress {
    projectId: string;
    updateId: string;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    progress: {
        percentage: number;
        currentFile: string;
        filesProcessed: number;
        filesTotal: number;
        estimatedTimeRemaining: number;
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
    currentOperation?: string;
}

// 添加API方法
export class ApiClient {
    /**
     * 手动更新项目索引
     */
    async updateProjectIndex(projectId: string, options?: UpdateIndexRequest['options']): Promise<ApiResponse<UpdateIndexResponse>> {
        return this.request('POST', `/api/v1/indexing/${projectId}/update`, { options });
    }

    /**
     * 获取更新进度
     */
    async getUpdateProgress(projectId: string): Promise<ApiResponse<UpdateProgress>> {
        return this.request('GET', `/api/v1/indexing/${projectId}/update/progress`);
    }

    /**
     * 取消更新操作
     */
    async cancelUpdate(projectId: string): Promise<ApiResponse<void>> {
        return this.request('DELETE', `/api/v1/indexing/${projectId}/update`);
    }
}
```

### 2. 创建更新进度组件

创建 `frontend/src/components/UpdateProgressModal.ts`：

```typescript
export class UpdateProgressModal {
    private modal: HTMLElement;
    private progressBar: HTMLElement;
    private progressText: HTMLElement;
    private detailsContainer: HTMLElement;
    private closeButton: HTMLElement;
    private cancelButton: HTMLElement;
    private onClose?: () => void;
    private onCancel?: (projectId: string) => void;
    private currentProjectId: string | null = null;
    private progressInterval: number | null = null;

    constructor() {
        this.render();
        this.setupEventListeners();
    }

    private render(): void {
        this.modal = document.createElement('div');
        this.modal.className = 'modal update-progress-modal';
        this.modal.style.display = 'none';
        
        this.modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>更新索引进度</h3>
                    <button class="close-button">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="progress-section">
                        <div class="progress-info">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 0%"></div>
                            </div>
                            <div class="progress-text">处理中: 0%</div>
                        </div>
                        
                        <div class="progress-details">
                            <div class="detail-item">
                                <span class="label">当前文件:</span>
                                <span class="value" id="current-file">-</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">已处理:</span>
                                <span class="value" id="files-processed">0</span> / 
                                <span class="value" id="files-total">0</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">预计剩余时间:</span>
                                <span class="value" id="estimated-time">-</span>
                            </div>
                            <div class="detail-item">
                                <span class="label">当前操作:</span>
                                <span class="value" id="current-operation">-</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="statistics-section">
                        <h4>统计信息</h4>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">更新文件:</span>
                                <span class="stat-value" id="updated-files">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">删除文件:</span>
                                <span class="stat-value" id="deleted-files">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">未变化文件:</span>
                                <span class="stat-value" id="unchanged-files">0</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">错误:</span>
                                <span class="stat-value error" id="error-count">0</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="errors-section" id="errors-container" style="display: none;">
                        <h4>错误详情</h4>
                        <div class="errors-list" id="errors-list"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel">取消更新</button>
                    <button class="btn-close">关闭</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        
        // 获取DOM元素引用
        this.progressBar = this.modal.querySelector('.progress-fill') as HTMLElement;
        this.progressText = this.modal.querySelector('.progress-text') as HTMLElement;
        this.detailsContainer = this.modal.querySelector('.progress-details') as HTMLElement;
        this.closeButton = this.modal.querySelector('.close-button') as HTMLElement;
        this.cancelButton = this.modal.querySelector('.btn-cancel') as HTMLElement;
    }

    private setupEventListeners(): void {
        this.closeButton.addEventListener('click', () => this.hide());
        this.modal.querySelector('.btn-close')?.addEventListener('click', () => this.hide());
        this.cancelButton.addEventListener('click', () => this.handleCancel());
        
        // 点击模态框外部关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }

    show(projectId: string, projectName: string, onCancel?: (projectId: string) => void): void {
        this.currentProjectId = projectId;
        this.onCancel = onCancel;
        
        // 更新标题
        const title = this.modal.querySelector('h3');
        if (title) {
            title.textContent = `更新索引进度 - ${projectName}`;
        }
        
        this.modal.style.display = 'flex';
        this.startProgressPolling();
    }

    hide(): void {
        this.modal.style.display = 'none';
        this.stopProgressPolling();
        this.currentProjectId = null;
        this.onClose?.();
    }

    updateProgress(progress: UpdateProgress): void {
        // 更新进度条
        this.progressBar.style.width = `${progress.progress.percentage}%`;
        this.progressText.textContent = `处理中: ${progress.progress.percentage}%`;
        
        // 更新详细信息
        this.updateElementText('current-file', progress.progress.currentFile || '-');
        this.updateElementText('files-processed', progress.progress.filesProcessed.toString());
        this.updateElementText('files-total', progress.progress.filesTotal.toString());
        this.updateElementText('estimated-time', this.formatTime(progress.progress.estimatedTimeRemaining));
        this.updateElementText('current-operation', progress.currentOperation || '-');
        
        // 更新统计信息
        this.updateElementText('updated-files', progress.statistics.updatedFiles.toString());
        this.updateElementText('deleted-files', progress.statistics.deletedFiles.toString());
        this.updateElementText('unchanged-files', progress.statistics.unchangedFiles.toString());
        this.updateElementText('error-count', progress.statistics.errorCount.toString());
        
        // 显示/隐藏错误区域
        const errorsContainer = this.modal.querySelector('#errors-container') as HTMLElement;
        if (progress.statistics.errorCount > 0) {
            errorsContainer.style.display = 'block';
            this.updateErrors(progress);
        } else {
            errorsContainer.style.display = 'none';
        }
        
        // 根据状态更新UI
        if (progress.status !== 'running') {
            this.cancelButton.style.display = 'none';
            this.updateElementText('current-operation', `更新${this.getStatusText(progress.status)}`);
        }
    }

    private updateElementText(id: string, text: string): void {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    private updateErrors(progress: UpdateProgress): void {
        // 在实际实现中，这里应该从API获取错误详情
        const errorsList = document.getElementById('errors-list');
        if (errorsList) {
            errorsList.innerHTML = `
                <div class="error-item">
                    <span class="error-count">${progress.statistics.errorCount} 个错误</span>
                    <span class="error-message">查看日志获取详细信息</span>
                </div>
            `;
        }
    }

    private formatTime(seconds: number): string {
        if (seconds <= 0) return '-';
        if (seconds < 60) return `${seconds}秒`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
        return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`;
    }

    private getStatusText(status: string): string {
        switch (status) {
            case 'completed': return '完成';
            case 'failed': return '失败';
            case 'cancelled': return '已取消';
            default: return '进行中';
        }
    }

    private startProgressPolling(): void {
        this.stopProgressPolling();
        
        this.progressInterval = window.setInterval(async () => {
            if (!this.currentProjectId) return;
            
            try {
                const response = await this.apiClient.getUpdateProgress(this.currentProjectId);
                if (response.success && response.data) {
                    this.updateProgress(response.data);
                    
                    // 如果更新完成，停止轮询
                    if (response.data.status !== 'running') {
                        this.stopProgressPolling();
                    }
                }
            } catch (error) {
                console.error('Failed to fetch update progress:', error);
            }
        }, 1000); // 每秒轮询一次
    }

    private stopProgressPolling(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    private handleCancel(): void {
        if (this.currentProjectId && this.onCancel) {
            this.onCancel(this.currentProjectId);
        }
        this.hide();
    }

    setApiClient(apiClient: ApiClient): void {
        this.apiClient = apiClient;
    }
}
```

### 3. 扩展ProjectsPage

在 `ProjectsPage` 中添加手动更新功能：

```typescript
// 在ProjectsPage类中添加
private updateProgressModal: UpdateProgressModal;

constructor(container: HTMLElement, apiClient: ApiClient) {
    this.container = container;
    this.apiClient = apiClient;
    this.updateProgressModal = new UpdateProgressModal();
    this.updateProgressModal.setApiClient(apiClient);
    this.render();
    this.setupEventListeners();
    this.loadProjectsList();
    this.setupBatchOperations();
}

// 在项目操作列添加更新按钮
private renderProjectRow(project: any): string {
    return `
        <tr>
            <td><input type="checkbox" class="project-checkbox" data-project-id="${project.projectId}"></td>
            <td>${project.name || 'Unknown'}</td>
            <td class="project-path">${project.projectPath}</td>
            <td>${project.status?.totalFiles || 0}</td>
            <td>
                <span class="status-badge ${this.getVectorStatusClass(project)}">
                    ${this.getVectorStatusText(project)}
                </span>
            </td>
            <td>
                <span class="status-badge ${this.getGraphStatusClass(project)}">
                    ${this.getGraphStatusText(project)}
                </span>
            </td>
            <td class="project-actions">
                <button class="btn-update" data-project-id="${project.projectId}" title="手动更新索引">
                    🔄 更新
                </button>
                <button class="btn-reindex" data-project-id="${project.projectId}" title="重新构建索引">
                    🔄 重建
                </button>
                <button class="btn-delete" data-project-id="${project.projectId}" title="删除索引">
                    🗑️ 删除
                </button>
            </td>
        </tr>
    `;
}

// 添加更新按钮事件处理
private setupEventListeners(): void {
    // 现有事件监听器...
    
    // 手动更新按钮事件
    this.container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('btn-update')) {
            const projectId = target.getAttribute('data-project-id');
            if (projectId) {
                this.handleManualUpdate(projectId);
            }
        }
    });
}

private async handleManualUpdate(projectId: string): Promise<void> {
    try {
        // 显示确认对话框
        const confirmed = confirm('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
        if (!confirmed) return;

        // 开始更新
        const response = await this.apiClient.updateProjectIndex(projectId);
        
        if (response.success) {
            // 显示进度模态框
            const project = this.getProjectById(projectId);
            this.updateProgressModal.show(
                projectId, 
                project?.name || projectId,
                (cancelProjectId) => this.handleCancelUpdate(cancelProjectId)
            );
            
            // 显示成功消息
            this.showNotification('手动更新已开始', 'success');
        } else {
            this.showNotification(`更新失败: ${response.error}`, 'error');
        }
    } catch (error) {
        console.error('Manual update failed:', error);
        this.showNotification('手动更新失败', 'error');
    }
}

private async handleCancelUpdate(projectId: string): Promise<void> {
    try {
        await this.apiClient.cancelUpdate(projectId);
        this.showNotification('更新操作已取消', 'warning');
    } catch (error) {
        console.error('Cancel update failed:', error);
        this.showNotification('取消更新失败', 'error');
    }
}

private getProjectById(projectId: string): any {
    // 从项目列表中查找项目
    const projectsList = this.container.querySelector('#projects-list');
    if (!projectsList) return null;
    
    const rows = projectsList.querySelectorAll('tr');
    for (const row of rows) {
        const checkbox = row.querySelector('.project-checkbox') as HTMLInputElement;
        if (checkbox && checkbox.getAttribute('data-project-id') === projectId) {
            // 返回项目数据（需要根据实际数据结构调整）
            return {
                projectId,
                name: row.cells[1].textContent,
                projectPath: row.cells[2].textContent
            };
        }
    }
    return null;
}

private showNotification(message: string, type: 'success' | 'error' | 'warning'): void {
    // 实现通知显示逻辑
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        z-index: 1000;
        ${type === 'success' ? 'background-color: #10b981;' : ''}
        ${type === 'error' ? 'background-color: #ef4444;' : ''}
        ${type === 'warning' ? 'background-color: #f59e0b;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}
```

## 🧪 测试实现

### 1. 单元测试

创建 `src/service/index/__tests__/IncrementalUpdate.test.ts`：

```typescript
describe('Incremental Update', () => {
    let indexService: IndexService;
    let fileChangeDetector: FileChangeDetector;

    beforeEach(() => {
        // 设置测试环境
        indexService = new IndexService(/* 依赖注入 */);
        fileChangeDetector = new FileChangeDetector(/* 依赖注入 */);
    });

    it('应该正确检测文件变化', async () => {
        // 测试文件变化检测逻辑
        const changes = await fileChangeDetector.detectChanges('/test/project');
        expect(changes).toHaveProperty('added');
        expect(changes).toHaveProperty('modified');
        expect(changes).toHaveProperty('deleted');
        expect(changes).toHaveProperty('unchanged');
    });

    it('应该成功执行增量更新', async () => {
        // 测试完整的增量更新流程
        const result = await indexService.updateIndex('/test/project');
        expect(result.status).toBe('completed');
        expect(result.updatedFiles).toBeGreaterThanOrEqual(0);
        expect(result.deletedFiles).toBeGreaterThanOrEqual(0);
    });

    it('应该处理更新冲突', async () => {
        // 测试并发更新冲突处理
        const update1 = indexService.updateIndex('/test/project');
        const update2 = indexService.updateIndex('/test/project');
        
        await expect(update2).rejects.toThrow('already in progress');
    });
});
```

### 2. 集成测试

创建 `src/api/routes/__tests__/IndexingRoutes.update.test.ts`：

```typescript
describe('Manual Update API', () => {
    let app: express.Application;
    let indexService: IndexService;

    beforeAll(() => {
        // 设置测试应用
        app = createTestApp();
        indexService = getTestIndexService();
    });

    it('应该成功启动手动更新', async () => {
        const response = await request(app)
            .post('/api/v1/indexing/test-project/update')
            .send({ options: { batchSize: 50 } })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('started');
        expect(response.body.data.updateId).toBeDefined();
    });

    it('应该返回更新进度', async () => {
        const response = await request(app)
            .get('/api/v1/indexing/test-project/update/progress')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('progress');
    });
});
```

## 🔧 配置和依赖

### 1. 依赖注入配置

在 `src/core/DIContainer.ts` 中注册新服务：

```typescript
// 注册FileChangeDetector
container.bind<FileChangeDetector>(TYPES.FileChangeDetector).to(FileChangeDetector).inSingletonScope();

// 在IndexService构造函数中注入
@inject(TYPES.FileChangeDetector) private fileChangeDetector: FileChangeDetector
```

### 2. 类型定义

在 `src/types.ts` 中添加类型定义：

```typescript
// 手动更新相关类型
export const TYPES = {
    // ... 现有类型
    FileChangeDetector: Symbol.for('FileChangeDetector'),
};

export interface UpdateIndexOptions {
    batchSize?: number;
    maxConcurrency?: number;
    enableHashComparison?: boolean;
    forceUpdate?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
}

export interface UpdateIndexResult {
    projectId: string;
    projectPath: string;
    updateId: string;
    status: 'started' | 'completed' | 'failed' | 'cancelled';
    totalFiles: number;
    updatedFiles: number;
    deletedFiles: number;
    unchangedFiles: number;
    errors: Array<{
        filePath: string;
        error: string;
        timestamp: string;
    }>;
    processingTime: number;
    startTime: string;
    estimatedCompletionTime?: string;
}
```

## 📋 部署检查清单

### 后端部署
- [ ] 编译TypeScript代码
- [ ] 运行单元测试
- [ ] 运行集成测试
- [ ] 验证依赖注入配置
- [ ] 检查API端点注册

### 前端部署
- [ ] 编译TypeScript代码
- [ ] 测试组件功能
- [ ] 验证API调用
- [ ] 检查样式和布局

### 系统集成测试
- [ ] 测试完整的手动更新流程
- [ ] 验证错误处理
- [ ] 测试并发操作
- [ ] 验证性能表现

这个实现指南提供了完整的手动更新索引功能的实现方案，包括后端服务、前端界面和测试策略。