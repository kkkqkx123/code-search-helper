import { ApiClient } from '../services/api.js';

/**
 * Qdrant Collection视图页面组件
 */
export class QdrantCollectionViewPage {
    private apiClient: ApiClient;
    private container: HTMLElement;
    private currentCollectionId: string | null = null;

    constructor(container: HTMLElement, apiClient: ApiClient) {
        this.container = container;
        this.apiClient = apiClient;
        this.render();
        this.setupEventListeners();
    }

    /**
     * 渲染Qdrant Collection视图页面
     */
    private render() {
        this.container.innerHTML = `
            <div class="form-container">
                <h2>Qdrant Collection 查看器</h2>
                <div class="form-group">
                    <label for="collection-id">Collection ID:</label>
                    <input type="text" id="collection-id" class="form-control" 
                           placeholder="输入Qdrant Collection ID">
                    <button id="load-collection-btn" class="search-button">加载Collection</button>
                </div>
                
                <div id="collection-info" class="info-section" style="display: none;">
                    <h3>Collection 信息</h3>
                    <div id="collection-details"></div>
                </div>
                
                <div id="collection-stats" class="info-section" style="display: none;">
                    <h3>Collection 统计</h3>
                    <div id="stats-details"></div>
                </div>
                
                <div id="collection-points" class="info-section" style="display: none;">
                    <h3>Collection 数据点</h3>
                    <div class="form-group">
                        <label for="points-limit">每页显示数量:</label>
                        <input type="number" id="points-limit" class="form-control" value="100" min="1" max="1000">
                        <button id="load-points-btn" class="search-button">加载数据点</button>
                    </div>
                    <div id="points-list"></div>
                    <div id="pagination-controls"></div>
                </div>
                
                <div id="loading-indicator" class="loading" style="display: none;">
                    <div class="spinner"></div>
                    <span>加载中...</span>
                </div>
                
                <div id="error-message" class="error" style="display: none;"></div>
            </div>
        `;
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners() {
        const loadCollectionBtn = this.container.querySelector('#load-collection-btn') as HTMLButtonElement;
        const loadPointsBtn = this.container.querySelector('#load-points-btn') as HTMLButtonElement;
        const collectionIdInput = this.container.querySelector('#collection-id') as HTMLInputElement;

        loadCollectionBtn?.addEventListener('click', () => {
            const collectionId = collectionIdInput.value.trim();
            if (collectionId) {
                this.loadCollection(collectionId);
            } else {
                this.showError('请输入有效的Collection ID');
            }
        });

        loadPointsBtn?.addEventListener('click', () => {
            if (this.currentCollectionId) {
                const limitInput = this.container.querySelector('#points-limit') as HTMLInputElement;
                const limit = parseInt(limitInput.value) || 100;
                this.loadCollectionPoints(this.currentCollectionId, limit);
            }
        });

        // 回车键加载Collection
        collectionIdInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const collectionId = collectionIdInput.value.trim();
                if (collectionId) {
                    this.loadCollection(collectionId);
                }
            }
        });
    }

    /**
     * 加载Collection信息
     */
    private async loadCollection(collectionId: string) {
        this.currentCollectionId = collectionId;
        this.showLoading(true);
        this.hideError();
        
        try {
            // 并行加载Collection信息和统计
            const [infoResult, statsResult] = await Promise.all([
                this.apiClient.getCollectionInfo(collectionId),
                this.apiClient.getCollectionStats(collectionId)
            ]);

            if (infoResult.success) {
                this.showCollectionInfo(infoResult.data);
            } else {
                this.showError(`获取Collection信息失败: ${infoResult.error || '未知错误'}`);
            }

            if (statsResult.success) {
                this.showCollectionStats(statsResult.data);
            } else {
                // 统计信息失败不是致命错误，只显示警告
                console.warn(`获取Collection统计失败: ${statsResult.error || '未知错误'}`);
            }
            
            // 显示数据点加载区域
            const pointsSection = this.container.querySelector('#collection-points') as HTMLElement;
            if (pointsSection) {
                pointsSection.style.display = 'block';
            }
        } catch (error: any) {
            this.showError(`加载Collection失败: ${error.message || '网络错误'}`);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 显示Collection信息
     */
    private showCollectionInfo(info: any) {
        const infoSection = this.container.querySelector('#collection-info') as HTMLElement;
        const detailsDiv = this.container.querySelector('#collection-details') as HTMLElement;
        
        if (infoSection && detailsDiv) {
            detailsDiv.innerHTML = `
                <table class="details-table">
                    <tr>
                        <td><strong>名称:</strong></td>
                        <td>${info.name || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>向量数量:</strong></td>
                        <td>${info.vectorsCount || 0}</td>
                    </tr>
                    <tr>
                        <td><strong>向量维度:</strong></td>
                        <td>${info.vectorSize || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>距离计算方式:</strong></td>
                        <td>${info.distance || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>状态:</strong></td>
                        <td>${info.status || 'N/A'}</td>
                    </tr>
                </table>
            `;
            infoSection.style.display = 'block';
        }
    }

    /**
     * 显示Collection统计
     */
    private showCollectionStats(stats: any) {
        const statsSection = this.container.querySelector('#collection-stats') as HTMLElement;
        const detailsDiv = this.container.querySelector('#stats-details') as HTMLElement;
        
        if (statsSection && detailsDiv) {
            detailsDiv.innerHTML = `
                <table class="details-table">
                    <tr>
                        <td><strong>名称:</strong></td>
                        <td>${stats.name || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>向量总数:</strong></td>
                        <td>${stats.vectorsCount || 0}</td>
                    </tr>
                    <tr>
                        <td><strong>向量维度:</strong></td>
                        <td>${stats.vectorSize || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>距离计算方式:</strong></td>
                        <td>${stats.distance || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>状态:</strong></td>
                        <td>${stats.status || 'N/A'}</td>
                    </tr>
                    ${stats.diskUsage ? `
                    <tr>
                        <td><strong>磁盘使用:</strong></td>
                        <td>${stats.diskUsage} bytes</td>
                    </tr>` : ''}
                    ${stats.memoryUsage ? `
                    <tr>
                        <td><strong>内存使用:</strong></td>
                        <td>${stats.memoryUsage} bytes</td>
                    </tr>` : ''}
                </table>
            `;
            statsSection.style.display = 'block';
        }
    }

    /**
     * 加载Collection数据点
     */
    private async loadCollectionPoints(collectionId: string, limit: number = 100) {
        this.showLoading(true);
        this.hideError();
        
        try {
            const result = await this.apiClient.getCollectionPoints(collectionId, { limit });
            
            if (result.success) {
                this.showCollectionPoints(result.data);
            } else {
                this.showError(`获取Collection数据点失败: ${result.error || '未知错误'}`);
            }
        } catch (error: any) {
            this.showError(`加载Collection数据点失败: ${error.message || '网络错误'}`);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * 显示Collection数据点
     */
    private showCollectionPoints(points: any[]) {
        const pointsList = this.container.querySelector('#points-list') as HTMLElement;
        
        if (pointsList) {
            if (!points || points.length === 0) {
                pointsList.innerHTML = '<p class="no-results">没有找到数据点</p>';
                return;
            }
            
            let pointsHtml = '<div class="points-grid">';
            
            points.forEach((point, _index) => {
                pointsHtml += `
                    <div class="point-card">
                        <div class="point-header">
                            <strong>ID:</strong> ${point.id || 'N/A'}
                        </div>
                        <div class="point-content">
                            ${point.payload ? `
                                <div class="payload-section">
                                    <strong>Payload:</strong>
                                    <pre>${JSON.stringify(point.payload, null, 2)}</pre>
                                </div>
                            ` : '<p>无Payload数据</p>'}
                        </div>
                    </div>
                `;
            });
            
            pointsHtml += '</div>';
            pointsList.innerHTML = pointsHtml;
        }
    }

    /**
     * 显示加载指示器
     */
    private showLoading(show: boolean) {
        const loadingIndicator = this.container.querySelector('#loading-indicator') as HTMLElement;
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * 显示错误信息
     */
    private showError(message: string) {
        const errorDiv = this.container.querySelector('#error-message') as HTMLElement;
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }

    /**
     * 隐藏错误信息
     */
    private hideError() {
        const errorDiv = this.container.querySelector('#error-message') as HTMLElement;
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }
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