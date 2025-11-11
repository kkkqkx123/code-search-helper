import { ApiClient } from '../services/api.js';
import { UpdateProgressModal } from '../components/UpdateProgressModal.js';

/**
 * 已索引项目页面组件
 */
export class ProjectsPage {
    private apiClient: ApiClient;
    private container: HTMLElement;
    private onProjectActionComplete?: (action: string, result: any) => void;
    private updateProgressModal: UpdateProgressModal;

    // 分页相关属性
    private currentPage: number = 1;
    private pageSize: number = 20;
    private totalItems: number = 0;
    private totalPages: number = 0;
    private searchQuery: string = '';
    private statusFilter: string = '';
    private sortBy: string = 'name';
    private sortOrder: string = 'asc';

    // 事件处理器引用
    private handleScroll: () => void;
    private handleResize: () => void;

    constructor(container: HTMLElement, apiClient: ApiClient) {
        this.container = container;
        this.apiClient = apiClient;
        this.updateProgressModal = new UpdateProgressModal();
        this.updateProgressModal.setApiClient(apiClient);
        
        // 初始化事件处理器
        this.handleScroll = () => this.adjustAllDropdownsPosition();
        this.handleResize = () => this.adjustAllDropdownsPosition();
        
        this.render();
        this.setupEventListeners();
        this.setupSearchAndFilterListeners();
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
                
                <!-- 搜索和过滤控件 -->
                <div class="projects-controls">
                    <div class="search-section">
                        <input type="text" id="project-search" class="search-input" placeholder="搜索项目名称或路径..." value="${this.escapeHtml(this.searchQuery)}">
                        <select id="status-filter" class="status-filter">
                            <option value="">所有状态</option>
                            <option value="completed" ${this.statusFilter === 'completed' ? 'selected' : ''}>已完成</option>
                            <option value="indexing" ${this.statusFilter === 'indexing' ? 'selected' : ''}>索引中</option>
                            <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>待处理</option>
                            <option value="error" ${this.statusFilter === 'error' ? 'selected' : ''}>错误</option>
                        </select>
                        <select id="sort-select" class="sort-select">
                            <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>按名称排序</option>
                            <option value="path" ${this.sortBy === 'path' ? 'selected' : ''}>按路径排序</option>
                            <option value="fileCount" ${this.sortBy === 'fileCount' ? 'selected' : ''}>按文件数排序</option>
                            <option value="lastIndexed" ${this.sortBy === 'lastIndexed' ? 'selected' : ''}>按最后索引时间排序</option>
                            <option value="status" ${this.sortBy === 'status' ? 'selected' : ''}>按状态排序</option>
                        </select>
                        <select id="sort-order" class="sort-order">
                            <option value="asc" ${this.sortOrder === 'asc' ? 'selected' : ''}>升序</option>
                            <option value="desc" ${this.sortOrder === 'desc' ? 'selected' : ''}>降序</option>
                        </select>
                        <button id="apply-filters" class="search-button">应用过滤</button>
                    </div>
                    <div class="view-controls">
                        <select id="page-size" class="page-size">
                            <option value="10" ${this.pageSize === 10 ? 'selected' : ''}>10条/页</option>
                            <option value="20" ${this.pageSize === 20 ? 'selected' : ''}>20条/页</option>
                            <option value="50" ${this.pageSize === 50 ? 'selected' : ''}>50条/页</option>
                            <option value="100" ${this.pageSize === 100 ? 'selected' : ''}>100条/页</option>
                        </select>
                    </div>
                </div>
                
                <!-- 项目统计信息 -->
                <div class="projects-stats">
                    <span>总共 <strong id="total-items">${this.totalItems}</strong> 个项目</span>
                    <span>第 <strong id="current-page">${this.currentPage}</strong> 页，共 <strong id="total-pages">${this.totalPages}</strong> 页</span>
                </div>
                
                <table class="projects-table">
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="select-all-projects" title="选择所有项目"></th>
                            <th>项目信息</th>
                            <th>项目Hash</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="projects-list">
                        <!-- 动态填充 -->
                    </tbody>
                </table>
                
                <!-- 分页控件 -->
                <div id="pagination-container" class="pagination-container"></div>
                
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

        // 添加窗口滚动事件监听器，用于调整下拉菜单位置
        this.handleScroll = this.handleScroll.bind(this);
        window.addEventListener('scroll', this.handleScroll, { passive: true });

        // 添加窗口大小变化事件监听器
        this.handleResize = this.handleResize.bind(this);
        window.addEventListener('resize', this.handleResize);
    }


    /**
     * 调整所有可见下拉菜单位置
     */
    private adjustAllDropdownsPosition() {
        document.querySelectorAll('.dropdown-menu.show').forEach(dropdown => {
            const button = dropdown.previousElementSibling as HTMLButtonElement;
            if (button && button.classList.contains('dropdown-toggle')) {
                this.adjustDropdownPosition(button, dropdown as HTMLElement);
            }
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
            // 获取项目列表
            const result = await this.apiClient.getProjects(forceRefresh, {
                page: this.currentPage,
                pageSize: this.pageSize,
                search: this.searchQuery,
                status: this.statusFilter,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder
            });

            if (result.success && result.data) {
                // 获取项目名称映射
                let nameMapping: { [hash: string]: string } = {};
                try {
                    const mappingResult = await this.apiClient.getProjectNameMapping(!forceRefresh);
                    if (mappingResult.success && mappingResult.data) {
                        nameMapping = mappingResult.data;
                    }
                } catch (mappingError) {
                    console.warn('获取项目名称映射失败，将使用默认显示:', mappingError);
                }

                // 为每个项目添加真实名称
                const projectsWithNames = result.data.map((project: any) => {
                    return {
                        ...project,
                        name: nameMapping[project.id] || project.name || this.getProjectDisplayName(project.path) || project.id
                    };
                });

                // 更新分页信息
                if (result.pagination) {
                    this.totalItems = result.pagination.totalItems;
                    this.totalPages = result.pagination.totalPages;
                    this.currentPage = result.pagination.page;
                }

                // 更新统计信息显示
                this.updateStatsDisplay();

                // 渲染分页控件
                this.renderPagination();

                if (projectsWithNames.length > 0) {
                    this.renderProjectsList(projectsWithNames, projectsList);
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

        container.innerHTML = projects.map(project => {
            // 使用项目名称而非ID显示
            const displayName = project.name || project.id;
            
            return `
            <tr>
                <td><input type="checkbox" class="project-checkbox" data-project-id="${project.id}" title="选择项目"></td>
                <td class="project-info-cell">
                    <div class="project-name">${this.escapeHtml(displayName)}</div>
                    <div class="project-path">${this.escapeHtml(project.path || 'N/A')}</div>
                    <div class="project-meta">
                        <span class="file-count">📁 ${project.fileCount || 0} 文件</span>
                        <span class="last-indexed">🕒 ${this.formatDate(project.lastIndexed)}</span>
                    </div>
                </td>
                <td class="project-hash-cell">
                    <div class="project-hash">${this.escapeHtml(project.id)}</div>
                </td>
                <td class="status-cell">
                    <div class="status-indicators">
                        <div class="project-status status-${project.status}">
                            ${this.getStatusText(project.status)}
                        </div>
                        <div class="hot-reload-status">
                            <hot-reload-status 
                                project-id="${project.id}"
                                enabled="${project.hotReload?.enabled || false}"
                                changes-detected="${project.hotReload?.changesDetected || 0}"
                                errors-count="${project.hotReload?.errorsCount || 0}">
                            </hot-reload-status>
                        </div>
                        <div class="storage-status">
                            <storage-status-indicator
                                project-id="${project.id}"
                                vector-status="${project.vectorStatus?.status || 'pending'}"
                                graph-status="${project.graphStatus?.status || 'pending'}">
                            </storage-status-indicator>
                        </div>
                    </div>
                </td>
                <td class="actions-cell">
                    <div class="action-menu">
                        <button class="action-button primary" data-project-id="${project.id}" data-action="update">🔄 更新</button>
                        <button class="action-button secondary" data-project-id="${project.id}" data-action="reindex">📊 重新索引</button>
                        <div class="dropdown">
                            <button class="action-button dropdown-toggle" data-project-id="${project.id}" data-action="toggle-menu">⚙️</button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" data-project-id="${project.id}" data-action="toggle-hot-reload">
                                    ${project.hotReload?.enabled ? '🔴 禁用热重载' : '🟢 启用热重载'}
                                </button>
                                <button class="dropdown-item" data-project-id="${project.id}" data-action="configure-hot-reload">⚙️ 配置热重载</button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item storage" data-project-id="${project.id}" data-action="index-vectors">🔍 混合索引（向量+图）</button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" data-project-id="${project.id}" data-action="delete">🗑️ 删除</button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
        }).join('');

        // 使用事件委托处理操作按钮点击事件
        container.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            
            // 处理操作按钮点击
            if (target.classList.contains('action-button')) {
                const button = target as HTMLButtonElement;
                const projectId = button.dataset.projectId;
                const action = button.dataset.action;

                if (projectId && action) {
                    e.stopPropagation(); // 防止事件冒泡
                    if (action === 'update') {
                        this.handleManualUpdate(projectId);
                    } else if (action === 'reindex') {
                        this.reindexProject(projectId);
                    } else if (action === 'delete') {
                        this.deleteProject(projectId, button);
                    } else if (action === 'configure-hot-reload') {
                        this.configureHotReload(projectId);
                    } else if (action === 'toggle-hot-reload') {
                        this.toggleHotReload(projectId, button);
                    } else if (action === 'index-vectors') {
                        this.indexVectors(projectId);
                    } else if (action === 'toggle-menu') {
                        this.toggleDropdown(button);
                    }
                }
            }
            
            // 处理下拉菜单项点击
            if (target.classList.contains('dropdown-item')) {
                const button = target as HTMLButtonElement;
                const projectId = button.dataset.projectId;
                const action = button.dataset.action;

                if (projectId && action) {
                    e.stopPropagation(); // 防止事件冒泡
                    // 关闭下拉菜单
                    const dropdownMenu = button.closest('.dropdown-menu') as HTMLElement;
                    if (dropdownMenu) {
                        dropdownMenu.classList.remove('show');
                        dropdownMenu.classList.remove('dropup');
                        dropdownMenu.classList.remove('viewport-constrained');
                        dropdownMenu.style.left = '';
                        dropdownMenu.style.top = '';
                    }
                    
                    if (action === 'delete') {
                        this.deleteProject(projectId, button);
                    } else if (action === 'configure-hot-reload') {
                        this.configureHotReload(projectId);
                    } else if (action === 'toggle-hot-reload') {
                        this.toggleHotReload(projectId, button);
                    } else if (action === 'index-vectors') {
                        this.indexVectors(projectId);
                    }
                }
            }
        });

        // 为存储操作按钮添加事件监听器（使用事件委托）
        container.addEventListener('storage-action', async (e: any) => {
            const { projectId, action } = e.detail;
            if (action === 'index-vectors') {
                await this.indexVectors(projectId);
            }
        });

        // 为项目复选框添加事件监听器（使用事件委托）
        container.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.classList.contains('project-checkbox')) {
                const projectId = target.dataset.projectId;
                if (projectId) {
                    document.dispatchEvent(new CustomEvent('project-selected', {
                        detail: {
                            projectId,
                            selected: target.checked
                        }
                    }));
                }
            }
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
     * 切换下拉菜单
     */
    private toggleDropdown(button: HTMLButtonElement) {
        const dropdown = button.nextElementSibling as HTMLElement;
        if (dropdown && dropdown.classList.contains('dropdown-menu')) {
            // 先关闭所有其他下拉菜单
            document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                if (menu !== dropdown) {
                    menu.classList.remove('show');
                }
            });

            // 切换当前下拉菜单
            dropdown.classList.toggle('show');

            // 如果菜单被显示，进行位置调整
            if (dropdown.classList.contains('show')) {
                this.adjustDropdownPosition(button, dropdown);
            }

            // 点击其他地方关闭下拉菜单
            const closeDropdown = (e: MouseEvent) => {
                if (!button.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
                    dropdown.classList.remove('show');
                    dropdown.classList.remove('dropup');
                    dropdown.classList.remove('viewport-constrained');
                    document.removeEventListener('click', closeDropdown);
                }
            };
            document.addEventListener('click', closeDropdown);
        }
    }

    /**
     * 调整下拉菜单位置，确保在视口内可见
     */
    private adjustDropdownPosition(button: HTMLButtonElement, dropdown: HTMLElement) {
        // 重置类
        dropdown.classList.remove('dropup');
        dropdown.classList.remove('viewport-constrained');

        // 获取按钮和下拉菜单的位置信息
        const buttonRect = button.getBoundingClientRect();
        const dropdownHeight = dropdown.offsetHeight;
        
        // 计算可用空间
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        
        // 判断是否需要向上展开
        const shouldDropUp = spaceBelow < dropdownHeight && spaceAbove > dropdownHeight;
        
        if (shouldDropUp) {
            // 向上展开
            dropdown.classList.add('dropup');
        } else if (spaceBelow < dropdownHeight && spaceAbove < dropdownHeight) {
            // 上下空间都不够，使用固定定位并限制高度
            dropdown.classList.add('viewport-constrained');
            
            // 设置下拉菜单位置
            const dropdownWidth = dropdown.offsetWidth;
            let left = buttonRect.right - dropdownWidth;
            let top = buttonRect.bottom;
            
            // 确保不超出右边界
            if (left < 0) {
                left = 10;
            }
            if (left + dropdownWidth > window.innerWidth) {
                left = window.innerWidth - dropdownWidth - 10;
            }
            
            // 确保不超出底部边界
            if (top + dropdownHeight > window.innerHeight) {
                top = buttonRect.top - dropdownHeight;
            }
            
            // 应用位置
            dropdown.style.left = `${left}px`;
            dropdown.style.top = `${top}px`;
        } else {
            // 正常向下展开，清除可能存在的固定定位样式
            dropdown.style.left = '';
            dropdown.style.top = '';
        }
    }

    /**
     * 更新统计信息显示
     */
    private updateStatsDisplay(): void {
        const totalItemsElement = this.container.querySelector('#total-items') as HTMLElement;
        const currentPageElement = this.container.querySelector('#current-page') as HTMLElement;
        const totalPagesElement = this.container.querySelector('#total-pages') as HTMLElement;

        if (totalItemsElement) totalItemsElement.textContent = this.totalItems.toString();
        if (currentPageElement) currentPageElement.textContent = this.currentPage.toString();
        if (totalPagesElement) totalPagesElement.textContent = this.totalPages.toString();
    }

    /**
     * 渲染分页控件
     */
    private renderPagination(): void {
        const paginationContainer = this.container.querySelector('#pagination-container') as HTMLElement;
        if (!paginationContainer) return;

        if (this.totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHtml = '<div class="pagination-controls">';

        // 上一页按钮
        const prevDisabled = this.currentPage <= 1 ? 'disabled' : '';
        paginationHtml += `<button class="pagination-button" data-page="prev" ${prevDisabled}>上一页</button>`;

        // 页码按钮
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHtml += `<button class="pagination-button" data-page="1">1</button>`;
            if (startPage > 2) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const active = i === this.currentPage ? 'active' : '';
            paginationHtml += `<button class="pagination-button ${active}" data-page="${i}">${i}</button>`;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHtml += `<button class="pagination-button" data-page="${this.totalPages}">${this.totalPages}</button>`;
        }

        // 下一页按钮
        const nextDisabled = this.currentPage >= this.totalPages ? 'disabled' : '';
        paginationHtml += `<button class="pagination-button" data-page="next" ${nextDisabled}>下一页</button>`;

        paginationHtml += '</div>';
        paginationContainer.innerHTML = paginationHtml;

        // 添加分页事件监听器
        paginationContainer.querySelectorAll('.pagination-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLButtonElement;
                const page = target.dataset.page;

                if (page === 'prev') {
                    this.goToPage(this.currentPage - 1);
                } else if (page === 'next') {
                    this.goToPage(this.currentPage + 1);
                } else {
                    this.goToPage(parseInt(page || '0'));
                }
            });
        });
    }

    /**
     * 跳转到指定页面
     */
    private goToPage(page: number): void {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;

        this.currentPage = page;
        this.loadProjectsList();
    }

    /**
     * 设置搜索和过滤事件监听器
     */
    private setupSearchAndFilterListeners(): void {
        // 搜索框
        const searchInput = this.container.querySelector('#project-search') as HTMLInputElement;
        if (searchInput) {
            let searchTimeout: number;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = window.setTimeout(() => {
                    this.searchQuery = (e.target as HTMLInputElement).value;
                    this.currentPage = 1; // 重置到第一页
                    this.loadProjectsList();
                }, 500); // 500ms防抖
            });
        }

        // 状态过滤
        const statusFilter = this.container.querySelector('#status-filter') as HTMLSelectElement;
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.statusFilter = (e.target as HTMLSelectElement).value;
                this.currentPage = 1;
                this.loadProjectsList();
            });
        }

        // 排序选择
        const sortSelect = this.container.querySelector('#sort-select') as HTMLSelectElement;
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = (e.target as HTMLSelectElement).value;
                this.currentPage = 1;
                this.loadProjectsList();
            });
        }

        // 排序顺序
        const sortOrder = this.container.querySelector('#sort-order') as HTMLSelectElement;
        if (sortOrder) {
            sortOrder.addEventListener('change', (e) => {
                this.sortOrder = (e.target as HTMLSelectElement).value;
                this.currentPage = 1;
                this.loadProjectsList();
            });
        }

        // 应用过滤按钮
        const applyFiltersButton = this.container.querySelector('#apply-filters') as HTMLButtonElement;
        if (applyFiltersButton) {
            applyFiltersButton.addEventListener('click', () => {
                this.currentPage = 1;
                this.loadProjectsList();
            });
        }

        // 页面大小选择
        const pageSizeSelect = this.container.querySelector('#page-size') as HTMLSelectElement;
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.pageSize = parseInt((e.target as HTMLSelectElement).value);
                this.currentPage = 1;
                this.loadProjectsList();
            });
        }
    }

    /**
     * 格式化日期
     */
    private formatDate(date: Date | string): string {
        if (!date) return '未知';

        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '无效日期';

        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return '今天';
        } else if (diffDays === 1) {
            return '昨天';
        } else if (diffDays < 7) {
            return `${diffDays}天前`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks}周前`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months}个月前`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years}年前`;
        }
    }

    /**
     * 获取状态文本
     */
    private getStatusText(status: string): string {
        switch (status) {
            case 'completed': return '✅ 已完成';
            case 'indexing': return '🔄 索引中';
            case 'pending': return '⏳ 待处理';
            case 'error': return '❌ 错误';
            default: return status;
        }
    }

    // 保留原有的方法，但为了节省空间，这里只包含必要的几个
    async reindexProject(projectId: string) {
        if (!confirm('确定要重新索引该项目吗？')) return;

        try {
            const result = await this.apiClient.reindexProject(projectId);

            if (result.success) {
                alert('重新索引已启动');
                this.apiClient.clearProjectsCache();
                this.apiClient.clearSearchCache();
                this.apiClient.clearProjectNameMappingCache();
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

    async deleteProject(projectId: string, element: HTMLElement) {
        if (!confirm('确定要删除该项目的索引吗？此操作不可撤销。')) return;

        try {
            const result = await this.apiClient.deleteProject(projectId);

            if (result.success) {
                this.apiClient.clearProjectsCache();
                this.apiClient.clearSearchCache();
                this.apiClient.clearProjectNameMappingCache();
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

    async indexVectors(projectId: string) {
        try {
            const result = await this.apiClient.indexVectors(projectId);

            if (result.success) {
                alert('向量索引已启动');
                this.apiClient.clearProjectsCache();
                this.apiClient.clearProjectNameMappingCache();
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

    // 图索引功能已移除 - 图索引现在依赖于向量索引，不能单独调用
    // 请使用 indexVectors 方法进行混合索引（向量+图）

    async toggleHotReload(projectId: string, button: HTMLButtonElement) {
        const currentEnabled = button.dataset.enabled === 'true';
        const newEnabled = !currentEnabled;

        try {
            const result = await this.apiClient.toggleProjectHotReload(projectId, newEnabled);

            if (result.success) {
                button.dataset.enabled = newEnabled.toString();
                button.title = newEnabled ? '禁用热重载' : '启用热重载';
                button.textContent = newEnabled ? '🔴 禁用' : '🟢 启用';

                const statusIndicator = this.container.querySelector(`hot-reload-status[project-id="${projectId}"]`) as HTMLElement;
                if (statusIndicator) {
                    statusIndicator.setAttribute('enabled', newEnabled.toString());
                }

                alert(newEnabled ? '热重载已启用' : '热重载已禁用');

                this.apiClient.clearProjectsCache();
                this.apiClient.clearProjectNameMappingCache();
                this.loadProjectsList(true);
            } else {
                alert('切换热重载状态失败: ' + (result.error || '未知错误'));
            }
        } catch (error: any) {
            alert('切换热重载状态时发生错误: ' + error.message);
        }
    }

    async configureHotReload(projectId: string) {
        try {
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

            const configResult = await this.apiClient.getProjectHotReloadConfig(projectId);
            if (!configResult.success) {
                alert('无法获取热重载配置: ' + (configResult.error || '未知错误'));
                return;
            }

            const modal = document.createElement('hot-reload-config-modal') as any;
            modal.setProjectInfo(projectId, project.name || projectId, configResult.data);

            modal.addEventListener('config-saved', (event: any) => {
                const { projectId: savedProjectId, config } = event.detail;
                console.log('热重载配置已保存:', savedProjectId, config);

                this.apiClient.clearProjectsCache();
                this.apiClient.clearProjectNameMappingCache();
                this.loadProjectsList(true);

                alert('热重载配置已保存');
            });

            modal.addEventListener('modal-closed', () => {
                modal.remove();
            });

            document.body.appendChild(modal);
        } catch (error: any) {
            alert('配置热重载时发生错误: ' + error.message);
        }
    }

    private async handleManualUpdate(projectId: string): Promise<void> {
        try {
            const confirmed = confirm('确定要手动更新此项目的索引吗？这将只更新发生变化的文件。');
            if (!confirmed) return;

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

            const response = await this.apiClient.updateProjectIndex(projectId);

            if (response.success) {
                this.updateProgressModal.show(
                    projectId,
                    project.name || projectId,
                    (cancelProjectId) => this.handleCancelUpdate(cancelProjectId)
                );

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

    private showNotification(message: string, type: 'success' | 'error' | 'warning'): void {
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
     * 获取项目显示名称
     */
    private getProjectDisplayName(projectPath: string): string {
        if (!projectPath) return '';
        // 从路径中提取项目名称，处理各种路径分隔符
        return projectPath.split(/[/\\]/).filter(Boolean).pop() || '';
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
        this.cleanup();
    }

    /**
     * 清理事件监听器和资源
     */
    private cleanup() {
        // 关闭所有下拉菜单
        document.querySelectorAll('.dropdown-menu.show').forEach(dropdown => {
            const dropdownElement = dropdown as HTMLElement;
            dropdownElement.classList.remove('show');
            dropdownElement.classList.remove('dropup');
            dropdownElement.classList.remove('viewport-constrained');
            dropdownElement.style.left = '';
            dropdownElement.style.top = '';
        });

        // 移除事件监听器
        if (this.handleScroll) {
            window.removeEventListener('scroll', this.handleScroll);
        }
        if (this.handleResize) {
            window.removeEventListener('resize', this.handleResize);
        }
    }
}