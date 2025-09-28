import { ApiClient } from './services/api.js';
import { router, PageId } from './router/router.js';
import { SearchPage } from './pages/SearchPage.js';
import { IndexProjectPage } from './pages/IndexProjectPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';

/**
 * 主应用类
 * 管理整个前端应用的生命周期和页面切换
 */
export class CodebaseSearchApp {
    private apiClient: ApiClient;
    private searchPage!: SearchPage;
    private indexProjectPage!: IndexProjectPage;
    private projectsPage!: ProjectsPage;
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
        this.setupPages();
        this.setupRouter();
        this.setupNavigation();
        this.updateStatus();
    }

    /**
     * 设置页面组件
     */
    private setupPages() {
        const searchPageContainer = document.getElementById('search-page') as HTMLElement;
        const indexProjectPageContainer = document.getElementById('index-project-page') as HTMLElement;
        const projectsPageContainer = document.getElementById('projects-page') as HTMLElement;

        if (!searchPageContainer || !indexProjectPageContainer || !projectsPageContainer) {
            throw new Error('页面容器元素未找到');
        }

        this.searchPage = new SearchPage(searchPageContainer, this.apiClient);
        this.indexProjectPage = new IndexProjectPage(indexProjectPageContainer, this.apiClient);
        this.projectsPage = new ProjectsPage(projectsPageContainer, this.apiClient);

        // 设置页面回调
        this.indexProjectPage.setOnIndexComplete((result) => {
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
        document.querySelectorAll('.nav-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const pageId = target.getAttribute('data-page') as PageId;
                
                if (pageId) {
                    router.navigateTo(pageId);
                }
            });
        });
    }

    /**
     * 切换页面
     */
    private switchPage(pageId: PageId) {
        // 隐藏所有页面
        this.searchPage.hide();
        this.indexProjectPage.hide();
        this.projectsPage.hide();

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
        }

        // 高亮选中的导航按钮
        const activeButton = document.querySelector(`[data-page="${pageId}"]`) as HTMLElement;
        if (activeButton) {
            activeButton.classList.add('active');
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