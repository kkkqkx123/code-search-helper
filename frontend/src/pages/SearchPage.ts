import { ApiClient } from '../services/api.js';

/**
 * 搜索页面组件
 */
export class SearchPage {
    private apiClient: ApiClient;
    private container: HTMLElement;
    private onSearchComplete?: (results: any) => void;

    constructor(container: HTMLElement, apiClient: ApiClient) {
        this.container = container;
        this.apiClient = apiClient;
        this.render();
        this.setupEventListeners();
    }

    /**
     * 渲染搜索页面
     */
    private render() {
        this.container.innerHTML = `
            <div class="search-container">
                <form id="search-form" class="search-form">
                    <input
                        type="text"
                        id="search-input"
                        class="search-input"
                        placeholder="输入搜索关键词，例如：函数定义、类实现等..."
                        autocomplete="off"
                    >
                    <select id="project-select" class="project-select">
                        <option value="">选择项目</option>
                    </select>
                    <button type="submit" class="search-button">搜索</button>
                </form>
                <div style="margin-top: 15px; text-align: center;">
                    <button id="example-search" class="search-button" style="background-color: #64748b; padding: 8px 15px; font-size: 14px;">示例搜索：function</button>
                </div>
            </div>

            <div class="results-container">
                <div class="results-header">搜索结果</div>
                <div id="results-container">
                    <div class="no-results" id="initial-message">
                        请输入搜索关键词开始查询，或点击上方"示例搜索"按钮
                    </div>
                </div>
            </div>
        `;
        this.loadProjects();
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners() {
        const searchForm = this.container.querySelector('#search-form') as HTMLFormElement;
        const searchInput = this.container.querySelector('#search-input') as HTMLInputElement;
        const projectSelect = this.container.querySelector('#project-select') as HTMLSelectElement;
        const exampleSearchButton = this.container.querySelector('#example-search') as HTMLButtonElement;

        searchForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedProject = projectSelect.value;
            this.performSearch(searchInput.value, selectedProject);
        });

        exampleSearchButton?.addEventListener('click', (e) => {
            e.preventDefault();
            searchInput.value = 'function';
            const selectedProject = projectSelect.value;
            this.performSearch('function', selectedProject);
        });
    }

    /**
     * 执行搜索
     */
    async performSearch(query: string, projectId?: string) {
        if (!query.trim()) {
            this.displayError('请输入搜索关键词');
            return;
        }

        this.showLoading();

        try {
            const result = await this.apiClient.search(query, projectId);
            this.displayResults(result);
            
            if (this.onSearchComplete) {
                this.onSearchComplete(result);
            }
        } catch (error) {
            this.displayError(error);
        }
    }

    /**
     * 显示搜索结果
     */
    private displayResults(result: any) {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (!resultsContainer) return;

        if (result.success && result.data.results.length > 0) {
            resultsContainer.innerHTML = result.data.results.map((item: any, index: number) => `
                <div class="result-item">
                    <div class="result-score">匹配度: ${(item.score * 100).toFixed(1)}%</div>
                    <pre class="result-code">${this.escapeHtml(item.snippet.content)}</pre>
                    <div class="result-filepath">${item.snippet.filePath || '未知文件'}</div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<div class="no-results">未找到相关结果</div>';
        }
    }

    /**
     * 显示错误信息
     */
    private displayError(error: any) {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="error">
                    错误: ${error instanceof Error ? error.message : error || '未知错误'}
                </div>
            `;
        }
    }

    /**
     * 显示加载状态
     */
    private showLoading() {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (resultsContainer) {
            resultsContainer.innerHTML = '<div class="loading">搜索中...</div>';
        }
    }

    /**
     * 加载项目列表
     */
    private async loadProjects() {
        try {
            const projects = await this.apiClient.getProjects();
            const projectSelect = this.container.querySelector('#project-select') as HTMLSelectElement;
            
            if (projectSelect && projects && Array.isArray(projects)) {
                // 清空现有选项（保留默认选项）
                while (projectSelect.children.length > 1) {
                    projectSelect.removeChild(projectSelect.lastChild!);
                }
                
                projects.forEach((project: any) => {
                    const option = document.createElement('option');
                    option.value = project.id || project.path;
                    option.textContent = project.name || project.path || project.id;
                    projectSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('加载项目列表失败:', error);
            // 即使加载失败也不显示错误，因为项目选择是可选的
        }
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
        
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    /**
     * 设置搜索完成回调
     */
    setOnSearchComplete(callback: (results: any) => void) {
        this.onSearchComplete = callback;
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