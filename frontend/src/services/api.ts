/**
 * API客户端服务
 * 处理与后端的所有API通信
 */
export class ApiClient {
    private apiBaseUrl: string;
    private embeddersCache: {
        data: any[] | null;
        lastUpdated: number | null;
        cacheTTL: number; // 5分钟缓存
    };

    constructor(apiBaseUrl: string = 'http://localhost:3010') {
        this.apiBaseUrl = apiBaseUrl;
        this.embeddersCache = {
            data: null,
            lastUpdated: null,
            cacheTTL: 5 * 60 * 1000 // 5分钟
        };
    }

    /**
     * 获取系统状态
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/status`);
            return await response.json();
        } catch (error) {
            console.error('获取状态失败:', error);
            throw error;
        }
    }

    /**
     * 执行代码搜索
     */
    async search(query: string, projectId?: string, options?: {
        maxResults?: number;
        minScore?: number;
    }) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    options: {
                        projectId: projectId || undefined,
                        maxResults: options?.maxResults,
                        minScore: options?.minScore
                    }
                })
            });
            return await response.json();
        } catch (error) {
            console.error('搜索失败:', error);
            throw error;
        }
    }

    /**
     * 创建项目索引
     */
    async createProjectIndex(projectPath: string, options: {
        embedder: string;
        batchSize: number;
        maxFiles: number;
    }) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/indexing/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectPath,
                    options
                })
            });
            return await response.json();
        } catch (error) {
            console.error('创建项目索引失败:', error);
            throw error;
        }
    }

    /**
     * 获取项目列表
     */
    async getProjects() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects`);
            return await response.json();
        } catch (error) {
            console.error('获取项目列表失败:', error);
            throw error;
        }
    }

    /**
     * 重新索引项目
     */
    async reindexProject(projectId: string) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/reindex`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return await response.json();
        } catch (error) {
            console.error('重新索引项目失败:', error);
            throw error;
        }
    }

    /**
     * 删除项目
     */
    async deleteProject(projectId: string) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('删除项目失败:', error);
            throw error;
        }
    }

    /**
     * 获取可用的嵌入器列表
     * 使用缓存机制减少对后端的请求频率
     */
    async getAvailableEmbedders(forceRefresh: boolean = false) {
        const now = Date.now();
        
        // 如果缓存存在且未过期，并且不强制刷新，则返回缓存数据
        if (!forceRefresh &&
            this.embeddersCache.data &&
            this.embeddersCache.lastUpdated &&
            (now - this.embeddersCache.lastUpdated < this.embeddersCache.cacheTTL)) {
            console.debug('使用缓存的嵌入器数据');
            return { success: true, data: this.embeddersCache.data };
        }
        
        try {
            console.debug('从后端获取嵌入器数据');
            const response = await fetch(`${this.apiBaseUrl}/api/v1/indexing/embedders`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();
            
            // 更新缓存
            if (result.success && result.data) {
                this.embeddersCache.data = result.data;
                this.embeddersCache.lastUpdated = now;
                console.debug('嵌入器数据已缓存');
            }
            
            return result;
        } catch (error) {
            console.error('获取可用嵌入器失败:', error);
            
            // 如果有缓存数据，即使请求失败也返回缓存数据
            if (this.embeddersCache.data) {
                console.warn('嵌入器API请求失败，返回缓存数据');
                return { success: true, data: this.embeddersCache.data };
            }
            
            throw error;
        }
    }

    /**
     * 清除嵌入器缓存
     */
    clearEmbeddersCache() {
        this.embeddersCache.data = null;
        this.embeddersCache.lastUpdated = null;
        console.debug('嵌入器缓存已清除');
    }
}