/**
 * 图搜索面板组件
 * 提供图数据的搜索和过滤功能
 */
export class GraphSearchPanel {
  private container: HTMLElement;
  private onSearchSubmit?: (searchTerm: string, options: any) => void;
  private searchHistory: string[] = [];
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
    this.setupEventListeners();
  }
  
  /**
   * 渲染搜索面板
   */
  private render() {
    this.container.innerHTML = `
      <div class="search-panel">
        <div class="search-header">
          <h3>图搜索</h3>
        </div>
        
        <div class="search-form">
          <div class="form-group">
            <label for="search-term">搜索关键词:</label>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="search-term" class="form-control" placeholder="输入节点标签或属性值" style="flex: 1;">
              <button id="search-button" class="search-button" style="white-space: nowrap;">搜索</button>
            </div>
          </div>
          
          <div class="form-group">
            <label for="node-type-filter">节点类型:</label>
            <select id="node-type-filter" class="form-control" multiple style="height: 80px;">
              <option value="file">文件</option>
              <option value="function">函数</option>
              <option value="class">类</option>
              <option value="import">导入</option>
              <option value="variable">变量</option>
              <option value="module">模块</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="relationship-filter">关系类型:</label>
            <select id="relationship-filter" class="form-control" multiple style="height: 80px;">
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
          
          <div class="form-group">
            <label for="max-results">最大结果数:</label>
            <input type="number" id="max-results" class="form-control" value="50" min="1" max="1000" style="width: 100px;">
          </div>
        </div>
        
        <div class="search-history">
          <h4>搜索历史</h4>
          <div id="history-list" class="history-list">
            <div class="no-history">暂无搜索历史</div>
          </div>
        </div>
      </div>
    `;
    
    // 加载搜索历史
    this.loadSearchHistory();
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    const searchButton = this.container.querySelector('#search-button') as HTMLButtonElement;
    const searchTermInput = this.container.querySelector('#search-term') as HTMLInputElement;
    
    searchButton?.addEventListener('click', () => {
      this.submitSearch();
    });
    
    searchTermInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.submitSearch();
      }
    });
  }
  
  /**
   * 提交搜索
   */
  private submitSearch() {
    const searchTerm = (this.container.querySelector('#search-term') as HTMLInputElement)?.value.trim();
    if (!searchTerm) {
      alert('请输入搜索关键词');
      return;
    }
    
    // 收集搜索选项
    const options = {
      nodeTypes: Array.from((this.container.querySelector('#node-type-filter') as HTMLSelectElement)?.selectedOptions || []).map(option => option.value),
      relationshipTypes: Array.from((this.container.querySelector('#relationship-filter') as HTMLSelectElement)?.selectedOptions || []).map(option => option.value),
      maxResults: parseInt((this.container.querySelector('#max-results') as HTMLInputElement)?.value || '50')
    };
    
    // 添加到搜索历史
    this.addToSearchHistory(searchTerm);
    
    // 触发搜索回调
    if (this.onSearchSubmit) {
      this.onSearchSubmit(searchTerm, options);
    }
  }
  
  /**
   * 添加到搜索历史
   */
  private addToSearchHistory(term: string) {
    // 移除已存在的相同项
    this.searchHistory = this.searchHistory.filter(item => item !== term);
    // 添加到开头
    this.searchHistory.unshift(term);
    // 限制历史记录数量
    if (this.searchHistory.length > 10) {
      this.searchHistory = this.searchHistory.slice(0, 10);
    }
    
    // 保存到localStorage
    try {
      localStorage.setItem('graphSearchHistory', JSON.stringify(this.searchHistory));
    } catch (error) {
      console.warn('无法保存搜索历史:', error);
    }
    
    // 更新UI
    this.updateSearchHistory();
  }
  
  /**
   * 加载搜索历史
   */
  private loadSearchHistory() {
    try {
      const savedHistory = localStorage.getItem('graphSearchHistory');
      if (savedHistory) {
        this.searchHistory = JSON.parse(savedHistory);
        this.updateSearchHistory();
      }
    } catch (error) {
      console.warn('无法加载搜索历史:', error);
    }
  }
  
  /**
   * 更新搜索历史UI
   */
  private updateSearchHistory() {
    const historyList = this.container.querySelector('#history-list') as HTMLElement;
    if (!historyList) return;
    
    if (this.searchHistory.length === 0) {
      historyList.innerHTML = '<div class="no-history">暂无搜索历史</div>';
      return;
    }
    
    historyList.innerHTML = this.searchHistory.map(term => `
      <div class="history-item">
        <span class="history-term">${term}</span>
        <button class="history-action" data-term="${term}">搜索</button>
        <button class="history-action delete" data-term="${term}">×</button>
      </div>
    `).join('');
    
    // 为历史项目添加事件监听器
    historyList.querySelectorAll('.history-action').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target as HTMLButtonElement;
        const term = target.dataset.term;
        if (term) {
          if (target.classList.contains('delete')) {
            // 删除历史记录
            this.searchHistory = this.searchHistory.filter(item => item !== term);
            try {
              localStorage.setItem('graphSearchHistory', JSON.stringify(this.searchHistory));
            } catch (error) {
              console.warn('无法保存搜索历史:', error);
            }
            this.updateSearchHistory();
          } else {
            // 执行搜索
            const searchTermInput = this.container.querySelector('#search-term') as HTMLInputElement;
            if (searchTermInput) {
              searchTermInput.value = term;
            }
            this.submitSearch();
          }
        }
      });
    });
  }
  
  /**
   * 设置搜索提交回调
   */
  setOnSearchSubmit(callback: (searchTerm: string, options: any) => void) {
    this.onSearchSubmit = callback;
  }
  
  /**
   * 清空搜索历史
   */
  clearSearchHistory() {
    this.searchHistory = [];
    try {
      localStorage.removeItem('graphSearchHistory');
    } catch (error) {
      console.warn('无法清除搜索历史:', error);
    }
    this.updateSearchHistory();
  }
  
  /**
   * 销毁组件
   */
  destroy() {
    const searchButton = this.container.querySelector('#search-button') as HTMLButtonElement;
    const searchTermInput = this.container.querySelector('#search-term') as HTMLInputElement;
    
    searchButton?.removeEventListener('click', () => {});
    searchTermInput?.removeEventListener('keypress', () => {});
    
    // 清理历史项目的事件监听器
    const historyItems = this.container.querySelectorAll('.history-action');
    historyItems.forEach(item => {
      item.removeEventListener('click', () => {});
    });
  }
}