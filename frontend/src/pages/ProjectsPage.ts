import { ApiClient } from '../services/api.js';
import { UpdateProgressModal } from '../components/UpdateProgressModal.js';

/**
 * 已索引项目页面组件
 */
export class ProjectsPage {
    private apiClient: ApiClient;
    private container: HTMLElement;
    private onProjectActionComplete?: (action: string, result: any) => void;
    private refreshInterval: number | null = null;
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

    /**
     * 渲染已索引项目页面
     */
    private render() {
        this.container.innerHTML = `
            <div class="projects-container">
                <div class="projects-toolbar">
                    <h2>已索引项目</h2>
                    <button id="refresh-projects" class="search-button" style="background-color: #64748b; padding: 6px 12px; font-size: 14px;">刷新</button>
                </div>
                
                <batch-operations-panel id="batch-operations"></batch-operations-panel>
                
                                <table class="projects-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-projects" title="选择所有项目"></th>
                            <th>项目名称</th>
                            <th>路径</th>
                            <th>文件数</th>
                            <th>热重载</th>
                            <th>索引状态</th>
                            <th>单独执行</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="projects-list">
                        <!-- 动态填充 -->
                    </tbody>
                </table>
                <div id="projects-loading" class="loading" style="display: none; padding: 20px;">加载中...</div>
                <div id="projects-error" class="error" style="display: none; margin: 20px;"></div>
            </div>
        `;
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners() {
        const refreshProjectsButton = this.container.querySelector('#refresh-projects') as HTMLButtonElement;

        refreshProjectsButton?.addEventListener('click', () => {
            // 强制刷新项目列表，清除缓存
            this.loadProjectsList(true);
        });
    }

    /**
     * 设置批量操作面板
     */
    private setupBatchOperations() {
        const batchPanel = this.container.querySelector('#batch-operations') as HTMLElement & { setApiClient: (apiClient: any) => void };
        if (batchPanel && typeof batchPanel.setApiClient === 'function') {
            batchPanel.setApiClient(this.apiClient);
        }
    }

    /**
     * 加载项目列表
     */
    async loadProjectsList(forceRefresh: boolean = false) {
        const projectsList = this.container.querySelector('#projects-list') as HTMLElement;
        const loadingDiv = this.container.querySelector('#projects-loading') as HTMLElement;
        const errorDiv = this.container.querySelector('#projects-error') as HTMLElement;

        if (!projectsList || !loadingDiv || !errorDiv) return;

        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        projectsList.innerHTML = '';

        try {
            const result = await this.apiClient.getProjects(forceRefresh);

            if (result.success && result.data) {
                if (result.data.length > 0) {
                    this.renderProjectsList(result.data, projectsList);
                } else {
                    // 项目列表为空，显示友好提示
                    projectsList.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 20px; color: #6b7280;">
                                暂无已索引项目，请先创建项目索引
                            </td>
                        </tr>
                    `;
                }
            } else {
                errorDiv.style.display = 'block';
                errorDiv.textContent = '加载项目列表失败: ' + (result.error || '未知错误');
            }
        } catch (error: any) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = '加载项目列表时发生错误: ' + error.message;
        } finally {
            loadingDiv.style.display = 'none';
        }
    }

    /**
     * 渲染项目列表
     */
    private renderProjectsList(projects: any[], container: HTMLElement) {
        if (!container) return;

        container.innerHTML = projects.map(project => `
            <tr>
                <td><input type="checkbox" class="project-checkbox" data-project-id="${project.id}" title="选择项目"></td>
                <td>${this.escapeHtml(project.name || project.id)}</td>
                <td>${this.escapeHtml(project.path || 'N/A')}</td>
                <td>${project.fileCount || 0}</td>
                <td>
                    <hot-reload-status 
                        project-id="${project.id}"
                        enabled="${project.hotReload?.enabled || false}"
                        changes-detected="${project.hotReload?.changesDetected || 0}"
                        errors-count="${project.hotReload?.errorsCount || 0}">
                    </hot-reload-status>
                </td>
                <td>
                    <storage-status-indicator
                        project-id="${project.id}"
                        vector-status="${project.vectorStatus?.status || 'pending'}"
                        graph-status="${project.graphStatus?.status || 'pending'}">
                    </storage-status-indicator>
                </td>
                <td>
                    <storage-action-buttons
                        project-id="${project.id}"
                        vector-status="${project.vectorStatus?.status || 'pending'}"
                        graph-status="${project.graphStatus?.status || 'pending'}">
                    </storage-action-buttons>
                </td>
                <td>
                    <div class="hot-reload-actions">
                        <button class="action-button toggle" 
                                data-project-id="${project.id}" 
                                data-enabled="${project.hotReload?.enabled || false}"
                                title="${project.hotReload?.enabled ? '禁用热重载' : '启用热重载'}">
                            ${project.hotReload?.enabled ? '🔴 禁用' : '🟢 启用'}
                        </button>
                        <button class="action-button configure" 
                                data-project-id="${project.id}" 
                                data-action="configure-hot-reload"
                                title="配置热重载">
                            ⚙️ 配置
                        </button>
                    </div>
                    <button class="action-button update" data-project-id="${project.id}" data-action="update">🔄 更新</button>
                    <button class="action-button reindex" data-project-id="${project.id}" data-action="reindex">重新索引</button>
                    <button class="action-button delete" data-project-id="${project.id}" data-action="delete">删除</button>
                </td>
            </tr>
        `).join('');

        // 为操作按钮添加事件监听器
        container.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const projectId = target.dataset.projectId;
                const action = target.dataset.action;

                if (projectId && action) {
                    if (action === 'update') {
                        this.handleManualUpdate(projectId);
                    } else if (action === 'reindex') {
                        this.reindexProject(projectId);
                    } else if (action === 'delete') {
                        this.deleteProject(projectId, target);
                    } else if (action === 'configure-hot-reload') {
                        this.configureHotReload(projectId);
                    } else if (target.classList.contains('toggle')) {
                        this.toggleHotReload(projectId, target);
                    }
                }
            });
        });

        // 为存储操作按钮添加事件监听器
        container.querySelectorAll('storage-action-buttons').forEach((element: Element) => {
            (element as HTMLElement).addEventListener('storage-action', async (e: any) => {
                const { projectId, action } = e.detail;
                if (action === 'index-vectors') {
                    await this.indexVectors(projectId);
                } else if (action === 'index-graph') {
                    await this.indexGraph(projectId);
                }
            });
        });

        // 为项目复选框添加事件监听器
        container.querySelectorAll('.project-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const projectId = target.dataset.projectId;
                if (projectId) {
                    document.dispatchEvent(new CustomEvent('project-selected', {
                        detail: {
                            projectId,
                            selected: target.checked
                        }
                    }));
                }
            });
        });

        // 为全选复选框添加事件监听器
        const selectAllCheckbox = this.container.querySelector('#select-all-projects') as HTMLInputElement;
        if (selectAllCheckbox) {
            selectAllCheckbox.onchange = (e) => {
                const target = e.target as HTMLInputElement;
                const checkboxes = container.querySelectorAll('.project-checkbox') as NodeListOf<HTMLInputElement>;
                checkboxes.forEach(checkbox => {
                    checkbox.checked = target.checked;
                    document.dispatchEvent(new CustomEvent('project-selected', {
                        detail: {
                            projectId: checkbox.dataset.projectId,
                            selected: target.checked
                        }
                    }));
                });
            };
        }
    }


    /**
     * 重新索引项目
     */
    async reindexProject(projectId: string) {
        if (!confirm('确定要重新索引该项目吗？')) return;

        try {
            const result = await this.apiClient.reindexProject(projectId);

            if (result.success) {
                alert('重新索引已启动');
                // 清除相关缓存
                this.apiClient.clearProjectsCache();
                this.apiClient.clearSearchCache();
                // 刷新项目列表
                this.loadProjectsList(true);

                if (this.onProjectActionComplete) {
                    this.onProjectActionComplete('reindex', result);
                }
            } else {
                alert('重新索引失败: ' + (result.error || '未知错误'));
            }
        } catch (error: any) {
            alert('重新索引时发生错误: ' + error.message);
        }
    }

    /**
     * 删除项目
     */
    async deleteProject(projectId: string, element: HTMLElement) {
        if (!confirm('确定要删除该项目的索引吗？此操作不可撤销。')) return;

        try {
            const result = await this.apiClient.deleteProject(projectId);

            if (result.success) {
                // 清除相关缓存
                this.apiClient.clearProjectsCache();
                this.apiClient.clearSearchCache();
                // 从界面移除该项目
                element.closest('tr')?.remove();
                alert('项目已删除');

                if (this.onProjectActionComplete) {
                    this.onProjectActionComplete('delete', result);
                }
            } else {
                alert('删除项目失败: ' + (result.error || '未知错误'));
            }
        } catch (error: any) {
            alert('删除项目时发生错误: ' + error.message);
        }
    }

    /**
     * 执行向量索引
     */
    async indexVectors(projectId: string) {
        try {
            const result = await this.apiClient.indexVectors(projectId);

            if (result.success) {
                alert('向量索引已启动');
                // 清除相关缓存
                this.apiClient.clearProjectsCache();
                // 刷新项目列表
                this.loadProjectsList(true);

                if (this.onProjectActionComplete) {
                    this.onProjectActionComplete('indexVectors', result);
                }
            } else {
                alert('向量索引启动失败: ' + (result.error || '未知错误'));
            }
        } catch (error: any) {
            alert('启动向量索引时发生错误: ' + error.message);
        }
    }

    /**
 * 执行图索引
 */
    async indexGraph(projectId: string) {
        try {
            const result = await this.apiClient.indexGraph(projectId);

            if (result.success) {
                alert('图索引已启动');
                // 清除相关缓存
                this.apiClient.clearProjectsCache();
                // 刷新项目列表
                this.loadProjectsList(true);

                if (this.onProjectActionComplete) {
                    this.onProjectActionComplete('indexGraph', result);
                }
            } else {
                alert('图索引启动失败: ' + (result.error || '未知错误'));
            }
        } catch (error: any) {
            alert('启动图索引时发生错误: ' + error.message);
        }
    }

    /**
     * 切换热重载状态
     */
    async toggleHotReload(projectId: string, button: HTMLButtonElement) {
        const currentEnabled = button.dataset.enabled === 'true';
        const newEnabled = !currentEnabled;

        try {
            const result = await this.apiClient.toggleProjectHotReload(projectId, newEnabled);

            if (result.success) {
                // 更新按钮状态
                button.dataset.enabled = newEnabled.toString();
                button.title = newEnabled ? '禁用热重载' : '启用热重载';
                button.textContent = newEnabled ? '🔴 禁用' : '🟢 启用';

                // 更新状态指示器
                const statusIndicator = this.container.querySelector(`hot-reload-status[project-id="${projectId}"]`) as HTMLElement;
                if (statusIndicator) {
                    statusIndicator.setAttribute('enabled', newEnabled.toString());
                }

                alert(newEnabled ? '热重载已启用' : '热重载已禁用');

                // 清除缓存并刷新
                this.apiClient.clearProjectsCache();
                this.loadProjectsList(true);
            } else {
                alert('切换热重载状态失败: ' + (result.error || '未知错误'));
            }
        } catch (error: any) {
            alert('切换热重载状态时发生错误: ' + error.message);
        }
    }

    /**
     * 配置热重载
     */
    async configureHotReload(projectId: string) {
        try {
            // 获取项目信息
            const projectsResult = await this.apiClient.getProjects();
            if (!projectsResult.success || !projectsResult.data) {
                alert('无法获取项目信息');
                return;
            }

            const project = projectsResult.data.find((p: { id: string; }) => p.id === projectId);
            if (!project) {
                alert('找不到指定项目');
                return;
            }

            // 获取当前热重载配置
            const configResult = await this.apiClient.getProjectHotReloadConfig(projectId);
            if (!configResult.success) {
                alert('无法获取热重载配置: ' + (configResult.error || '未知错误'));
                return;
            }

            // 创建并显示配置模态框
            const modal = document.createElement('hot-reload-config-modal') as any;
            modal.setProjectInfo(projectId, project.name || projectId, configResult.data);

            // 监听配置保存事件
            modal.addEventListener('config-saved', (event: any) => {
                const { projectId: savedProjectId, config } = event.detail;
                console.log('热重载配置已保存:', savedProjectId, config);

                // 清除缓存并刷新项目列表
                this.apiClient.clearProjectsCache();
                this.loadProjectsList(true);

                alert('热重载配置已保存');
            });

            // 监听模态框关闭事件
            modal.addEventListener('modal-closed', () => {
                modal.remove();
            });

            document.body.appendChild(modal);
        } catch (error: any) {
            alert('配置热重载时发生错误: ' + error.message);
        }
    }

    /**
     * 处理手动更新
     */
    private async handleManualUpdate(projectId: string): Promise<void> {
        try {
            // 显示确认对话框
            const confirmed = confirm('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
            if (!confirmed) return;

            // 获取项目信息
            const projectsResult = await this.apiClient.getProjects();
            if (!projectsResult.success || !projectsResult.data) {
                alert('无法获取项目信息');
                return;
            }

            const project = projectsResult.data.find((p: { id: string; }) => p.id === projectId);
            if (!project) {
                alert('找不到指定项目');
                return;
            }

            // 开始更新
            const response = await this.apiClient.updateProjectIndex(projectId);

            if (response.success) {
                // 显示进度模态框
                this.updateProgressModal.show(
                    projectId,
                    project.name || projectId,
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

    /**
     * 处理取消更新
     */
    private async handleCancelUpdate(projectId: string): Promise<void> {
        try {
            await this.apiClient.cancelUpdate(projectId);
            this.showNotification('更新操作已取消', 'warning');
        } catch (error) {
            console.error('Cancel update failed:', error);
            this.showNotification('取消更新失败', 'error');
        }
    }

    /**
     * 显示通知消息
     */
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

    /**
     * 启用自动刷新
     */
    enableAutoRefresh(intervalMs: number = 5000) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = window.setInterval(() => {
            this.loadProjectsList(true);
        }, intervalMs);
    }

    /**
     * 禁用自动刷新
     */
    disableAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /**
     * 销毁页面实例
     */
    destroy() {
        this.disableAutoRefresh();
    }

    /**
     * HTML转义
     */
    private escapeHtml(text: string): string {
        const map: { [key: string]: string } = {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '&#039;'
        };

        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    /**
     * 设置项目操作完成回调
     */
    setOnProjectActionComplete(callback: (action: string, result: any) => void) {
        this.onProjectActionComplete = callback;
    }

    /**
     * 刷新项目列表
     */
    refresh() {
        this.loadProjectsList();
    }

    /**
     * 显示页面
     */
    show() {
        this.container.style.display = 'block';
    }

    /**
     * 隐藏页面
     */
    hide() {
        this.container.style.display = 'none';
    }
}