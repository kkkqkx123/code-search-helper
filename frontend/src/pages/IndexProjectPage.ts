import { ApiClient } from '../services/api.js';

/**
 * 项目索引页面组件
 */
export class IndexProjectPage {
    private apiClient: ApiClient;
    private container: HTMLElement;
    private onIndexComplete?: (result: any) => void;

    constructor(container: HTMLElement, apiClient: ApiClient) {
        this.container = container;
        this.apiClient = apiClient;
        this.render();
        this.loadAvailableEmbedders();  // 加载可用的嵌入器
        this.setupEventListeners();
    }

    /**
     * 渲染项目索引页面
     */
    private render() {
        this.container.innerHTML = `
            <div class="form-container">
                <h2>构建项目索引</h2>
                <form id="project-index-form">
                    <div class="form-group">
                        <label for="project-path">项目路径:</label>
                        <input type="text" id="project-path" class="form-control" required
                               placeholder="/path/to/your/project">
                    </div>
                    
                    <div class="form-group">
                        <label for="embedder">嵌入器:</label>
                        <select id="embedder" class="form-control">
                            <option value="openai">OpenAI</option>
                            <option value="ollama">Ollama</option>
                            <option value="gemini">Gemini</option>
                            <option value="mistral">Mistral</option>
                            <option value="siliconflow" selected>SiliconFlow</option>
                            <option value="custom1">Custom1</option>
                            <option value="custom2">Custom2</option>
                            <option value="custom3">Custom3</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="batch-size">批次大小:</label>
                        <input type="number" id="batch-size" class="form-control" value="100" min="1" max="1000">
                    </div>
                    
                    <div class="form-group">
                        <label for="max-files">最大文件数:</label>
                        <input type="number" id="max-files" class="form-control" value="1000" min="1">
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="index-button" class="search-button">开始构建</button>
                        <button type="button" id="cancel-button" class="search-button" style="background-color: #64748b;">取消</button>
                    </div>
                </form>

                <div id="indexing-progress" class="progress-container" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text" id="progress-text">处理中: 0%</div>
                </div>
                
                <div id="index-result" class="no-results" style="display: none; margin-top: 20px;"></div>
            </div>
        `;
    }
    /**
     * 设置事件监听器
     */
    private setupEventListeners() {
        const projectIndexForm = this.container.querySelector('#project-index-form') as HTMLFormElement;
        const cancelButton = this.container.querySelector('#cancel-button') as HTMLButtonElement;

        projectIndexForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createProjectIndex();
        });

        cancelButton?.addEventListener('click', () => {
            this.resetIndexForm();
        });
    }

    /**
     * 加载可用的嵌入器列表
     * 使用缓存机制减少对后端的请求频率
     */
    private async loadAvailableEmbedders(forceRefresh: boolean = false) {
        try {
            const result = await this.apiClient.getAvailableEmbedders(forceRefresh);
            if (result.success && result.data) {
                this.updateEmbedderSelect(result.data);
            } else {
                console.warn('无法获取可用的嵌入器列表，使用默认列表');
            }
        } catch (error) {
            console.warn('获取可用嵌入器失败，使用默认列表:', error);
        }
    }

    /**
     * 刷新嵌入器列表
     * 强制从后端获取最新数据
     */
    public async refreshEmbedders() {
        try {
            await this.loadAvailableEmbedders(true);
            console.info('嵌入器列表已刷新');
        } catch (error) {
            console.error('刷新嵌入器列表失败:', error);
        }
    }

    /**
     * 更新嵌入器选择下拉框
     */
    private updateEmbedderSelect(embedders: any[]) {
        const embedderSelect = this.container.querySelector('#embedder') as HTMLSelectElement;
        if (!embedderSelect) return;

        // 清空现有选项
        embedderSelect.innerHTML = '';

        // 添加新的选项
        embedders.forEach(embedder => {
            const option = document.createElement('option');
            option.value = embedder.name;
            option.textContent = `${embedder.displayName} ${embedder.available ? '' : '(不可用)'}`;

            // 如果嵌入器不可用，添加禁用状态和样式
            if (!embedder.available) {
                option.disabled = true;
                option.style.color = '#888';
                option.title = '此嵌入器当前不可用';
            }

            // 如果是默认或首选的嵌入器，设置为选中状态
            if (embedder.name === 'siliconflow' && embedder.available) {
                option.selected = true;
            }

            embedderSelect.appendChild(option);
        });
    }

    /**
     * 创建项目索引
     */
    async createProjectIndex() {
        const projectPathInput = this.container.querySelector('#project-path') as HTMLInputElement;
        const embedderSelect = this.container.querySelector('#embedder') as HTMLSelectElement;
        const batchSizeInput = this.container.querySelector('#batch-size') as HTMLInputElement;
        const maxFilesInput = this.container.querySelector('#max-files') as HTMLInputElement;

        if (!projectPathInput || !embedderSelect || !batchSizeInput || !maxFilesInput) {
            this.showIndexResult('表单元素未找到', 'error');
            return;
        }

        const projectPath = projectPathInput.value;
        const embedder = embedderSelect.value;
        const batchSize = parseInt(batchSizeInput.value);
        const maxFiles = parseInt(maxFilesInput.value);

        if (!projectPath.trim()) {
            this.showIndexResult('请提供项目路径', 'error');
            return;
        }

        try {
            // 显示进度条
            const progressContainer = this.container.querySelector('#indexing-progress') as HTMLElement;
            const progressText = this.container.querySelector('#progress-text') as HTMLElement;

            if (progressContainer && progressText) {
                progressContainer.style.display = 'block';
                progressText.textContent = '正在初始化...';
            }

            // 调用API创建项目索引
            const result = await this.apiClient.createProjectIndex(projectPath, {
                embedder,
                batchSize,
                maxFiles
            });

            if (result.success) {
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                this.showIndexResult(`项目索引创建成功，ID: ${result.data?.projectId || result.projectId}`, 'success');

                if (this.onIndexComplete) {
                    this.onIndexComplete(result);
                }
            } else {
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                
                // 显示详细的错误信息
                let errorMessage = `创建项目索引失败: ${result.error || '未知错误'}`;
                
                // 如果有错误类型和建议操作，显示它们
                if (result.error && typeof result.error === 'object') {
                    const errorObj = result.error;
                    errorMessage = `创建项目索引失败: ${errorObj.message || '未知错误'}`;
                    if (errorObj.type) {
                        errorMessage += `\n错误类型: ${errorObj.type}`;
                    }
                    if (errorObj.suggestedActions && Array.isArray(errorObj.suggestedActions)) {
                        errorMessage += `\n建议操作: ${errorObj.suggestedActions.join('; ')}`;
                    }
                } else if (result.error) {
                    // 检查错误是否包含嵌入器验证错误信息
                    errorMessage = `创建项目索引失败: ${result.error}`;
                }
                
                // 如果有可用的嵌入器列表，提供额外信息
                if (result.availableProviders) {
                    const unavailableEmbedders = result.availableProviders.filter((p: any) => !p.available);
                    if (unavailableEmbedders.length > 0) {
                        errorMessage += `\n不可用的嵌入器: ${unavailableEmbedders.map((p: any) => p.displayName).join(', ')}`;
                    }
                    
                    // 更新嵌入器选择列表以反映当前状态
                    this.updateEmbedderSelect(result.availableProviders);
                }
                
                this.showIndexResult(errorMessage, 'error');
            }
        } catch (error: any) {
            const progressContainer = this.container.querySelector('#indexing-progress') as HTMLElement;
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            
            let errorMessage = `创建项目索引时发生错误: ${error.message || '网络错误'}`;
            
            // 如果错误对象包含更详细的信息，使用它
            if (error.error) {
                errorMessage += `\n详细信息: ${error.error.message || error.error}`;
            }
            
            this.showIndexResult(errorMessage, 'error');
        }
    }

    /**
     * 显示索引结果
     */
    private showIndexResult(message: string, type: 'success' | 'error') {
        const resultDiv = this.container.querySelector('#index-result') as HTMLElement;
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.textContent = message;
            resultDiv.className = type === 'error' ? 'error' : 'no-results';
        }
    }

    /**
     * 重置索引表单
     */
    private resetIndexForm() {
        const form = this.container.querySelector('#project-index-form') as HTMLFormElement;
        const progressContainer = this.container.querySelector('#indexing-progress') as HTMLElement;
        const resultDiv = this.container.querySelector('#index-result') as HTMLElement;

        form?.reset();
        progressContainer.style.display = 'none';
        resultDiv.style.display = 'none';
    }

    /**
     * 设置索引完成回调
     */
    setOnIndexComplete(callback: (result: any) => void) {
        this.onIndexComplete = callback;
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