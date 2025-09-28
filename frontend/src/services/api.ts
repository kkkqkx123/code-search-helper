/**
 * API客户端服务
 * 处理与后端的所有API通信
 */
export class ApiClient {
    private apiBaseUrl: string;

    constructor(apiBaseUrl: string = 'http://localhost:3010') {
        this.apiBaseUrl = apiBaseUrl;
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
    async search(query: string) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
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
}