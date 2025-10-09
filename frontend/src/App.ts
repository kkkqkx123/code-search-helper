import { ApiClient } from './services/api.js';
import { router, PageId } from './router/router.js';
import { SearchPage } from './pages/SearchPage.js';
import { IndexProjectPage } from './pages/IndexProjectPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { GraphExplorerPage } from './pages/GraphExplorerPage.js';
import { GraphAnalysisPage } from './pages/GraphAnalysisPage.js';
import { GraphManagementPage } from './pages/GraphManagementPage.js';

// 导入新的组件
import { StorageStatusIndicator } from './components/StorageStatusIndicator.js';
import { StorageActionButtons } from './components/StorageActionButtons.js';
import { BatchOperationsPanel } from './components/BatchOperationsPanel.js';

// 注册自定义元素
customElements.define('storage-status-indicator', StorageStatusIndicator);
customElements.define('storage-action-buttons', StorageActionButtons);
customElements.define('batch-operations-panel', BatchOperationsPanel);

/**
 * 主应用类
 * 管理整个前端应用的生命周期和页面切换
 */
export class CodebaseSearchApp {
    private apiClient: ApiClient;
    private searchPage!: SearchPage;
    private indexProjectPage!: IndexProjectPage;
    private projectsPage!: ProjectsPage;
    private graphExplorerPage!: GraphExplorerPage;
    private graphAnalysisPage!: GraphAnalysisPage;
    private graphManagementPage!: GraphManagementPage;
    private statusElement: HTMLElement | null;
    private versionElement: HTMLElement | null;

    constructor(apiBaseUrl: string = 'http://localhost:3010') {
        this.apiClient = new ApiClient(apiBaseUrl);
        this.statusElement = document.getElementById('status');
        this.versionElement = document.getElementById('version');
        
        this.initialize();
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
     * 设置页面组件
     */
    private setupPages() {
        const searchPageContainer = document.getElementById('search-page') as HTMLElement;
        const indexProjectPageContainer = document.getElementById('index-project-page') as HTMLElement;
        const projectsPageContainer = document.getElementById('projects-page') as HTMLElement;
        const graphExplorerPageContainer = document.getElementById('graph-explorer-page') as HTMLElement;
        const graphAnalysisPageContainer = document.getElementById('graph-analysis-page') as HTMLElement;
        const graphManagementPageContainer = document.getElementById('graph-management-page') as HTMLElement;

        if (!searchPageContainer || !indexProjectPageContainer || !projectsPageContainer ||
            !graphExplorerPageContainer || !graphAnalysisPageContainer || !graphManagementPageContainer) {
            throw new Error('页面容器元素未找到');
        }

        this.searchPage = new SearchPage(searchPageContainer, this.apiClient);
        this.indexProjectPage = new IndexProjectPage(indexProjectPageContainer, this.apiClient);
        this.projectsPage = new ProjectsPage(projectsPageContainer, this.apiClient);
        this.graphExplorerPage = new GraphExplorerPage(graphExplorerPageContainer);
        this.graphAnalysisPage = new GraphAnalysisPage(graphAnalysisPageContainer);
        this.graphManagementPage = new GraphManagementPage(graphManagementPageContainer);

        // 设置页面回调
        this.indexProjectPage.setOnIndexComplete((_result) => {
            // 索引创建完成后刷新项目列表
            this.projectsPage.refresh();
        });
    }

    /**
     * 设置路由
     */
    private setupRouter() {
        router.onPageChange((pageId: PageId) => {
            this.switchPage(pageId);
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
    private handleNavigationClick = (e: Event) => {
        const target = e.target as HTMLElement;
        const pageId = target.getAttribute('data-page') as PageId;
        
        if (pageId) {
            router.navigateTo(pageId);
        }
    }

    /**
     * 切换页面
     */
    private switchPage(pageId: PageId) {
        // 隐藏所有页面
        this.searchPage.hide();
        this.indexProjectPage.hide();
        this.projectsPage.hide();
        this.graphExplorerPage.hide();
        this.graphAnalysisPage.hide();
        this.graphManagementPage.hide();

        // 移除所有导航按钮的active类
        document.querySelectorAll('.nav-button').forEach(button => {
            button.classList.remove('active');
        });

        // 显示选中的页面
        switch (pageId) {
            case 'search':
                this.searchPage.show();
                break;
            case 'index-project':
                this.indexProjectPage.show();
                break;
            case 'projects':
                this.projectsPage.show();
                break;
            case 'graph-explorer':
                this.graphExplorerPage.show();
                break;
            case 'graph-analysis':
                this.graphAnalysisPage.show();
                break;
            case 'graph-management':
                this.graphManagementPage.show();
                break;
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