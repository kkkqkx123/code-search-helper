import { router, PageId } from './router/router.js';

// 动态导入组件
const loadComponents = async () => {
  try {
    const [
      { StorageStatusIndicator },
      { StorageActionButtons },
      { BatchOperationsPanel },
      { HotReloadStatus },
      { HotReloadConfigModal }
    ] = await Promise.all([
      import('./components/StorageStatusIndicator.js'),
      import('./components/StorageActionButtons.js'),
      import('./components/BatchOperationsPanel.js'),
      import('./components/HotReloadStatus.js'),
      import('./components/HotReloadConfigModal.js')
    ]);

    // 注册自定义元素
    customElements.define('storage-status-indicator', StorageStatusIndicator);
    customElements.define('storage-action-buttons', StorageActionButtons);
    customElements.define('batch-operations-panel', BatchOperationsPanel);
    customElements.define('hot-reload-status', HotReloadStatus);
    customElements.define('hot-reload-config-modal', HotReloadConfigModal);
  } catch (error) {
    console.error('Failed to load components:', error);
  }
};

// 立即加载组件
loadComponents();

/**
 * 主应用类
 * 管理整个前端应用的生命周期和页面切换
 */
export class CodebaseSearchApp {
    private apiClient: any;
    private statusElement: HTMLElement | null;
    private versionElement: HTMLElement | null;
    private pageLoadPromises: Map<string, Promise<any>> = new Map();

    constructor(apiBaseUrl: string = 'http://localhost:3010') {
        this.statusElement = document.getElementById('status');
        this.versionElement = document.getElementById('version');

        // 异步初始化
        this.initializeAsync(apiBaseUrl);
    }

    /**
     * 异步初始化应用
     */
    private async initializeAsync(apiBaseUrl: string) {
        try {
            // 动态导入API客户端
            const { ApiClient } = await import('./services/api.js');
            this.apiClient = new ApiClient(apiBaseUrl);

            // 设置全局apiClient供组件使用
            (window as any).apiClient = this.apiClient;

            // 初始化应用
            this.initialize();
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('应用初始化失败，请刷新页面重试');
        }
    }

    /**
     * 初始化应用
     */
    private initialize() {
        // 首先设置页面
        this.setupPages();

        // 然后设置导航，确保DOM元素已存在
        this.setupNavigation();

        // 最后设置路由，确保导航和页面都已准备好
        this.setupRouter();

        // 更新状态
        this.updateStatus();
    }

    /**
     * 动态加载页面组件
     */
    private async loadPageComponent(pageId: PageId): Promise<any> {
        // 如果已经加载过，直接返回
        if (this.pageLoadPromises.has(pageId)) {
            return this.pageLoadPromises.get(pageId);
        }

        let loadPromise: Promise<any>;

        switch (pageId) {
            case 'search':
                loadPromise = import('./pages/SearchPage.js').then(module => {
                    const { SearchPage } = module;
                    const container = document.getElementById('search-page') as HTMLElement;
                    return new SearchPage(container, this.apiClient);
                });
                break;
            case 'index-project':
                loadPromise = import('./pages/IndexProjectPage.js').then(module => {
                    const { IndexProjectPage } = module;
                    const container = document.getElementById('index-project-page') as HTMLElement;
                    return new IndexProjectPage(container, this.apiClient);
                });
                break;
            case 'projects':
                loadPromise = import('./pages/ProjectsPage.js').then(module => {
                    const { ProjectsPage } = module;
                    const container = document.getElementById('projects-page') as HTMLElement;
                    return new ProjectsPage(container, this.apiClient);
                });
                break;
            case 'graph-explorer':
                loadPromise = import('./pages/GraphExplorerPage.js').then(module => {
                    const { GraphExplorerPage } = module;
                    const container = document.getElementById('graph-explorer-page') as HTMLElement;
                    return new GraphExplorerPage(container);
                });
                break;
            case 'graph-analysis':
                loadPromise = import('./pages/GraphAnalysisPage.js').then(module => {
                    const { GraphAnalysisPage } = module;
                    const container = document.getElementById('graph-analysis-page') as HTMLElement;
                    return new GraphAnalysisPage(container);
                });
                break;
            case 'graph-management':
                loadPromise = import('./pages/GraphManagementPage.js').then(module => {
                    const { GraphManagementPage } = module;
                    const container = document.getElementById('graph-management-page') as HTMLElement;
                    return new GraphManagementPage(container);
                });
                break;
            case 'qdrant-view':
                loadPromise = import('./pages/QdrantCollectionViewPage.js').then(module => {
                    const { QdrantCollectionViewPage } = module;
                    const container = document.getElementById('qdrant-view-page') as HTMLElement;
                    return new QdrantCollectionViewPage(container, this.apiClient);
                });
                break;
            default:
                throw new Error(`Unknown page: ${pageId}`);
        }

        this.pageLoadPromises.set(pageId, loadPromise);
        return loadPromise;
    }

    /**
     * 设置页面组件
     */
    private setupPages() {
        // 验证页面容器存在
        const pageContainers = [
            'search-page',
            'index-project-page',
            'projects-page',
            'graph-explorer-page',
            'graph-analysis-page',
            'graph-management-page',
            'qdrant-view-page'
        ];

        for (const containerId of pageContainers) {
            const container = document.getElementById(containerId);
            if (!container) {
                console.warn(`页面容器元素未找到: ${containerId}`);
            }
        }
    }

    /**
     * 设置路由
     */
    private setupRouter() {
        router.onPageChange(async (pageId: PageId) => {
            await this.switchPage(pageId);
        });
    }

    /**
     * 设置导航
     */
    private setupNavigation() {
        // 为导航按钮添加事件监听器
        const navButtons = document.querySelectorAll('.nav-button');

        if (navButtons.length === 0) {
            console.warn('导航按钮未找到，延迟重试');
            // 如果导航按钮未找到，延迟重试
            setTimeout(() => this.setupNavigation(), 100);
            return;
        }

        navButtons.forEach(button => {
            // 移除已存在的事件监听器，避免重复绑定
            button.removeEventListener('click', this.handleNavigationClick as any);
            // 添加新的事件监听器
            button.addEventListener('click', this.handleNavigationClick as any);
        });
    }

    /**
     * 处理导航按钮点击事件
     */
    private handleNavigationClick = async (e: Event) => {
        const target = e.target as HTMLElement;
        const pageId = target.getAttribute('data-page') as PageId;

        if (pageId) {
            await router.navigateTo(pageId);
        }
    }

    /**
     * 切换页面
     */
    private async switchPage(pageId: PageId) {
        try {
            // 隐藏所有已加载的页面
            for (const [id, pagePromise] of this.pageLoadPromises) {
                try {
                    const page = await pagePromise;
                    if (page && typeof page.hide === 'function') {
                        page.hide();
                    }
                } catch (error) {
                    console.warn(`Failed to hide page ${id}:`, error);
                }
            }

            // 移除所有导航按钮的active类
            document.querySelectorAll('.nav-button').forEach(button => {
                button.classList.remove('active');
            });

            // 动态加载并显示选中的页面
            const page = await this.loadPageComponent(pageId);
            if (page && typeof page.show === 'function') {
                page.show();
            }

            // 设置页面回调（仅对需要的页面）
            if (pageId === 'index-project') {
                page.setOnIndexComplete(async (_result: any) => {
                    // 索引创建完成后刷新项目列表
                    try {
                        const projectsPage = await this.loadPageComponent('projects');
                        if (projectsPage && typeof projectsPage.refresh === 'function') {
                            projectsPage.refresh();
                        }
                    } catch (error) {
                        console.error('Failed to refresh projects page:', error);
                    }
                });
            }

            // 高亮选中的导航按钮
            // 使用延迟确保DOM元素已更新
            setTimeout(() => {
                const activeButton = document.querySelector(`[data-page="${pageId}"]`) as HTMLElement;
                if (activeButton) {
                    activeButton.classList.add('active');
                } else {
                    console.warn(`导航按钮未找到: [data-page="${pageId}"]`);
                }
            }, 0);
        } catch (error) {
            console.error(`Failed to switch to page ${pageId}:`, error);
            this.showError(`页面加载失败: ${pageId}`);
        }
    }

    /**
     * 显示错误信息
     */
    private showError(message: string) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = `错误: ${message}`;
            statusElement.style.color = '#ef4444';
        }
    }

    /**
     * 更新状态信息
     */
    private async updateStatus() {
        try {
            const status = await this.apiClient.getStatus();

            if (this.statusElement) {
                this.statusElement.textContent = `状态: ${status.status} ${status.mockMode ? '(模拟模式)' : ''}`;
            }

            if (this.versionElement) {
                this.versionElement.textContent = `版本: ${status.version || '1.0.0'}`;
            }
        } catch (error) {
            console.error('获取状态失败:', error);
        }
    }
}

// 移除全局函数，现在使用事件监听器处理导航

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    const app = new CodebaseSearchApp();
    (window as any).app = app;
});