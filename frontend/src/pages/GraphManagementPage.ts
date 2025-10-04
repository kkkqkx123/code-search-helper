import { GraphApiClient } from '../services/graphApi.js';

/**
 * 图管理页面
 * 提供图数据的管理功能
 */
export class GraphManagementPage {
  private container: HTMLElement;
  private graphApi: GraphApiClient;
  private currentProjectId: string = '';
  
  constructor(container: HTMLElement, projectId?: string) {
    this.container = container;
    this.graphApi = new GraphApiClient();
    this.currentProjectId = projectId || '';
    this.render();
    this.setupEventListeners();
  }
  
  /**
   * 渲染图管理页面
   */
  private render() {
    this.container.innerHTML = `
      <div class="graph-management">
        <!-- 顶部导航栏 -->
        <div class="top-navbar">
          <h1>图管理</h1>
        </div>
        
        <!-- 主要布局容器 -->
        <div class="main-container">
          <!-- 空间管理工具 -->
          <div class="management-tools">
            <div class="tool-section">
              <h3>空间管理</h3>
              <div class="form-group">
                <label for="project-id">项目ID:</label>
                <input type="text" id="project-id" class="form-control" placeholder="输入项目ID" value="${this.currentProjectId}">
              </div>
              <div class="button-group">
                <button id="create-space" class="search-button">创建空间</button>
                <button id="delete-space" class="search-button" style="background-color: #ef4444;">删除空间</button>
                <button id="clear-space" class="search-button" style="background-color: #f59e0b;">清空空间</button>
                <button id="get-space-info" class="search-button" style="background-color: #64748b;">空间信息</button>
              </div>
            </div>
            
            <!-- 数据导入/导出 -->
            <div class="tool-section">
              <h3>数据导入/导出</h3>
              <div class="form-group">
                <label for="import-file">导入文件:</label>
                <input type="file" id="import-file" class="form-control" accept=".json,.csv,.graphml">
              </div>
              <div class="form-group">
                <label for="export-format">导出格式:</label>
                <select id="export-format" class="form-control">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="graphml">GraphML</option>
                </select>
              </div>
              <div class="button-group">
                <button id="import-data" class="search-button">导入数据</button>
                <button id="export-data" class="search-button" style="background-color: #64748b;">导出数据</button>
              </div>
            </div>
            
            <!-- 批量操作面板 -->
            <div class="tool-section">
              <h3>批量操作</h3>
              <div class="form-group">
                <label for="batch-operation">操作类型:</label>
                <select id="batch-operation" class="form-control">
                  <option value="delete-nodes">删除节点</option>
                  <option value="update-properties">更新属性</option>
                  <option value="add-relationships">添加关系</option>
                </select>
              </div>
              <div class="form-group">
                <label for="batch-conditions">条件:</label>
                <textarea id="batch-conditions" class="form-control" rows="3" placeholder="输入操作条件，例如: type='file' AND path CONTAINS 'test/'"></textarea>
              </div>
              <button id="execute-batch" class="search-button">执行批量操作</button>
            </div>
          </div>
          
          <!-- 操作结果展示 -->
          <div class="operation-results">
            <div id="result-container" class="result-container">
              <div class="no-result">执行操作后显示结果</div>
            </div>
          </div>
        </div>
        
        <!-- 底部状态栏 -->
        <div class="bottom-status">
          <div id="status-message">准备就绪</div>
        </div>
      </div>
    `;
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 空间管理按钮
    const createSpaceButton = this.container.querySelector('#create-space') as HTMLButtonElement;
    const deleteSpaceButton = this.container.querySelector('#delete-space') as HTMLButtonElement;
    const clearSpaceButton = this.container.querySelector('#clear-space') as HTMLButtonElement;
    const getSpaceInfoButton = this.container.querySelector('#get-space-info') as HTMLButtonElement;
    
    createSpaceButton?.addEventListener('click', async () => {
      const projectId = (this.container.querySelector('#project-id') as HTMLInputElement)?.value.trim();
      if (!projectId) {
        this.updateStatus('请输入项目ID');
        return;
      }
      await this.manageSpace(projectId, 'create');
    });
    
    deleteSpaceButton?.addEventListener('click', async () => {
      const projectId = (this.container.querySelector('#project-id') as HTMLInputElement)?.value.trim();
      if (!projectId) {
        this.updateStatus('请输入项目ID');
        return;
      }
      if (confirm(`确定要删除项目 ${projectId} 的空间吗？此操作不可撤销！`)) {
        await this.manageSpace(projectId, 'delete');
      }
    });
    
    clearSpaceButton?.addEventListener('click', async () => {
      const projectId = (this.container.querySelector('#project-id') as HTMLInputElement)?.value.trim();
      if (!projectId) {
        this.updateStatus('请输入项目ID');
        return;
      }
      if (confirm(`确定要清空项目 ${projectId} 的空间吗？此操作将删除所有图数据！`)) {
        await this.manageSpace(projectId, 'clear');
      }
    });
    
    getSpaceInfoButton?.addEventListener('click', async () => {
      const projectId = (this.container.querySelector('#project-id') as HTMLInputElement)?.value.trim();
      if (!projectId) {
        this.updateStatus('请输入项目ID');
        return;
      }
      await this.getSpaceInfo(projectId);
    });
    
    // 数据导入/导出按钮
    const importDataButton = this.container.querySelector('#import-data') as HTMLButtonElement;
    const exportDataButton = this.container.querySelector('#export-data') as HTMLButtonElement;
    const importFileInput = this.container.querySelector('#import-file') as HTMLInputElement;
    
    importDataButton?.addEventListener('click', () => {
      importFileInput?.click();
    });
    
    importFileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement)?.files?.[0];
      if (file) {
        await this.importData(file);
      }
    });
    
    exportDataButton?.addEventListener('click', async () => {
      const format = (this.container.querySelector('#export-format') as HTMLSelectElement)?.value;
      await this.exportData(format);
    });
    
    // 批量操作按钮
    const executeBatchButton = this.container.querySelector('#execute-batch') as HTMLButtonElement;
    
    executeBatchButton?.addEventListener('click', async () => {
      const operation = (this.container.querySelector('#batch-operation') as HTMLSelectElement)?.value;
      const conditions = (this.container.querySelector('#batch-conditions') as HTMLTextAreaElement)?.value.trim();
      
      if (!conditions) {
        this.updateStatus('请输入操作条件');
        return;
      }
      
      await this.executeBatchOperation(operation, conditions);
    });
  }
  
  /**
   * 管理项目空间
   */
  private async manageSpace(projectId: string, operation: 'create' | 'delete' | 'clear') {
    this.updateStatus(`正在${operation === 'create' ? '创建' : operation === 'delete' ? '删除' : '清空'}空间...`);
    
    try {
      const result = await this.graphApi.manageSpace(projectId, operation);
      
      if (result.success) {
        this.displayResult({
          operation: `项目空间${operation === 'create' ? '创建' : operation === 'delete' ? '删除' : '清空'}`,
          status: 'success',
          message: `项目空间 ${operation} 操作成功`,
          projectId: projectId,
          executionTime: result.data.executionTime
        });
        
        this.updateStatus(`项目空间 ${operation} 操作成功`);
      } else {
        this.displayResult({
          operation: `项目空间${operation === 'create' ? '创建' : operation === 'delete' ? '删除' : '清空'}`,
          status: 'error',
          message: result.message || '操作失败',
          projectId: projectId
        });
        
        this.updateStatus(`操作失败: ${result.message || '未知错误'}`);
      }
    } catch (error: any) {
      this.displayResult({
        operation: `项目空间${operation === 'create' ? '创建' : operation === 'delete' ? '删除' : '清空'}`,
        status: 'error',
        message: error.message,
        projectId: projectId
      });
      
      this.updateStatus(`操作异常: ${error.message}`);
    }
  }
  
  /**
   * 获取空间信息
   */
  private async getSpaceInfo(projectId: string) {
    this.updateStatus('正在获取空间信息...');
    
    try {
      const result = await this.graphApi.manageSpace(projectId, 'info');
      
      if (result.success) {
        this.displayResult({
          operation: '获取空间信息',
          status: 'success',
          message: '获取空间信息成功',
          projectId: projectId,
          data: result.data.result,
          executionTime: result.data.executionTime
        });
        
        this.updateStatus('获取空间信息成功');
      } else {
        this.displayResult({
          operation: '获取空间信息',
          status: 'error',
          message: result.message || '获取信息失败',
          projectId: projectId
        });
        
        this.updateStatus(`获取信息失败: ${result.message || '未知错误'}`);
      }
    } catch (error: any) {
      this.displayResult({
        operation: '获取空间信息',
        status: 'error',
        message: error.message,
        projectId: projectId
      });
      
      this.updateStatus(`获取信息异常: ${error.message}`);
    }
  }
  
  /**
   * 导入数据
   */
  private async importData(file: File) {
    this.updateStatus(`正在导入 ${file.name} ...`);
    
    try {
      // 这里应该实现实际的数据导入逻辑
      // 目前只是模拟导入过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.displayResult({
        operation: '数据导入',
        status: 'success',
        message: `文件 ${file.name} 导入成功`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
      this.updateStatus(`文件 ${file.name} 导入成功`);
    } catch (error: any) {
      this.displayResult({
        operation: '数据导入',
        status: 'error',
        message: error.message,
        fileName: file.name
      });
      
      this.updateStatus(`导入失败: ${error.message}`);
    }
  }
  
  /**
   * 导出数据
   */
  private async exportData(format: string) {
    this.updateStatus(`正在导出数据为 ${format} 格式...`);
    
    try {
      // 这里应该实现实际的数据导出逻辑
      // 目前只是模拟导出过程
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 创建一个模拟的下载
      const blob = new Blob([JSON.stringify({ format, timestamp: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graph-data-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.displayResult({
        operation: '数据导出',
        status: 'success',
        message: `数据已导出为 ${format} 格式`,
        format: format,
        timestamp: new Date().toISOString()
      });
      
      this.updateStatus(`数据已导出为 ${format} 格式`);
    } catch (error: any) {
      this.displayResult({
        operation: '数据导出',
        status: 'error',
        message: error.message,
        format: format
      });
      
      this.updateStatus(`导出失败: ${error.message}`);
    }
  }
  
  /**
   * 执行批量操作
   */
  private async executeBatchOperation(operation: string, conditions: string) {
    this.updateStatus(`正在执行批量${operation}操作...`);
    
    try {
      // 这里应该实现实际的批量操作逻辑
      // 目前只是模拟操作过程
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      this.displayResult({
        operation: `批量${operation}`,
        status: 'success',
        message: `批量${operation}操作执行成功`,
        conditions: conditions,
        affectedCount: Math.floor(Math.random() * 100),
        executionTime: 2500
      });
      
      this.updateStatus(`批量${operation}操作执行成功`);
    } catch (error: any) {
      this.displayResult({
        operation: `批量${operation}`,
        status: 'error',
        message: error.message,
        conditions: conditions
      });
      
      this.updateStatus(`批量操作异常: ${error.message}`);
    }
  }
  
  /**
   * 显示操作结果
   */
  private displayResult(result: any) {
    const resultContainer = this.container.querySelector('#result-container') as HTMLElement;
    if (!resultContainer) return;
    
    const statusClass = result.status === 'success' ? 'success' : 'error';
    const statusText = result.status === 'success' ? '成功' : '失败';
    
    resultContainer.innerHTML = `
      <div class="result-item ${statusClass}">
        <div class="result-header">
          <span class="result-operation">${result.operation}</span>
          <span class="result-status">${statusText}</span>
        </div>
        <div class="result-message">${result.message}</div>
        ${result.projectId ? `<div class="result-detail"><strong>项目ID:</strong> ${result.projectId}</div>` : ''}
        ${result.fileName ? `<div class="result-detail"><strong>文件名:</strong> ${result.fileName}</div>` : ''}
        ${result.fileSize ? `<div class="result-detail"><strong>文件大小:</strong> ${result.fileSize} bytes</div>` : ''}
        ${result.format ? `<div class="result-detail"><strong>格式:</strong> ${result.format}</div>` : ''}
        ${result.conditions ? `<div class="result-detail"><strong>条件:</strong> ${result.conditions}</div>` : ''}
        ${result.affectedCount !== undefined ? `<div class="result-detail"><strong>影响数量:</strong> ${result.affectedCount}</div>` : ''}
        ${result.executionTime ? `<div class="result-detail"><strong>执行时间:</strong> ${result.executionTime}ms</div>` : ''}
        ${result.data ? `<div class="result-detail"><strong>数据:</strong> <pre>${JSON.stringify(result.data, null, 2)}</pre></div>` : ''}
        <div class="result-timestamp">${new Date().toLocaleString()}</div>
      </div>
    `;
  }
  
  /**
   * 更新状态消息
   */
  private updateStatus(message: string) {
    const statusElement = this.container.querySelector('#status-message') as HTMLElement;
    if (statusElement) {
      statusElement.textContent = message;
    }
  }
  
  /**
   * 显示页面
   */
  show() {
    this.container.style.display = 'block';
    
    // 如果有项目ID，自动填充
    if (this.currentProjectId) {
      const projectIdInput = this.container.querySelector('#project-id') as HTMLInputElement;
      if (projectIdInput) {
        projectIdInput.value = this.currentProjectId;
      }
    }
  }
  
  /**
   * 隐藏页面
   */
  hide() {
    this.container.style.display = 'none';
  }
  
  /**
   * 销毁页面
   */
  destroy() {
    // 清理所有事件监听器
    const buttons = this.container.querySelectorAll('button');
    buttons.forEach(button => {
      button.removeEventListener('click', () => {});
    });
    
    const fileInput = this.container.querySelector('#import-file') as HTMLInputElement;
    fileInput?.removeEventListener('change', () => {});
  }
}