/**
 * 查询构建器组件
 * 提供图形化界面来构建复杂的图查询
 */
export class GraphQueryBuilder {
  private container: HTMLElement;
  private onQuerySubmit?: (query: any) => void;
  private queryType: string = 'related';
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.setupEventListeners();
  }
  
  /**
   * 渲染查询构建器
   */
  private render() {
    this.container.innerHTML = `
      <div class="query-builder">
        <div class="query-type-selector">
          <label for="query-type">查询类型:</label>
          <select id="query-type" class="query-type-select">
            <option value="related">相关节点</option>
            <option value="path">路径搜索</option>
            <option value="traversal">图遍历</option>
            <option value="custom">自定义查询</option>
          </select>
        </div>
        
        <div id="query-parameters" class="query-parameters">
          <!-- 动态填充查询参数 -->
        </div>
        
        <div class="query-actions">
          <button id="submit-query" class="search-button">执行查询</button>
          <button id="clear-query" class="search-button" style="background-color: #64748b;">清空</button>
        </div>
      </div>
    `;
    
    // 初始化默认参数表单
    this.renderQueryParameters();
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    const queryTypeSelect = this.container.querySelector('#query-type') as HTMLSelectElement;
    const submitButton = this.container.querySelector('#submit-query') as HTMLButtonElement;
    const clearButton = this.container.querySelector('#clear-query') as HTMLButtonElement;
    
    queryTypeSelect?.addEventListener('change', (e) => {
      this.queryType = (e.target as HTMLSelectElement).value;
      this.renderQueryParameters();
    });
    
    submitButton?.addEventListener('click', () => {
      this.submitQuery();
    });
    
    clearButton?.addEventListener('click', () => {
      this.clearQuery();
    });
  }
  
  /**
   * 渲染查询参数表单
   */
  private renderQueryParameters() {
    const paramsContainer = this.container.querySelector('#query-parameters') as HTMLElement;
    if (!paramsContainer) return;
    
    let paramsHtml = '';
    
    switch (this.queryType) {
      case 'related':
        paramsHtml = `
          <div class="form-group">
            <label for="node-id">节点ID:</label>
            <input type="text" id="node-id" class="form-control" placeholder="输入节点ID" required>
          </div>
          <div class="form-group">
            <label for="max-depth">最大深度:</label>
            <input type="number" id="max-depth" class="form-control" value="3" min="1" max="10">
          </div>
          <div class="form-group">
            <label for="direction">方向:</label>
            <select id="direction" class="form-control">
              <option value="both">双向</option>
              <option value="in">入边</option>
              <option value="out">出边</option>
            </select>
          </div>
          <div class="form-group">
            <label for="relationship-types">关系类型:</label>
            <select id="relationship-types" class="form-control" multiple>
              <option value="BELONGS_TO">BELONGS_TO</option>
              <option value="CONTAINS">CONTAINS</option>
              <option value="IMPORTS">IMPORTS</option>
              <option value="CALLS">CALLS</option>
              <option value="EXTENDS">EXTENDS</option>
              <option value="IMPLEMENTS">IMPLEMENTS</option>
              <option value="REFERENCES">REFERENCES</option>
              <option value="MODIFIES">MODIFIES</option>
              <option value="USES">USES</option>
            </select>
          </div>
        `;
        break;
        
      case 'path':
        paramsHtml = `
          <div class="form-group">
            <label for="source-node">源节点ID:</label>
            <input type="text" id="source-node" class="form-control" placeholder="输入源节点ID" required>
          </div>
          <div class="form-group">
            <label for="target-node">目标节点ID:</label>
            <input type="text" id="target-node" class="form-control" placeholder="输入目标节点ID" required>
          </div>
          <div class="form-group">
            <label for="max-path-depth">最大路径深度:</label>
            <input type="number" id="max-path-depth" class="form-control" value="5" min="1" max="20">
          </div>
          <div class="form-group">
            <label for="path-direction">方向:</label>
            <select id="path-direction" class="form-control">
              <option value="both">双向</option>
              <option value="in">入边</option>
              <option value="out">出边</option>
            </select>
          </div>
        `;
        break;
        
      case 'traversal':
        paramsHtml = `
          <div class="form-group">
            <label for="start-node">起始节点ID:</label>
            <input type="text" id="start-node" class="form-control" placeholder="输入起始节点ID" required>
          </div>
          <div class="form-group">
            <label for="traversal-depth">遍历深度:</label>
            <input type="number" id="traversal-depth" class="form-control" value="3" min="1" max="10">
          </div>
          <div class="form-group">
            <label for="traversal-direction">方向:</label>
            <select id="traversal-direction" class="form-control">
              <option value="both">双向</option>
              <option value="in">入边</option>
              <option value="out">出边</option>
            </select>
          </div>
        `;
        break;
        
      case 'custom':
        paramsHtml = `
          <div class="form-group">
            <label for="custom-query">自定义查询语句:</label>
            <textarea id="custom-query" class="form-control" rows="6" placeholder="输入nGQL查询语句" required></textarea>
          </div>
          <div class="form-group">
            <label for="project-id">项目ID:</label>
            <input type="text" id="project-id" class="form-control" placeholder="输入项目ID">
          </div>
        `;
        break;
    }
    
    paramsContainer.innerHTML = paramsHtml;
  }
  
  /**
   * 提交查询
   */
  private submitQuery() {
    const queryData = this.buildQuery();
    if (queryData) {
      if (this.onQuerySubmit) {
        this.onQuerySubmit(queryData);
      }
    }
  }
  
  /**
   * 构建查询对象
   */
  private buildQuery(): any {
    switch (this.queryType) {
      case 'related':
        const nodeId = (this.container.querySelector('#node-id') as HTMLInputElement)?.value;
        if (!nodeId) {
          alert('请输入节点ID');
          return null;
        }
        
        return {
          type: 'RELATED_NODES',
          parameters: {
            nodeId,
            maxDepth: parseInt((this.container.querySelector('#max-depth') as HTMLInputElement)?.value || '3'),
            direction: (this.container.querySelector('#direction') as HTMLSelectElement)?.value,
            relationshipTypes: Array.from((this.container.querySelector('#relationship-types') as HTMLSelectElement)?.selectedOptions || []).map(option => option.value)
          }
        };
        
      case 'path':
        const sourceNode = (this.container.querySelector('#source-node') as HTMLInputElement)?.value;
        const targetNode = (this.container.querySelector('#target-node') as HTMLInputElement)?.value;
        if (!sourceNode || !targetNode) {
          alert('请输入源节点和目标节点ID');
          return null;
        }
        
        return {
          type: 'PATH',
          parameters: {
            sourceId: sourceNode,
            targetId: targetNode,
            maxDepth: parseInt((this.container.querySelector('#max-path-depth') as HTMLInputElement)?.value || '5'),
            direction: (this.container.querySelector('#path-direction') as HTMLSelectElement)?.value
          }
        };
        
      case 'traversal':
        const startNode = (this.container.querySelector('#start-node') as HTMLInputElement)?.value;
        if (!startNode) {
          alert('请输入起始节点ID');
          return null;
        }
        
        return {
          type: 'TRAVERSAL',
          parameters: {
            startNodeId: startNode,
            maxDepth: parseInt((this.container.querySelector('#traversal-depth') as HTMLInputElement)?.value || '3'),
            direction: (this.container.querySelector('#traversal-direction') as HTMLSelectElement)?.value
          }
        };
        
      case 'custom':
        const customQuery = (this.container.querySelector('#custom-query') as HTMLTextAreaElement)?.value;
        if (!customQuery) {
          alert('请输入自定义查询语句');
          return null;
        }
        
        return {
          type: 'CUSTOM',
          parameters: {
            query: customQuery,
            projectId: (this.container.querySelector('#project-id') as HTMLInputElement)?.value
          }
        };
        
      default:
        return null;
    }
  }
  
  /**
   * 清空查询
   */
  private clearQuery() {
    const formGroups = this.container.querySelectorAll('.form-group');
    formGroups.forEach(group => {
      const input = group.querySelector('input, textarea, select');
      if (input) {
        if (input.tagName === 'SELECT' && (input as HTMLSelectElement).multiple) {
          Array.from((input as HTMLSelectElement).options).forEach(option => {
            option.selected = false;
          });
        } else {
          (input as HTMLInputElement | HTMLTextAreaElement).value = '';
        }
      }
    });
  }
  
  /**
   * 设置查询提交回调
   */
  setOnQuerySubmit(callback: (query: any) => void) {
    this.onQuerySubmit = callback;
  }
  
  /**
   * 获取当前查询类型
   */
  getQueryType(): string {
    return this.queryType;
  }
  
  /**
   * 销毁组件
   */
  destroy() {
    // 清理事件监听器
    const queryTypeSelect = this.container.querySelector('#query-type') as HTMLSelectElement;
    const submitButton = this.container.querySelector('#submit-query') as HTMLButtonElement;
    const clearButton = this.container.querySelector('#clear-query') as HTMLButtonElement;
    
    queryTypeSelect?.removeEventListener('change', () => {});
    submitButton?.removeEventListener('click', () => {});
    clearButton?.removeEventListener('click', () => {});
  }
}