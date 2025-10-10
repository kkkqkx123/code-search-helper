/**
 * 批量操作面板组件
 * 提供批量向量和图存储操作功能
 */
export class BatchOperationsPanel extends HTMLElement {
  private _shadowRoot: ShadowRoot;
  private selectedProjects: Set<string> = new Set();
  private apiClient: any; // Will be set from outside
  private onBatchOperationComplete?: (operation: string, result: any) => void;

  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ mode: 'open' });
  }

 connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  private render() {
    this._shadowRoot.innerHTML = `
      <style>
        .batch-operations {
          padding: 16px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background-color: #f8fafc;
          margin: 16px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .batch-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .batch-title {
          font-size: 16px;
          font-weight: 600;
          color: #1e293b;
        }

        .selection-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          font-size: 14px;
          color: #64748b;
        }

        .selection-info button {
          background: #e2e8f0;
          border: none;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          margin-left: 8px;
        }

        .selection-info button:hover {
          background: #cbd5e1;
        }

        .operation-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .operation-button {
          padding: 8px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .operation-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .operation-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .operation-button.vector {
          border-color: #0d6efd;
          color: #0d6efd;
        }

        .operation-button.vector:hover:not(:disabled) {
          background: #0d6efd;
          color: white;
        }

        .operation-button.graph {
          border-color: #6f42c1;
          color: #6f42c1;
        }

        .operation-button.graph:hover:not(:disabled) {
          background: #6f42c1;
          color: white;
        }

        .progress-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .progress-container {
          background: white;
          padding: 24px;
          border-radius: 8px;
          width: 400px;
          text-align: center;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          margin: 16px 0;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #0d6efd;
          width: 0%;
          transition: width 0.3s ease;
        }

        .progress-details {
          font-size: 14px;
          color: #64748b;
          margin-top: 8px;
        }
      </style>

      <div class="batch-operations">
        <div class="batch-header">
          <div class="batch-title">批量操作</div>
        </div>
        
        <div class="selection-info">
          <span>已选择 <span id="selected-count">0</span> 个项目</span>
          <button id="select-all">全选</button>
          <button id="clear-selection">清除</button>
        </div>
        
        <div class="operation-buttons">
          <button class="operation-button vector" id="batch-index-vectors" data-operation="batch-index-vectors">
            批量向量嵌入
          </button>
          <button class="operation-button graph" id="batch-index-graph" data-operation="batch-index-graph">
            批量图存储
          </button>
        </div>
        
        <div class="progress-overlay" id="progress-overlay" style="display: none;">
          <div class="progress-container">
            <h4>批量处理中...</h4>
            <div class="progress-bar">
              <div class="progress-fill" id="progress-fill"></div>
            </div>
            <div class="progress-details" id="progress-details">准备开始</div>
            <button id="cancel-batch" style="margin-top: 16px; padding: 6px 12px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer;">取消</button>
          </div>
        </div>
      </div>
    `;
  }

  private setupEventListeners() {
    // 项目选择事件监听
    document.addEventListener('project-selected', (e: any) => {
      this.toggleProjectSelection(e.detail.projectId, e.detail.selected);
    });

    // 选择控制按钮
    this._shadowRoot.getElementById('select-all')?.addEventListener('click', () => {
      this.selectAllProjects();
    });

    this._shadowRoot.getElementById('clear-selection')?.addEventListener('click', () => {
      this.clearSelection();
    });

    // 批量操作按钮
    this._shadowRoot.getElementById('batch-index-vectors')?.addEventListener('click', async () => {
      if (this.selectedProjects.size === 0) {
        alert('请先选择项目');
        return;
      }
      await this.executeBatchOperation('batch-index-vectors');
    });

    this._shadowRoot.getElementById('batch-index-graph')?.addEventListener('click', async () => {
      if (this.selectedProjects.size === 0) {
        alert('请先选择项目');
        return;
      }
      await this.executeBatchOperation('batch-index-graph');
    });

    // 取消批量操作
    this._shadowRoot.getElementById('cancel-batch')?.addEventListener('click', () => {
      this.hideProgressOverlay();
    });
  }

  /**
   * 切换项目选择状态
   */
  private toggleProjectSelection(projectId: string, selected: boolean) {
    if (selected) {
      this.selectedProjects.add(projectId);
    } else {
      this.selectedProjects.delete(projectId);
    }
    this.updateSelectionCount();
  }

  /**
   * 选择所有项目
   */
  private selectAllProjects() {
    // 这里需要从外部获取项目列表
    // 暂时显示提示信息
    alert('全选功能需要从父组件获取项目列表');
  }

  /**
   * 清除选择
   */
  private clearSelection() {
    this.selectedProjects.clear();
    this.updateSelectionCount();
    
    // 触发取消选择所有项目的事件
    document.dispatchEvent(new CustomEvent('batch-clear-selection', {
      detail: { projects: Array.from(this.selectedProjects) }
    }));
  }

  /**
   * 更新选择计数
   */
  private updateSelectionCount() {
    const countElement = this._shadowRoot.getElementById('selected-count');
    if (countElement) {
      countElement.textContent = this.selectedProjects.size.toString();
    }
  }

 /**
   * 执行批量操作
   */
  private async executeBatchOperation(operation: string) {
    if (!this.apiClient) {
      console.error('API client not set');
      return;
    }

    try {
      this.showProgressOverlay();
      
      const projectIds = Array.from(this.selectedProjects);
      let result;

      if (operation === 'batch-index-vectors') {
        result = await this.apiClient.batchIndexVectors(projectIds);
      } else if (operation === 'batch-index-graph') {
        result = await this.apiClient.batchIndexGraph(projectIds);
      } else {
        throw new Error(`Unknown operation: ${operation}`);
      }

      if (result.success) {
        alert('批量操作已启动');
        
        if (this.onBatchOperationComplete) {
          this.onBatchOperationComplete(operation, result);
        }
      } else {
        alert(`批量操作失败: ${result.error || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('批量操作失败:', error);
      alert(`批量操作失败: ${error.message}`);
    } finally {
      this.hideProgressOverlay();
    }
 }

  /**
   * 显示进度覆盖层
   */
  private showProgressOverlay() {
    const overlay = this._shadowRoot.getElementById('progress-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
 }

  /**
   * 隐藏进度覆盖层
   */
  private hideProgressOverlay() {
    const overlay = this._shadowRoot.getElementById('progress-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
 }

  /**
   * 设置API客户端
   */
  setApiClient(apiClient: any) {
    this.apiClient = apiClient;
  }

  /**
   * 设置批量操作完成回调
   */
  setOnBatchOperationComplete(callback: (operation: string, result: any) => void) {
    this.onBatchOperationComplete = callback;
  }

  /**
   * 获取选中的项目ID
   */
  getSelectedProjects(): string[] {
    return Array.from(this.selectedProjects);
  }

  /**
   * 设置选中的项目
   */
  setSelectedProjects(projectIds: string[]) {
    this.selectedProjects = new Set(projectIds);
    this.updateSelectionCount();
  }
}
