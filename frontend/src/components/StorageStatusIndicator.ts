
/**
 * 存储状态指示器组件
 * 用于显示向量存储和图存储的状态
 */
export class StorageStatusIndicator extends HTMLElement {
  private vectorStatus: string = 'pending';
  private graphStatus: string = 'pending';
  private vectorProgress: number = 0;
  private graphProgress: number = 0;

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
      switch (name) {
        case 'vector-status':
          this.vectorStatus = newValue;
          break;
        case 'graph-status':
          this.graphStatus = newValue;
          break;
        case 'vector-progress':
          this.vectorProgress = parseFloat(newValue) || 0;
          break;
        case 'graph-progress':
          this.graphProgress = parseFloat(newValue) || 0;
          break;
      }
      this.render();
    }
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        .status-container {
          display: flex;
          gap: 12px;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          background: #f8f9fa;
          border: 1px solid #e9ecef;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .status-label {
          font-weight: 500;
          color: #495057;
        }

        .progress-bar {
          width: 40px;
          height: 4px;
          background-color: #e9ecef;
          border-radius: 2px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        /* 状态颜色 */
        .status-pending { 
          background-color: #6c757d; 
        }
        .status-indexing { 
          background-color: #fd7e14; 
          animation: pulse 1.5s infinite;
        }
        .status-completed { 
          background-color: #198754; 
        }
        .status-error { 
          background-color: #dc3545; 
        }
        .status-partial { 
          background-color: #6f42c1; 
        }

        /* 进度条颜色 */
        .progress-pending { background-color: #6c757d; }
        .progress-indexing { background-color: #fd7e14; }
        .progress-completed { background-color: #198754; }
        .progress-error { background-color: #dc3545; }
        .progress-partial { background-color: #6f42c1; }

        /* 脉冲动画 */
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .status-container {
            flex-direction: column;
            gap: 8px;
            align-items: stretch;
          }
          
          .status-item {
            justify-content: space-between;
          }
        }
      </style>
      
      <div class="status-container">
        <div class="status-item">
          <span class="status-dot status-${this.vectorStatus}"></span>
          <span class="status-label">向量</span>
          <div class="progress-bar">
            <div class="progress-fill progress-${this.vectorStatus}" 
                 style="width: ${this.vectorProgress}%"></div>
          </div>
          <span class="progress-text">${Math.round(this.vectorProgress)}%</span>
        </div>
        
        <div class="status-item">
          <span class="status-dot status-${this.graphStatus}"></span>
          <span class="status-label">图</span>
          <div class="progress-bar">
            <div class="progress-fill progress-${this.graphStatus}"
                 style="width: ${this.graphProgress}%"></div>
          </div>
          <span class="progress-text">${Math.round(this.graphProgress)}%</span>
        </div>
      </div>
    `;
  }

  /**
   * 设置向量状态
   */
  setVectorStatus(status: string, progress: number = 0) {
    this.vectorStatus = status;
    this.vectorProgress = Math.min(100, Math.max(0, progress));
    this.setAttribute('vector-status', status);
    this.setAttribute('vector-progress', this.vectorProgress.toString());
  }

  /**
   * 设置图状态
   */
  setGraphStatus(status: string, progress: number = 0) {
    this.graphStatus = status;
    this.graphProgress = Math.min(100, Math.max(0, progress));
    this.setAttribute('graph-status', status);
    this.setAttribute('graph-progress', this.graphProgress.toString());
  }

  /**
   * 批量更新状态
   */
  updateStatus(vectorStatus?: { status: string; progress?: number },
                     graphStatus?: { status: string; progress?: number }) {
    if (vectorStatus) {
      this.setVectorStatus(vectorStatus.status, vectorStatus.progress || 0);
    }
    if (graphStatus) {
      this.setGraphStatus(graphStatus.status, graphStatus.progress || 0);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      vector: {
        status: this.vectorStatus,
        progress: this.vectorProgress
      },
      graph: {
        status: this.graphStatus,
        progress: this.graphProgress
      }
    };
  }
}

// 注册自定义元素
customElements.define('storage-status-indicator', StorageStatusIndicator);