import { ApiClient } from '../services/api.js';
import { EventManager, FrontendEvents, globalEventManager } from '../utils/EventManager.js';

/**
 * 搜索页面组件
 */
export class SearchPage {
    private apiClient: ApiClient;
    private container: HTMLElement;
    private eventManager: EventManager<FrontendEvents>;
    private onSearchComplete?: (results: any) => void;
    private currentPage: number = 1;
    private pageSize: number = 10;
    private totalResults: number = 0;
    private totalPages: number = 0;
    private currentQuery: string = '';
    private currentProjectId: string = '';
    private currentFilters: any = {};
    private infiniteScrollEnabled: boolean = false;
    private isLoadingMore: boolean = false;
    private allResults: any[] = [];

    constructor(container: HTMLElement, apiClient: ApiClient, eventManager?: EventManager<FrontendEvents>) {
        this.container = container;
        this.apiClient = apiClient;
        this.eventManager = eventManager || globalEventManager;
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
                
                <div class="search-filters" style="margin-top: 15px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                        <div class="filter-group">
                            <label for="max-results" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">最大结果数量:</label>
                            <input
                                type="number"
                                id="max-results"
                                min="1"
                                max="100"
                                value="10"
                                style="width: 80px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;"
                            >
                        </div>
                        
                        <div class="filter-group">
                            <label for="page-size" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">每页结果数:</label>
                            <select id="page-size" style="padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;">
                                <option value="5">5</option>
                                <option value="10" selected>10</option>
                                <option value="20">20</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label for="infinite-scroll" style="display: flex; align-items: center; gap: 5px; font-weight: 500; color: #374151;">
                                <input type="checkbox" id="infinite-scroll" style="margin: 0;">
                                无限滚动加载
                            </label>
                        </div>
                        
                        <div class="filter-group">
                            <label for="min-score" style="display: block; margin-bottom: 5px; font-weight: 500; color: #374151;">最小匹配度:</label>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <input 
                                    type="range" 
                                    id="min-score" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value="0.3"
                                    style="width: 150px;"
                                >
                                <input 
                                    type="number" 
                                    id="min-score-input" 
                                    min="0" 
                                    max="1" 
                                    step="0.05" 
                                    value="0.3"
                                    style="width: 60px; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; margin-left: 10px;"
                                >
                            </div>
                        </div>
                    </div>
                </div>
                
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
        const minScoreSlider = this.container.querySelector('#min-score') as HTMLInputElement;

        // 使用类型安全的 DOM 事件监听器
        this.eventManager.addDomEventListener(searchForm, 'submit', (e) => {
            e.preventDefault();
            const selectedProject = projectSelect.value;
            this.performSearch(searchInput.value, selectedProject);
        });

        this.eventManager.addDomEventListener(exampleSearchButton, 'click', (e) => {
            e.preventDefault();
            searchInput.value = 'function';
            const selectedProject = projectSelect.value;
            this.performSearch('function', selectedProject);
        });

        // 最小匹配度滑块值实时更新
        this.eventManager.addDomEventListener(minScoreSlider, 'input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            const minScoreInput = this.container.querySelector('#min-score-input') as HTMLInputElement;
            if (minScoreInput) {
                minScoreInput.value = value;
            }
        });

        // 输入框变化时同步更新滑块
        const minScoreInput = this.container.querySelector('#min-score-input') as HTMLInputElement;
        this.eventManager.addDomEventListener(minScoreInput, 'input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = parseFloat(target.value);
            if (!isNaN(value) && value >= 0 && value <= 1) {
                minScoreSlider.value = target.value;
            }
        });

        // 输入框失去焦点时验证范围
        this.eventManager.addDomEventListener(minScoreInput, 'blur', (e) => {
            const target = e.target as HTMLInputElement;
            let value = parseFloat(target.value);
            if (isNaN(value) || value < 0) {
                value = 0;
            } else if (value > 1) {
                value = 1;
            }
            target.value = value.toFixed(2);
            minScoreSlider.value = value.toFixed(2);
        });

        // 页面大小变化时重新搜索
        const pageSizeSelect = this.container.querySelector('#page-size') as HTMLSelectElement;
        this.eventManager.addDomEventListener(pageSizeSelect, 'change', (e) => {
            const target = e.target as HTMLSelectElement;
            this.pageSize = parseInt(target.value);
            // 重置到第一页并重新搜索
            if (this.currentQuery) {
                this.performSearch(this.currentQuery, this.currentProjectId, 1);
            }
        });

        // 无限滚动开关
        const infiniteScrollCheckbox = this.container.querySelector('#infinite-scroll') as HTMLInputElement;
        this.eventManager.addDomEventListener(infiniteScrollCheckbox, 'change', (e) => {
            const target = e.target as HTMLInputElement;
            this.infiniteScrollEnabled = target.checked;
            // 如果启用了无限滚动，设置更大的页面大小
            if (this.infiniteScrollEnabled) {
                this.pageSize = 20;
                pageSizeSelect.value = '20';
            }
            // 重新搜索
            if (this.currentQuery) {
                this.performSearch(this.currentQuery, this.currentProjectId, 1);
            }
        });

        // 设置滚动事件监听器以实现无限滚动
        this.setupInfiniteScroll();
    }

    /**
     * 执行搜索
     */
    async performSearch(query: string, projectId?: string, page: number = 1) {
        if (!query.trim()) {
            this.displayError('请输入搜索关键词');
            return;
        }

        // 如果没有选择项目，尝试使用第一个可用项目
        if (!projectId) {
            const projectSelect = this.container.querySelector('#project-select') as HTMLSelectElement;
            if (projectSelect && projectSelect.options.length > 1) {
                // 选择第一个真实项目（跳过"选择项目"选项）
                projectId = projectSelect.options[1].value;
            }
        }

        // 获取搜索过滤参数
        const maxResultsInput = this.container.querySelector('#max-results') as HTMLInputElement;
        const minScoreInput = this.container.querySelector('#min-score-input') as HTMLInputElement;
        const pageSizeSelect = this.container.querySelector('#page-size') as HTMLSelectElement;
        
        const maxResults = maxResultsInput ? parseInt(maxResultsInput.value) : undefined;
        const minScore = minScoreInput ? parseFloat(minScoreInput.value) : undefined;
        this.pageSize = pageSizeSelect ? parseInt(pageSizeSelect.value) : 10;

        // 保存当前查询参数
        this.currentQuery = query;
        this.currentProjectId = projectId || '';
        this.currentPage = page;
        this.currentFilters = {
            maxResults,
            minScore
        };

        // 如果启用无限滚动，重置所有结果
        if (this.infiniteScrollEnabled) {
            this.allResults = [];
        }

        // 发出搜索开始事件
        this.eventManager.emit('search.started', {
            query,
            projectId: projectId || '',
            filters: this.currentFilters
        });

        this.showLoading();

        try {
            const startTime = Date.now();
            const result = await this.apiClient.search(query, projectId, {
                maxResults,
                minScore,
                page,
                pageSize: this.pageSize,
                useCache: true
            });
            const executionTime = Date.now() - startTime;
            
            if (this.infiniteScrollEnabled && result.success) {
                // 保存第一页结果
                this.allResults = [...result.data.results];
                this.displayAllResults();
            } else {
                // 使用普通分页显示
                this.displayResults(result);
            }
            
            if (this.onSearchComplete) {
                this.onSearchComplete(result);
            }

            // 发出搜索完成事件
            this.eventManager.emit('search.completed', {
                query,
                results: result.success ? result.data.results : [],
                totalCount: result.success ? this.totalResults : 0,
                executionTime
            });
        } catch (error) {
            this.displayError(error);
            
            // 发出搜索失败事件
            this.eventManager.emit('search.failed', {
                query,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * 显示搜索结果
     */
    private displayResults(result: any) {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (!resultsContainer) return;

        // 更新分页信息
        if (result.success && result.data.pagination) {
            this.totalResults = result.data.pagination.total || 0;
            this.totalPages = result.data.pagination.totalPages || 0;
            this.currentPage = result.data.pagination.page || 1;
        } else {
            this.totalResults = result.data.results?.length || 0;
            this.totalPages = 1;
        }

        if (result.success && result.data.results.length > 0) {
            // 构建过滤条件显示
            const filters = result.data.filters;
            let filterInfo = '';
            if (filters) {
                const filterParts = [];
                if (filters.maxResults !== undefined) {
                    filterParts.push(`最大结果: ${filters.maxResults}`);
                }
                if (filters.minScore !== undefined) {
                    filterParts.push(`最小匹配度: ${(filters.minScore * 100).toFixed(0)}%`);
                }
                if (filterParts.length > 0) {
                    filterInfo = `<div style="margin-bottom: 15px; padding: 10px; background: #e0f2fe; border-radius: 4px; font-size: 14px; color: #0277bd;">应用过滤: ${filterParts.join(', ')}</div>`;
                }
            }

            // 构建分页信息
            const startItem = (this.currentPage - 1) * this.pageSize + 1;
            const endItem = Math.min(this.currentPage * this.pageSize, this.totalResults);
            const pageInfo = `<div style="margin-bottom: 15px; font-size: 14px; color: #6b7280;">
                显示 ${startItem}-${endItem} 条，共 ${this.totalResults} 条结果
            </div>`;

            // 构建结果列表
            const resultsHtml = result.data.results.map((item: any, _index: number) => `
                <div class="result-item">
                    <div class="result-score">匹配度: ${(item.score * 100).toFixed(1)}%</div>
                    <pre class="result-code">${this.escapeHtml(item.snippet.content)}</pre>
                    <div class="result-filepath">${item.snippet.filePath || '未知文件'}</div>
                </div>
            `).join('');

            // 构建分页控件
            const paginationHtml = this.buildPaginationControls();

            resultsContainer.innerHTML = `
                ${filterInfo}
                ${pageInfo}
                ${resultsHtml}
                ${paginationHtml}
            `;

            // 添加分页事件监听
            this.setupPaginationEventListeners();
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
            const response = await this.apiClient.getProjects(false);
            const projectSelect = this.container.querySelector('#project-select') as HTMLSelectElement;
            
            // 处理API响应格式：{success: boolean, data: Project[]}
            const projects = response.success && response.data ? response.data : [];
            
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
     * 构建分页控件
     */
    private buildPaginationControls(): string {
        if (this.totalPages <= 1) {
            return '';
        }

        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
        
        // 调整开始页码以确保显示足够的页码
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        let paginationHtml = '<div class="pagination-container" style="margin-top: 20px; display: flex; justify-content: center; align-items: center; gap: 10px;">';
        
        // 上一页按钮
        paginationHtml += `
            <button class="pagination-button"
                    data-page="${this.currentPage - 1}"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                上一页
            </button>
        `;
        
        // 页码按钮
        if (startPage > 1) {
            paginationHtml += `<button class="pagination-button" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHtml += `
                <button class="pagination-button ${i === this.currentPage ? 'active' : ''}"
                        data-page="${i}">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHtml += `<button class="pagination-button" data-page="${this.totalPages}">${this.totalPages}</button>`;
        }
        
        // 下一页按钮
        paginationHtml += `
            <button class="pagination-button"
                    data-page="${this.currentPage + 1}"
                    ${this.currentPage === this.totalPages ? 'disabled' : ''}>
                下一页
            </button>
        `;
        
        paginationHtml += '</div>';
        
        return paginationHtml;
    }

    /**
     * 设置无限滚动
     */
    private setupInfiniteScroll() {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (!resultsContainer) return;

        this.eventManager.addDomEventListener(resultsContainer, 'scroll', () => {
            if (!this.infiniteScrollEnabled || this.isLoadingMore || this.currentPage >= this.totalPages) {
                return;
            }

            // 检查是否滚动到底部附近
            const { scrollTop, scrollHeight, clientHeight } = resultsContainer;
            // const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
            
            // 当滚动到距离底部100px时加载更多
            if (scrollHeight - (scrollTop + clientHeight) < 100) {
                this.loadMoreResults();
            }
        });
    }

    /**
     * 加载更多结果
     */
    private async loadMoreResults() {
        if (this.isLoadingMore || this.currentPage >= this.totalPages) {
            return;
        }

        this.isLoadingMore = true;
        this.showLoadingMore();

        try {
            const nextPage = this.currentPage + 1;
            const result = await this.apiClient.search(this.currentQuery, this.currentProjectId, {
                ...this.currentFilters,
                page: nextPage,
                pageSize: this.pageSize,
                useCache: true
            });

            if (result.success && result.data.results.length > 0) {
                // 将新结果添加到所有结果数组中
                this.allResults = [...this.allResults, ...result.data.results];
                this.currentPage = nextPage;
                
                // 重新显示所有结果
                this.displayAllResults();
                
                if (this.onSearchComplete) {
                    this.onSearchComplete(result);
                }
            }
        } catch (error) {
            console.error('加载更多结果失败:', error);
            this.displayError('加载更多结果失败');
        } finally {
            this.isLoadingMore = false;
            this.hideLoadingMore();
        }
    }

    /**
     * 显示加载更多状态
     */
    private showLoadingMore() {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (!resultsContainer) return;

        // 检查是否已存在加载更多提示
        let loadingMoreDiv = resultsContainer.querySelector('.loading-more') as HTMLDivElement;
        if (!loadingMoreDiv) {
            loadingMoreDiv = document.createElement('div');
            loadingMoreDiv.className = 'loading-more';
            loadingMoreDiv.style.cssText = 'text-align: center; padding: 20px; color: var(--secondary-color);';
            loadingMoreDiv.textContent = '加载更多...';
            resultsContainer.appendChild(loadingMoreDiv);
        }
    }

    /**
     * 隐藏加载更多状态
     */
    private hideLoadingMore() {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (!resultsContainer) return;

        const loadingMoreDiv = resultsContainer.querySelector('.loading-more');
        if (loadingMoreDiv) {
            loadingMoreDiv.remove();
        }
    }

    /**
     * 显示所有结果（用于无限滚动）
     */
    private displayAllResults() {
        const resultsContainer = this.container.querySelector('#results-container') as HTMLElement;
        if (!resultsContainer) return;

        if (this.allResults.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">未找到相关结果</div>';
            return;
        }

        // 构建过滤条件显示
        const filters = this.currentFilters;
        let filterInfo = '';
        if (filters) {
            const filterParts = [];
            if (filters.maxResults !== undefined) {
                filterParts.push(`最大结果: ${filters.maxResults}`);
            }
            if (filters.minScore !== undefined) {
                filterParts.push(`最小匹配度: ${(filters.minScore * 100).toFixed(0)}%`);
            }
            if (filterParts.length > 0) {
                filterInfo = `<div style="margin-bottom: 15px; padding: 10px; background: #e0f2fe; border-radius: 4px; font-size: 14px; color: #0277bd;">应用过滤: ${filterParts.join(', ')}</div>`;
            }
        }

        // 构建分页信息
        const displayedCount = this.allResults.length;
        const pageInfo = `<div style="margin-bottom: 15px; font-size: 14px; color: #6b7280;">
            已加载 ${displayedCount} 条结果，共 ${this.totalResults} 条
        </div>`;

        // 构建结果列表
        const resultsHtml = this.allResults.map((item: any, _index: number) => `
            <div class="result-item">
                <div class="result-score">匹配度: ${(item.score * 100).toFixed(1)}%</div>
                <pre class="result-code">${this.escapeHtml(item.snippet.content)}</pre>
                <div class="result-filepath">${item.snippet.filePath || '未知文件'}</div>
            </div>
        `).join('');

        // 如果启用无限滚动，不显示分页控件
        const paginationHtml = this.infiniteScrollEnabled ? '' : this.buildPaginationControls();

        resultsContainer.innerHTML = `
            ${filterInfo}
            ${pageInfo}
            ${resultsHtml}
            ${paginationHtml}
        `;

        // 如果不是无限滚动模式，添加分页事件监听
        if (!this.infiniteScrollEnabled) {
            this.setupPaginationEventListeners();
        }
    }

    /**
     * 设置分页事件监听器
     */
    private setupPaginationEventListeners() {
        const paginationButtons = this.container.querySelectorAll('.pagination-button');
        
        paginationButtons.forEach(button => {
            this.eventManager.addDomEventListener(button, 'click', (e) => {
                e.preventDefault();
                const target = e.target as HTMLButtonElement;
                const page = parseInt(target.dataset.page || '1');
                
                if (!isNaN(page) && page !== this.currentPage && page > 0 && page <= this.totalPages) {
                    // 发出分页变化事件
                    this.eventManager.emit('search.pagination.changed', {
                        page,
                        pageSize: this.pageSize,
                        query: this.currentQuery
                    });
                    
                    this.performSearch(this.currentQuery, this.currentProjectId, page);
                }
            });
        });
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
        // 重新加载项目列表，确保是最新的
        this.loadProjects();
        
        // 发出页面变化事件
        this.eventManager.emit('ui.page.changed', {
            page: 'search',
            from: 'unknown'
        });
    }

    /**
     * 隐藏页面
     */
    hide() {
        this.container.style.display = 'none';
    }

    /**
     * 销毁页面，清理事件监听器
     */
    destroy() {
        // 清理事件管理器中的所有监听器
        this.eventManager.clearAllListeners();
    }
}