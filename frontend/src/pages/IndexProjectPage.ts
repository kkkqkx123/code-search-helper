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
                            <option value="siliconflow">SiliconFlow</option>
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
     * 创建项目索引
     */
    async createProjectIndex() {
        const projectPath = (this.container.querySelector('#project-path') as HTMLInputElement).value;
        const embedder = (this.container.querySelector('#embedder') as HTMLSelectElement).value;
        const batchSize = parseInt((this.container.querySelector('#batch-size') as HTMLInputElement).value);
        const maxFiles = parseInt((this.container.querySelector('#max-files') as HTMLInputElement).value);

        if (!projectPath.trim()) {
            this.showIndexResult('请提供项目路径', 'error');
            return;
        }

        try {
            // 显示进度条
            const progressContainer = this.container.querySelector('#indexing-progress') as HTMLElement;
            const progressText = this.container.querySelector('#progress-text') as HTMLElement;
            
            progressContainer.style.display = 'block';
            progressText.textContent = '正在初始化...';

            // 调用API创建项目索引
            const result = await this.apiClient.createProjectIndex(projectPath, {
                embedder,
                batchSize,
                maxFiles
            });

            if (result.success) {
                this.showIndexResult(`项目索引创建成功，ID: ${result.projectId}`, 'success');
                progressContainer.style.display = 'none';
                
                if (this.onIndexComplete) {
                    this.onIndexComplete(result);
                }
            } else {
                this.showIndexResult(`创建项目索引失败: ${result.error || '未知错误'}`, 'error');
                progressContainer.style.display = 'none';
            }
        } catch (error: any) {
            this.showIndexResult(`创建项目索引时发生错误: ${error.message}`, 'error');
            const progressContainer = this.container.querySelector('#indexing-progress') as HTMLElement;
            progressContainer.style.display = 'none';
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