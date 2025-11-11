/**
 * 路由管理器
 * 处理页面导航和状态管理
 */
export type PageId = 'search' | 'index-project' | 'projects' | 'graph-explorer' | 'graph-analysis' | 'graph-management' | 'qdrant-view';

export class Router {
    private currentPage: PageId = 'search';
    private pageChangeCallbacks: ((pageId: PageId) => void | Promise<void>)[] = [];

    constructor() {
        this.initialize();
    }

    /**
     * 初始化路由
     */
    private initialize() {
        // 监听浏览器前进/后退
        window.addEventListener('popstate', async (event) => {
            if (event.state && event.state.page) {
                await this.navigateTo(event.state.page as PageId, false);
            }
        });

        // 延迟初始化，确保DOM完全加载
        setTimeout(async () => {
            // 初始加载时设置当前页面
            const initialPage = this.getPageFromUrl() || 'search';
            await this.navigateTo(initialPage, true);
        }, 0);
    }

    /**
     * 从URL获取页面ID
     */
    private getPageFromUrl(): PageId | null {
        const hash = window.location.hash.substring(1);
        if (['search', 'index-project', 'projects', 'graph-explorer', 'graph-analysis', 'graph-management', 'qdrant-view'].includes(hash)) {
            return hash as PageId;
        }
        return null;
    }

    /**
     * 导航到指定页面
     */
    async navigateTo(pageId: PageId, updateHistory: boolean = true) {
        if (this.currentPage === pageId) return;

        this.currentPage = pageId;

        // 更新URL哈希
        if (updateHistory) {
            history.pushState({ page: pageId }, '', `#${pageId}`);
        }

        // 通知所有监听器页面已更改（支持异步回调）
        for (const callback of this.pageChangeCallbacks) {
            try {
                await callback(pageId);
            } catch (error) {
                console.error('Error in page change callback:', error);
            }
        }
    }

    /**
     * 获取当前页面
     */
    getCurrentPage(): PageId {
        return this.currentPage;
    }

    /**
     * 添加页面变化监听器
     */
    onPageChange(callback: (pageId: PageId) => void) {
        this.pageChangeCallbacks.push(callback);
    }

    /**
     * 移除页面变化监听器
     */
    removePageChangeListener(callback: (pageId: PageId) => void) {
        const index = this.pageChangeCallbacks.indexOf(callback);
        if (index > -1) {
            this.pageChangeCallbacks.splice(index, 1);
        }
    }
}

// 创建全局路由实例
export const router = new Router();