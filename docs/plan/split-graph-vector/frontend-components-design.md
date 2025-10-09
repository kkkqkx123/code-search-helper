# 前端交互组件详细设计

## 📋 概述

本文档详细描述了向量嵌入和图存储分离管理的前端交互组件设计，包括UI组件、状态管理和用户交互流程。

## 🎯 设计目标

1. **直观显示**：清晰展示向量和图存储的双重状态
2. **独立操作**：支持分别执行向量嵌入和图存储操作
3. **实时反馈**：提供操作进度和结果的实时反馈
4. **批量处理**：支持批量操作多个项目

## 🧩 组件设计

### 1. 项目列表组件增强

#### 1.1 状态指示器组件

```typescript
export class StorageStatusIndicator extends HTMLElement {
  private vectorStatus: string;
  private graphStatus: string;
  private vectorProgress: number;
  private graphProgress: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['vector-status', 'graph-status', 'vector-progress', 'graph-progress'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.render();
    }
  }

  render() {
    this.shadowRoot!.innerHTML = `
      <style>
        .status-container {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
        .status-pending { background-color: #6b7280; }
        .status-indexing { background-color: #f59e0b; }
        .status-completed { background-color: #10b981; }
        .status-error { background-color: #ef4444; }
        .progress-bar {
          width: 40px;
          height: 4px;
          background-color: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }
      </style>
      <div class="status-container">
        <div class="status-item">
          <span class="status-dot status-${this.vectorStatus}"></span>
          <span>向量</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.vectorProgress}%; background-color: ${this.getProgressColor(this.vectorStatus)}"></div>
          </div>
        </div>
        <div class="status-item">
          <span class="status-dot status-${this.graphStatus}"></span>
          <span>图</span>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.graphProgress}%; background-color: ${this.getProgressColor(this.graphStatus)}"></div>
          </div>
        </div>
      </div>
    `;
  }

  private getProgressColor(status: string): string {
    const colors = {
      pending: '#6b7280',
      indexing: '#f59e0b',
      completed: '#10b981',
      error: '#ef4444'
    };
    return colors[status as keyof typeof colors] || '#6b7280';
  }
}

customElements.define('storage-status-indicator', StorageStatusIndicator);
```

#### 1.2 操作按钮组件

```typescript
export class StorageActionButtons extends HTMLElement {
  private projectId: string;
  private vectorStatus: string;
  private graphStatus: string;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['project-id', 'vector-status', 'graph-status'];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot!.innerHTML = `
      <style>
        .action-buttons {
          display: flex;
          gap: 8px;
        }
        .action-button {
          padding: 4px 8px;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .action-button:hover {
          background: #f3f4f6;
        }
        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .action-button.vector {
          border-color: #3b82f6;
          color: #3b82f6;
        }
        .action-button.graph {
          border-color: #8b5cf6;
          color: #8b5cf6;
        }
        .action-button.indexing {
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      </style>
      <div class="action-buttons">
        <button class="action-button vector" 
                data-action="index-vectors"
                ${this.vectorStatus === 'indexing' ? 'disabled' : ''}>
          ${this.vectorStatus === 'indexing' ? '索引中...' : '向量嵌入'}
        </button>
        <button class="action-button graph" 
                data-action="index-graph"
                ${this.graphStatus === 'indexing' ? 'disabled' : ''}>
          ${this.graphStatus === 'indexing' ? '索引中...' : '图存储'}
        </button>
      </div>
    `;
  }

  private setupEventListeners() {
    this.shadowRoot!.querySelectorAll('.action-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        this.dispatchEvent(new CustomEvent('storage-action', {
          detail: { projectId: this.projectId, action }
        }));
      });
    });
  }
}

customElements.define('storage-action-buttons', StorageActionButtons);
```

### 2. 项目详情页面增强

#### 2.1 存储状态面板组件

```typescript
export class StorageStatusPanel {
  private container: HTMLElement;
  private apiClient: ApiClient;
  private projectId: string;
  private refreshInterval?: number;

  constructor(container: HTMLElement, apiClient: ApiClient, projectId: string) {
    this.container = container;
    this.apiClient = apiClient;
    this.projectId = projectId;
    this.render();
    this.startAutoRefresh();
  }

  async render() {
    try {
      const [vectorStatus, graphStatus] = await Promise.all([
        this.apiClient.getVectorStatus(this.projectId),
        this.apiClient.getGraphStatus(this.projectId)
      ]);

      this.container.innerHTML = `
        <div class="storage-panel">
          <h3>存储状态</h3>
          <div class="storage-sections">
            ${this.renderStorageSection('vector', '向量存储', vectorStatus)}
            ${this.renderStorageSection('graph', '图存储', graphStatus)}
          </div>
          <div class="action-buttons">
            <button class="btn primary" data-action="index-vectors">执行向量嵌入</button>
            <button class="btn secondary" data-action="index-graph">执行图存储</button>
            <button class="btn outline" data-action="refresh">刷新状态</button>
          </div>
        </div>
      `;

      this.setupEventListeners();
    } catch (error) {
      this.container.innerHTML = `
        <div class="error">
          加载存储状态失败: ${error.message}
        </div>
      `;
    }
  }

  private renderStorageSection(type: string, title: string, status: any): string {
    return `
      <div class="storage-section ${type}">
        <h4>${title}</h4>
        <div class="status-info">
          <span class="status-badge ${status.status}">${status.status}</span>
          <div class="progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${status.progress}%"></div>
            </div>
            <span class="progress-text">${status.progress}%</span>
          </div>
          <div class="stats">
            <span>文件: ${status.processedFiles}/${status.totalFiles}</span>
            <span class="errors">错误: ${status.failedFiles}</span>
          </div>
          ${status.error ? `<div class="error-message">${status.error}</div>` : ''}
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    this.container.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', async (e) => {
        const action = (e.target as HTMLElement).dataset.action;
        
        switch (action) {
          case 'index-vectors':
            await this.indexVectors();
            break;
          case 'index-graph':
            await this.indexGraph();
            break;
          case 'refresh':
            await this.render();
            break;
        }
      });
    });
  }

  private async indexVectors() {
    try {
      await this.apiClient.indexVectors(this.projectId);
      this.showNotification('向量嵌入已开始', 'success');
      await this.render();
    } catch (error) {
      this.showNotification(`向量嵌入失败: ${error.message}`, 'error');
    }
  }

  private async indexGraph() {
    try {
      await this.apiClient.indexGraph(this.projectId);
      this.showNotification('图存储已开始', 'success');
      await this.render();
    } catch (error) {
      this.showNotification(`图存储失败: ${error.message}`, 'error');
    }
  }

  private startAutoRefresh() {
    this.refreshInterval = window.setInterval(() => {
      this.render();
    }, 5000); // 每5秒刷新一次
  }

  dispose() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}
```

### 3. 批量操作界面

#### 3.1 批量操作面板

```typescript
export class BatchOperationsPanel {
  private container: HTMLElement;
  private apiClient: ApiClient;
  private selectedProjects: Set<string> = new Set();

  constructor(container: HTMLElement, apiClient: ApiClient) {
    this.container = container;
    this.apiClient = apiClient;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="batch-operations">
        <h3>批量操作</h3>
        <div class="selection-info">
          <span>已选择 <span id="selected-count">0</span> 个项目</span>
          <button id="select-all">全选</button>
          <button id="clear-selection">清除</button>
        </div>
        <div class="operation-buttons">
          <button class="btn primary" data-operation="batch-index-vectors">批量向量嵌入</button>
          <button class="btn secondary" data-operation="batch-index-graph">批量图存储</button>
        </div>
        <div class="progress-overlay" style="display: none;">
          <div class="progress-container">
            <h4>批量处理中...</h4>
            <div class="progress-bar">
              <div class="progress-fill"></div>
            </div>
            <div class="progress-details"></div>
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // 项目选择逻辑
    document.addEventListener('project-selected', (e: CustomEvent) => {
      this.toggleProjectSelection(e.detail.projectId, e.detail.selected);
    });

    // 批量操作按钮
    this.container.querySelectorAll('[data-operation]').forEach(button => {
      button.addEventListener('click', async (e) => {
        const operation = (e.target as HTMLElement).dataset.operation;
        if (this.selectedProjects.size === 0) {
          this.showNotification('请先选择项目', 'warning');
          return;
        }

        await this.executeBatchOperation(operation);
      });
    });

    // 选择控制
    this.container.querySelector('#select-all')?.addEventListener('click', () => {
      this.selectAllProjects();
    });

    this.container.querySelector('#clear-selection')?.addEventListener('click', () => {
      this.clearSelection();
    });
  }

  private async executeBatchOperation(operation: string) {
    const projectIds = Array.from(this.selectedProjects);
    
    try {
      this.showProgressOverlay(true);
      
      let result;
      if (operation === 'batch-index-vectors') {
        result = await this.apiClient.batchIndexVectors(projectIds);
      } else if (operation === 'batch-index-graph') {
        result = await this.apiClient.batchIndexGraph(projectIds);
      }

      if (result.success) {
        this.showNotification('批量操作已开始', 'success');
      } else {
        this.showNotification(`批量操作失败: ${result.error}`, 'error');
      }
    } catch (error) {
      this.showNotification(`批量操作错误: ${error.message}`, 'error');
    } finally {
      this.showProgressOverlay(false);
    }
  }

  private showProgressOverlay(show: boolean) {
    const overlay = this.container.querySelector('.progress-overlay') as HTMLElement;
    overlay.style.display = show ? 'block' : 'none';
  }
}
```

### 4. API客户端扩展实现

```typescript
export class ApiClient {
  // ... 现有方法 ...

  // 向量操作
  async indexVectors(projectId: string, options?: any): Promise<ApiResponse> {
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

  async getVectorStatus(projectId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/vector-status`);
      return await response.json();
    } catch (error) {
      console.error('获取向量状态失败:', error);
      throw error;
    }
  }

  // 图操作
  async indexGraph(projectId: string, options?: any): Promise<ApiResponse> {
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

  async getGraphStatus(projectId: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/projects/${projectId}/graph-status`);
      return await response.json();
    } catch (error) {
      console.error('获取图状态失败:', error);
      throw error;
    }
  }

  // 批量操作
  async batchIndexVectors(projectIds: string[], options?: any): Promise<ApiResponse> {
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

  async batchIndexGraph(projectIds: string[], options?: any): Promise<ApiResponse> {
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
}
```

## 🎨 样式设计

### 状态颜色方案

```css
:root {
  /* 状态颜色 */
  --status-pending: #6b7280;
  --status-indexing: #f59e0b;
  --status-completed: #10b981;
  --status-error: #ef4444;
  --status-partial: #8b5cf6;

  /* 存储类型颜色 */
  --vector-color: #3b82f6;
  --graph-color: #8b5cf6;

  /* 进度条颜色 */
  --progress-background: #e5e7eb;
  --progress-vector: var(--vector-color);
  --progress-graph: var(--graph-color);
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.pending { background-color: var(--status-pending); color: white; }
.status-badge.indexing { background-color: var(--status-indexing); color: white; }
.status-badge.completed { background-color: var(--status-completed); color: white; }
.status-badge.error { background-color: var(--status-error); color: white; }
.status-badge.partial { background-color: var(--status-partial); color: white; }

/* 存储类型特定样式 */
.storage-section.vector {
  border-left: 3px solid var(--vector-color);
}

.storage-section.graph {
  border-left: 3px solid var(--graph-color);
}

.progress-fill.vector {
  background-color: var(--progress-vector);
}

.progress-fill.graph {
  background-color: var(--progress-graph);
}
```

## 📊 用户体验流程

### 单个项目操作流程
1. 用户在项目列表看到双状态指示器
2. 点击特定存储类型的操作按钮
3. 系统显示操作确认对话框
4. 开始执行，状态指示器变为"索引中"
5. 实时更新进度，完成后显示结果

### 批量操作流程
1. 用户选择多个项目（复选框或Shift选择）
2. 点击批量操作按钮
3. 系统显示操作确认和预计时间
4. 显示批量进度面板
5. 完成后显示汇总报告

## 🚀 实施计划

### 阶段一：基础组件（1周）
- [ ] 实现状态指示器组件
- [ ] 实现操作按钮组件
- [ ] 扩展API客户端

### 阶段二：详情页面（1周）
- [ ] 实现存储状态面板
- [ ] 集成到项目详情页
- [ ] 实现自动刷新功能

### 阶段三：批量操作（1周）
- [ ] 实现批量选择功能
- [ ] 实现批量操作面板
- [ ] 实现进度监控

### 阶段四：优化测试（1周）
- [ ] 性能优化
- [ ] 用户体验测试
- [ ] 错误处理完善

---

*设计方案版本：v1.0*
*最后更新：2024-01-15*