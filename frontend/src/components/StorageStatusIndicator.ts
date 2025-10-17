
/**
 * 存储状态指示器组件
 * 用于显示向量存储和图存储的状态
 */
export class StorageStatusIndicator extends HTMLElement {
  private vectorStatus: string = 'pending';
  private graphStatus: string = 'pending';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['vector-status', 'graph-status'];
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

        .status-text {
          font-size: 11px;
          color: #6c757d;
          min-width: 60px;
          text-align: right;
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
        .status-disabled { 
          background-color: #adb5bd; 
        }

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
          <span class="status-text">${this.getStatusText(this.vectorStatus)}</span>
        </div>
        
        <div class="status-item">
          <span class="status-dot status-${this.graphStatus}"></span>
          <span class="status-label">图</span>
          <span class="status-text">${this.getStatusText(this.graphStatus)}</span>
        </div>
      </div>
    `;
  }

  /**
   * 设置向量状态
   */
  setVectorStatus(status: string) {
    this.vectorStatus = status;
    this.setAttribute('vector-status', status);
  }

  /**
   * 设置图状态
   */
  setGraphStatus(status: string) {
    this.graphStatus = status;
    this.setAttribute('graph-status', status);
  }

  /**
   * 批量更新状态
   */
  updateStatus(vectorStatus?: { status: string }, graphStatus?: { status: string }) {
    if (vectorStatus) {
      this.setVectorStatus(vectorStatus.status);
    }
    if (graphStatus) {
      this.setGraphStatus(graphStatus.status);
    }
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return '待处理';
      case 'indexing':
        return '索引中';
      case 'completed':
        return '已完成';
      case 'error':
        return '错误';
      case 'partial':
        return '部分完成';
      case 'disabled':
        return '已禁用';
      default:
        return '未知';
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      vector: {
        status: this.vectorStatus
      },
      graph: {
        status: this.graphStatus
      }
    };
  }
}
