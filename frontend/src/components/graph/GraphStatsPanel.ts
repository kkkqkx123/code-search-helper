/**
 * 图统计面板组件
 * 显示图数据库的统计信息
 */
export class GraphStatsPanel {
  private container: HTMLElement;
  private apiClient: any;
  private projectId: string = '';
  private refreshInterval: number | null = null;
  
  constructor(container: HTMLElement, apiClient: any) {
    this.container = container;
    this.apiClient = apiClient;
    this.render();
  }
  
  /**
   * 渲染统计面板
   */
  private render() {
    this.container.innerHTML = `
      <div class="stats-panel">
        <div class="stats-header">
          <h3>图统计信息</h3>
          <div class="stats-controls">
            <input type="text" id="project-id-input" class="form-control" placeholder="输入项目ID" style="width: 200px; margin-right: 10px;">
            <button id="refresh-stats" class="search-button" style="padding: 6px 12px;">刷新</button>
            <button id="auto-refresh" class="search-button" style="padding: 6px 12px; background-color: #64748b; margin-left: 10px;">自动刷新</button>
          </div>
        </div>
        
        <div id="stats-content" class="stats-content">
          <div class="no-stats">请输入项目ID并点击刷新按钮</div>
        </div>
      </div>
    `;
    
    this.setupEventListeners();
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    const refreshButton = this.container.querySelector('#refresh-stats') as HTMLButtonElement;
    const autoRefreshButton = this.container.querySelector('#auto-refresh') as HTMLButtonElement;
    const projectIdInput = this.container.querySelector('#project-id-input') as HTMLInputElement;
    
    refreshButton?.addEventListener('click', () => {
      const projectId = projectIdInput?.value.trim();
      if (projectId) {
        this.loadStats(projectId);
      } else {
        this.showNoStats('请输入项目ID');
      }
    });
    
    autoRefreshButton?.addEventListener('click', () => {
      this.toggleAutoRefresh();
    });
    
    // 支持回车键刷新
    projectIdInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const projectId = (e.target as HTMLInputElement).value.trim();
        if (projectId) {
          this.loadStats(projectId);
        }
      }
    });
  }
  
  /**
   * 加载统计信息
   */
  async loadStats(projectId: string) {
    const statsContent = this.container.querySelector('#stats-content') as HTMLElement;
    if (!statsContent) return;
    
    statsContent.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
      const result = await this.apiClient.getGraphStats(projectId);
      
      if (result.success) {
        this.projectId = projectId;
        this.displayStats(result);
        
        // 如果处于自动刷新状态，设置定时器
        if (this.refreshInterval) {
          this.stopAutoRefresh();
          this.startAutoRefresh();
        }
      } else {
        this.showNoStats(`加载统计信息失败: ${result.message || '未知错误'}`);
      }
    } catch (error: any) {
      this.showNoStats(`请求失败: ${error.message}`);
    }
  }
  
  /**
   * 显示统计信息
   */
  private displayStats(stats: any) {
    const statsContent = this.container.querySelector('#stats-content') as HTMLElement;
    if (!statsContent) return;
    
    const data = stats.data;
    
    // 计算健康状态颜色
    const healthColor = data.healthStatus === 'healthy' ? '#10b981' : 
                       data.healthStatus === 'warning' ? '#f59e0b' : '#ef4444';
    
    // 格式化文件大小
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    statsContent.innerHTML = `
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-label">节点数量</div>
          <div class="stat-value">${data.nodeCount.toLocaleString()}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">边数量</div>
          <div class="stat-value">${data.edgeCount.toLocaleString()}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">项目数量</div>
          <div class="stat-value">${data.projectCount}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">索引大小</div>
          <div class="stat-value">${formatSize(data.indexSize)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">存储大小</div>
          <div class="stat-value">${formatSize(data.storageSize)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">最后更新</div>
          <div class="stat-value">${new Date(data.lastUpdated).toLocaleString()}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">健康状态</div>
          <div class="stat-value" style="color: ${healthColor}; font-weight: bold;">
            ● ${data.healthStatus.toUpperCase()}
          </div>
        </div>
      </div>
      
      <div class="stats-actions">
        <button id="check-health" class="search-button" style="padding: 6px 12px;">健康检查</button>
      </div>
    `;
    
    // 添加健康检查按钮事件
    const healthButton = statsContent.querySelector('#check-health') as HTMLButtonElement;
    healthButton?.addEventListener('click', async () => {
      try {
        const healthResult = await this.apiClient.checkHealth();
        if (healthResult.success) {
          alert('服务健康状态: 正常');
        } else {
          alert(`服务健康状态: 异常 - ${healthResult.message || '未知错误'}`);
        }
      } catch (error: any) {
        alert(`健康检查失败: ${error.message}`);
      }
    });
  }
  
  /**
   * 显示无统计信息状态
   */
  private showNoStats(message: string) {
    const statsContent = this.container.querySelector('#stats-content') as HTMLElement;
    if (!statsContent) return;
    
    statsContent.innerHTML = `<div class="no-stats">${message}</div>`;
  }
  
  /**
   * 切换自动刷新
   */
  private toggleAutoRefresh() {
    const button = this.container.querySelector('#auto-refresh') as HTMLButtonElement;
    if (!button) return;
    
    if (this.refreshInterval) {
      this.stopAutoRefresh();
      button.textContent = '自动刷新';
      button.style.backgroundColor = '#64748b';
    } else {
      this.startAutoRefresh();
      button.textContent = '停止刷新';
      button.style.backgroundColor = '#ef4444';
    }
  }
  
  /**
   * 开始自动刷新
   */
  private startAutoRefresh() {
    if (this.projectId) {
      this.refreshInterval = window.setInterval(() => {
        this.loadStats(this.projectId);
      }, 5000); // 每5秒刷新一次
    }
  }
  
  /**
   * 停止自动刷新
   */
  private stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
  
  /**
   * 设置项目ID
   */
  setProjectId(projectId: string) {
    const input = this.container.querySelector('#project-id-input') as HTMLInputElement;
    if (input) {
      input.value = projectId;
    }
    this.projectId = projectId;
  }
  
  /**
   * 销毁组件
   */
  destroy() {
    this.stopAutoRefresh();
    
    const refreshButton = this.container.querySelector('#refresh-stats') as HTMLButtonElement;
    const autoRefreshButton = this.container.querySelector('#auto-refresh') as HTMLButtonElement;
    const projectIdInput = this.container.querySelector('#project-id-input') as HTMLInputElement;
    const healthButton = this.container.querySelector('#check-health') as HTMLButtonElement;
    
    refreshButton?.removeEventListener('click', () => {});
    autoRefreshButton?.removeEventListener('click', () => {});
    projectIdInput?.removeEventListener('keypress', () => {});
    healthButton?.removeEventListener('click', () => {});
  }
}