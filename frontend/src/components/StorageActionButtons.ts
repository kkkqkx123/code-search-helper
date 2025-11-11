/**
 * 存储操作按钮组件
 * 用于分别执行向量嵌入和图存储操作
 */
export class StorageActionButtons extends HTMLElement {
  shadowRoot: ShadowRoot;
  private projectId: string = '';
  private vectorStatus: string = 'pending';
  private graphStatus: string = 'pending';

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['project-id', 'vector-status', 'graph-status'];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      switch (name) {
        case 'project-id':
          this.projectId = newValue;
          break;
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
    this.shadowRoot.innerHTML = `
      <style>
        .action-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 6px 12px;
          border: 1px solid #dee2e6;
          border-radius: 6px;
          background: white;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .action-button:hover:not(:disabled) {
          background: #f8f9fa;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0.1);
        }

        .action-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .action-button.vector {
          border-color: #0d6efd;
          color: #0d6efd;
        }

        .action-button.vector:hover:not(:disabled) {
          background: #0d6efd;
          color: white;
        }

        .action-button.graph {
          border-color: #6f42c1;
          color: #6f42c1;
        }

        .action-button.graph:hover:not(:disabled) {
          background: #6f42c1;
          color: white;
        }

        .action-button.indexing {
          animation: pulse 1.5s infinite;
          position: relative;
        }

        .action-button.indexing .button-text {
          opacity: 0.3;
        }

        .button-text {
          white-space: nowrap;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }

        /* 响应式设计 */
        @media (max-width: 768px) {
          .action-buttons {
            flex-direction: column;
          }
          
          .action-button {
            width: 100%;
            justify-content: center;
          }
        }
      </style>
      
      <div class="action-buttons">
        <button class="action-button vector" 
                data-action="index-vectors"
                ${this.vectorStatus === 'indexing' ? 'disabled' : ''}>
          <span class="button-text">
            ${this.vectorStatus === 'indexing' ? '向量索引中...' : '向量嵌入'}
          </span>
        </button>
        
        <!-- 图索引功能已移除 - 图索引现在依赖于向量索引 -->
      </div>
    `;
  }

  private setupEventListeners() {
    this.shadowRoot.querySelectorAll('.action-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target as HTMLElement;
        const action = target.dataset.action ||
                      (target.closest('.action-button') as HTMLElement)?.dataset?.action;
        if (action) {
          this.dispatchEvent(new CustomEvent('storage-action', {
            detail: { 
              projectId: this.projectId, 
              action 
            },
            bubbles: true,
            composed: true
          }));
        }
      });
    });
  }

  /**
   * 设置项目ID
   */
  setProjectId(id: string) {
    this.projectId = id;
    this.setAttribute('project-id', id);
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
  updateStatus(vectorStatus?: string, graphStatus?: string) {
    if (vectorStatus !== undefined) {
      this.setVectorStatus(vectorStatus);
    }
    if (graphStatus !== undefined) {
      this.setGraphStatus(graphStatus);
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      vector: this.vectorStatus,
      graph: this.graphStatus
    };
  }
}
