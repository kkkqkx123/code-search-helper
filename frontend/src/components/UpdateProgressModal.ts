/**
 * 更新进度模态框组件
 * 用于显示手动更新索引的进度和状态
 */

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

export class UpdateProgressModal {
    private modal!: HTMLElement;
    private progressBar!: HTMLElement;
    private progressText!: HTMLElement;
    private closeButton!: HTMLElement;
    private cancelButton!: HTMLElement;
    private onClose?: () => void;
    private onCancel?: (projectId: string) => void;
    private currentProjectId: string | null = null;
    private progressInterval: number | null = null;
    private apiClient: any;

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

    setApiClient(apiClient: any): void {
        this.apiClient = apiClient;
    }
}