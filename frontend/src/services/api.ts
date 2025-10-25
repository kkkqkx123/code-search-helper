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
    private searchCache: {
        [key: string]: {
            data: any;
            lastUpdated: number;
        };
    };
    private projectsCache: {
        [key: string]: {
            data: any;
            lastUpdated: number | null;
        };
    } = {};
    private cacheTTL: number = 10 * 60 * 1000; // 10分钟缓存
    private projectNameMappingCache: {
        data: { [hash: string]: string } | null;
        lastUpdated: number | null;
    } = {
        data: null,
        lastUpdated: null
    };
    private projectNameMappingCacheTTL: number = 5 * 60 * 1000; // 5分钟缓存

    constructor(apiBaseUrl: string = 'http://localhost:3010') {
        this.apiBaseUrl = apiBaseUrl;
        this.embeddersCache = {
            data: null,
            lastUpdated: null,
            cacheTTL: 5 * 60 * 1000 // 5分钟
        };
        this.searchCache = {};
        this.projectsCache = {};
        this.cacheTTL = 10 * 60 * 1000; // 10分钟
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
        page?: number;
        pageSize?: number;
        useCache?: boolean;
    }) {
        // 生成缓存键
        const cacheKey = this.generateSearchCacheKey(query, projectId, options);
        const now = Date.now();
        const useCache = options?.useCache !== false; // 默认使用缓存

        // 检查缓存
        if (useCache && this.searchCache[cacheKey]) {
            const cached = this.searchCache[cacheKey];
            // 缓存有效期为2小时
            if (now - cached.lastUpdated < 2 * 60 * 60 * 1000) {
                console.debug('使用缓存的搜索结果');
                return cached.data;
            }
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    options: {
                        projectId: projectId || undefined,
                        maxResults: options?.maxResults,
                        minScore: options?.minScore,
                        page: options?.page || 1,
                        pageSize: options?.pageSize || 10
                    }
                })
            });
            const result = await response.json();

            // 缓存结果
            if (useCache && result.success) {
                this.searchCache[cacheKey] = {
                    data: result,
                    lastUpdated: now
                };
                console.debug('搜索结果已缓存');
            }

            return result;
        } catch (error) {
            console.error('搜索失败:', error);

            // 如果有缓存数据，即使请求失败也返回缓存数据
            if (useCache && this.searchCache[cacheKey]) {
                console.warn('搜索API请求失败，返回缓存数据');
                return this.searchCache[cacheKey].data;
            }

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
     * 生成搜索缓存键
     */
    private generateSearchCacheKey(query: string, projectId?: string, options?: {
        maxResults?: number;
        minScore?: number;
        page?: number;
        pageSize?: number;
    }): string {
        // 按照固定顺序生成缓存键，避免因参数顺序变化导致缓存失效
        const sortedOptions = {
            query,
            projectId: projectId || '',
            maxResults: options?.maxResults?.toString() || '',
            minScore: options?.minScore?.toString() || '',
            page: options?.page?.toString() || '1',
            pageSize: options?.pageSize?.toString() || '10'
        };
        
        // 按照固定顺序拼接键值对
        return Object.entries(sortedOptions)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('&');
    }

    /**
     * 获取项目列表
     */
    async getProjects(forceRefresh: boolean = false, options?: {
        page?: number;
        pageSize?: number;
        search?: string;
        status?: string;
        sortBy?: string;
        sortOrder?: string;
    }) {
        const now = Date.now();
        const {
            page = 1,
            pageSize = 20,
            search = '',
            status = '',
            sortBy = 'name',
            sortOrder = 'asc'
        } = options || {};

        // 构建查询字符串
        const queryParams = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString(),
            search,
            status,
            sortBy,
            sortOrder
        });

        const cacheKey = `projects_${queryParams.toString()}`;
        const cacheData = this.projectsCache[cacheKey];

        // 如果缓存存在且未过期，并且不强制刷新，则返回缓存数据
        if (!forceRefresh &&
            cacheData &&
            cacheData.data &&
            cacheData.lastUpdated &&
            (now - cacheData.lastUpdated < this.cacheTTL)) {
            console.debug('使用缓存的项目数据');
            return { success: true, ...cacheData.data };
        }

        try {
            console.debug('从后端获取项目数据');
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects?${queryParams.toString()}`);
            const result = await response.json();

            // 更新缓存
            if (result.success) {
                if (!this.projectsCache) {
                    this.projectsCache = {};
                }
                this.projectsCache[cacheKey] = {
                    data: result,
                    lastUpdated: now
                };
                console.debug('项目数据已缓存');
            }

            return result;
        } catch (error) {
            console.error('获取项目列表失败:', error);

            // 如果有缓存数据，即使请求失败也返回缓存数据
            if (cacheData && cacheData.data) {
                console.warn('项目API请求失败，返回缓存数据');
                return { success: true, ...cacheData.data };
            }

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

    /**
     * 清除搜索缓存
     */
    clearSearchCache() {
        this.searchCache = {};
        console.debug('搜索缓存已清除');
    }

    /**
     * 清除项目缓存
     */
    clearProjectsCache() {
        this.projectsCache = {};
        console.debug('项目缓存已清除');
    }

    /**
     * 清除所有缓存
     */
    clearAllCache() {
        this.clearEmbeddersCache();
        this.clearSearchCache();
        this.clearProjectsCache();
        this.clearProjectNameMappingCache();
        console.debug('所有缓存已清除');
    }

    /**
     * 执行向量嵌入
     */
    async indexVectors(projectId: string, options?: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/index-vectors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options })
            });
            return await response.json();
        } catch (error) {
            console.error('向量嵌入失败:', error);
            throw error;
        }
    }

    /**
     * 获取向量状态
     */
    async getVectorStatus(projectId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/vector-status`);
            return await response.json();
        } catch (error) {
            console.error('获取向量状态失败:', error);
            throw error;
        }
    }

    /**
     * 执行图存储
     */
    async indexGraph(projectId: string, options?: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/index-graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options })
            });
            return await response.json();
        } catch (error) {
            console.error('图存储失败:', error);
            throw error;
        }
    }

    /**
     * 获取图状态
     */
    async getGraphStatus(projectId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/graph-status`);
            return await response.json();
        } catch (error) {
            console.error('获取图状态失败:', error);
            throw error;
        }
    }

    /**
     * 批量向量嵌入
     */
    async batchIndexVectors(projectIds: string[], options?: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/batch-index-vectors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds, options })
            });
            return await response.json();
        } catch (error) {
            console.error('批量向量嵌入失败:', error);
            throw error;
        }
    }

    /**
     * 批量图存储
     */
    async batchIndexGraph(projectIds: string[], options?: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/batch-index-graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds, options })
            });
            return await response.json();
        } catch (error) {
            console.error('批量图存储失败:', error);
            throw error;
        }
    }

    /**
     * 获取项目热重载配置
     */
    async getProjectHotReloadConfig(projectId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/hot-reload`);
            return await response.json();
        } catch (error) {
            console.error('获取项目热重载配置失败:', error);
            throw error;
        }
    }

    /**
     * 更新项目热重载配置
     */
    async updateProjectHotReloadConfig(projectId: string, config: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/hot-reload`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            return await response.json();
        } catch (error) {
            console.error('更新项目热重载配置失败:', error);
            throw error;
        }
    }

    /**
     * 切换项目热重载状态
     */
    async toggleProjectHotReload(projectId: string, enabled: boolean): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/hot-reload/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            return await response.json();
        } catch (error) {
            console.error('切换项目热重载状态失败:', error);
            throw error;
        }
    }

    /**
     * 手动更新项目索引
     */
    async updateProjectIndex(projectId: string, options?: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/indexing/${projectId}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options })
            });
            return await response.json();
        }
        catch (error) {
            console.error('手动更新项目索引失败:', error);
            throw error;
        }
    }
    /**
     * 获取更新进度
     */
    async getUpdateProgress(projectId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/indexing/${projectId}/update/progress`);
            return await response.json();
        } catch (error) {
            console.error('获取更新进度失败:', error);
            throw error;
        }
    }

    /**
     * 取消更新操作
     */
    async cancelUpdate(projectId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/indexing/${projectId}/update`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (error) {
            console.error('取消更新操作失败:', error);
            throw error;
        }
    }

    /**
     * 获取全局热重载配置
     */
    async getGlobalHotReloadConfig(): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/hot-reload/global`);
            return await response.json();
        } catch (error) {
            console.error('获取全局热重载配置失败:', error);
            throw error;
        }
    }

    /**
     * 更新全局热重载配置
     */
    async updateGlobalHotReloadConfig(config: any): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/hot-reload/global`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            return await response.json();
        } catch (error) {
            console.error('更新全局热重载配置失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有项目的热重载配置
     */
    async getAllProjectHotReloadConfigs(): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/hot-reload/projects`);
            return await response.json();
        } catch (error) {
            console.error('获取所有项目热重载配置失败:', error);
            throw error;
        }
    }

    /**
     * 获取Qdrant Collection信息
     */
    async getCollectionInfo(collectionId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/qdrant/collections/${collectionId}/info`);
            return await response.json();
        } catch (error) {
            console.error('获取Collection信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取Qdrant Collection统计
     */
    async getCollectionStats(collectionId: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/qdrant/collections/${collectionId}/stats`);
            return await response.json();
        } catch (error) {
            console.error('获取Collection统计失败:', error);
            throw error;
        }
    }

    /**
     * 获取Qdrant Collection数据点
     */
    async getCollectionPoints(collectionId: string, options?: {
        limit?: number;
        offset?: string;
        filter?: any;
    }): Promise<any> {
        try {
            const queryParams = new URLSearchParams();
            if (options?.limit) queryParams.append('limit', options.limit.toString());
            if (options?.offset) queryParams.append('offset', options.offset);
            if (options?.filter) queryParams.append('filter', JSON.stringify(options.filter));

            const response = await fetch(`${this.apiBaseUrl}/api/v1/qdrant/collections/${collectionId}/points?${queryParams.toString()}`);
            return await response.json();
        } catch (error) {
            console.error('获取Collection数据点失败:', error);
            throw error;
        }
    }

    /**
     * 获取项目哈希值到名称的映射
     */
    async getProjectNameMapping(useCache: boolean = true): Promise<any> {
        const now = Date.now();
        
        // 检查缓存
        if (useCache && 
            this.projectNameMappingCache.data && 
            this.projectNameMappingCache.lastUpdated &&
            (now - this.projectNameMappingCache.lastUpdated < this.projectNameMappingCacheTTL)) {
            console.debug('使用缓存的项目名称映射');
            return { success: true, data: this.projectNameMappingCache.data };
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/mapping`);
            const result = await response.json();
            
            // 更新缓存
            if (result.success && result.data) {
                this.projectNameMappingCache.data = result.data;
                this.projectNameMappingCache.lastUpdated = now;
                console.debug('项目名称映射已缓存');
            }
            
            return result;
        } catch (error) {
            console.error('获取项目名称映射失败:', error);
            
            // 如果有缓存数据，即使请求失败也返回缓存数据
            if (this.projectNameMappingCache.data) {
                console.warn('项目名称映射API请求失败，返回缓存数据');
                return { success: true, data: this.projectNameMappingCache.data };
            }
            
            throw error;
        }
    }

    /**
     * 根据哈希值获取项目名称
     */
    async getProjectNameByHash(hash: string): Promise<any> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/mapping/${hash}`);
            return await response.json();
        } catch (error) {
            console.error('根据哈希值获取项目名称失败:', error);
            throw error;
        }
    }

    /**
     * 清除项目名称映射缓存
     */
    clearProjectNameMappingCache() {
        this.projectNameMappingCache.data = null;
        this.projectNameMappingCache.lastUpdated = null;
        console.debug('项目名称映射缓存已清除');
    }
}
