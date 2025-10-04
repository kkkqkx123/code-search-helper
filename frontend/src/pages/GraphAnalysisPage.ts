import { GraphApiClient } from '../services/graphApi.js';
import { GraphVisualizer } from '../components/graph/GraphVisualizer.js';

/**
 * 图分析页面
 * 提供图数据分析和可视化功能
 */
export class GraphAnalysisPage {
  private container: HTMLElement;
  private visualizer: GraphVisualizer | null = null;
  private graphApi: GraphApiClient;
  private currentProjectId: string = '';
  
  constructor(container: HTMLElement, projectId?: string) {
    this.container = container;
    this.graphApi = new GraphApiClient();
    this.currentProjectId = projectId || '';
    this.render();
    this.initializeComponents();
  }
  
  /**
   * 渲染图分析页面
   */
  private render() {
    this.container.innerHTML = `
      <div class="graph-analysis">
        <!-- 顶部导航栏 -->
        <div class="top-navbar">
          <h1>图分析</h1>
        </div>
        
        <!-- 主要布局容器 -->
        <div class="main-container">
          <!-- 分析工具面板 -->
          <div class="analysis-tools">
            <div class="tool-section">
              <h3>依赖分析</h3>
              <div class="form-group">
                <label for="file-path">文件路径:</label>
                <input type="text" id="file-path" class="form-control" placeholder="src/main.ts">
              </div>
              <div class="form-group">
                <label for="dependency-options">选项:</label>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                  <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" id="include-transitive" checked>
                    包含传递依赖
                  </label>
                  <label style="display: flex; align-items: center; gap: 5px;">
                    <input type="checkbox" id="include-circular" checked>
                    检测循环依赖
                  </label>
                </div>
              </div>
              <button id="analyze-dependencies" class="search-button">分析依赖</button>
            </div>
            
            <div class="tool-section">
              <h3>影响分析</h3>
              <div class="form-group">
                <label for="function-name">函数名称:</label>
                <input type="text" id="function-name" class="form-control" placeholder="calculateTotal">
              </div>
              <div class="form-group">
                <label for="impact-depth">分析深度:</label>
                <input type="number" id="impact-depth" class="form-control" value="3" min="1" max="10">
              </div>
              <button id="analyze-impact" class="search-button">分析影响</button>
            </div>
            
            <div class="tool-section">
              <h3>统计指标</h3>
              <div id="metrics-container" class="metrics-container">
                <div class="no-metrics">执行分析后显示指标</div>
              </div>
            </div>
          </div>
          
          <!-- 分析结果可视化 -->
          <div class="analysis-results">
            <div id="analysis-visualization" class="analysis-visualization"></div>
          </div>
        </div>
        
        <!-- 底部控制台 -->
        <div class="bottom-console">
          <div id="console-messages">等待分析...</div>
        </div>
      </div>
    `;
  }
  
  /**
   * 初始化组件
   */
  private initializeComponents() {
    // 创建图可视化组件
    const visualizationContainer = this.container.querySelector('#analysis-visualization') as HTMLElement;
    if (visualizationContainer) {
      this.visualizer = new GraphVisualizer(visualizationContainer);
    }
    
    // 设置分析按钮事件
    this.setupAnalysisControls();
  }
  
  /**
   * 设置分析控制
   */
  private setupAnalysisControls() {
    const analyzeDependenciesButton = this.container.querySelector('#analyze-dependencies') as HTMLButtonElement;
    const analyzeImpactButton = this.container.querySelector('#analyze-impact') as HTMLButtonElement;
    
    analyzeDependenciesButton?.addEventListener('click', async () => {
      const filePath = (this.container.querySelector('#file-path') as HTMLInputElement)?.value.trim();
      if (!filePath) {
        this.updateConsole('请输入文件路径');
        return;
      }
      
      const includeTransitive = (this.container.querySelector('#include-transitive') as HTMLInputElement)?.checked;
      const includeCircular = (this.container.querySelector('#include-circular') as HTMLInputElement)?.checked;
      
      await this.analyzeDependencies(filePath, { includeTransitive, includeCircular });
    });
    
    analyzeImpactButton?.addEventListener('click', async () => {
      const functionName = (this.container.querySelector('#function-name') as HTMLInputElement)?.value.trim();
      if (!functionName) {
        this.updateConsole('请输入函数名称');
        return;
      }
      
      const depth = parseInt((this.container.querySelector('#impact-depth') as HTMLInputElement)?.value || '3');
      
      await this.analyzeImpact(functionName, depth);
    });
  }
  
  /**
   * 执行依赖分析
   */
  private async analyzeDependencies(filePath: string, options: { includeTransitive: boolean; includeCircular: boolean }) {
    this.updateConsole(`正在分析 ${filePath} 的依赖...`);
    
    try {
      const result = await this.graphApi.analyzeDependencies(filePath, this.currentProjectId, options);
      
      if (result.success && result.data.nodes && result.data.edges) {
        await this.visualizer?.loadGraphData(result.data.nodes, result.data.edges);
        this.displayMetrics(result.data.stats);
        this.updateConsole(`依赖分析完成，找到 ${result.data.nodes.length} 个节点和 ${result.data.edges.length} 条边`);
      } else {
        this.updateConsole(`依赖分析失败: ${result.message || '未知错误'}`);
      }
    } catch (error: any) {
      this.updateConsole(`依赖分析异常: ${error.message}`);
    }
  }
  
  /**
   * 执行影响分析
   */
  private async analyzeImpact(functionName: string, depth: number) {
    this.updateConsole(`正在分析 ${functionName} 的影响范围...`);
    
    try {
      const result = await this.graphApi.analyzeCallGraph(functionName, this.currentProjectId, { depth });
      
      if (result.success && result.data.nodes && result.data.edges) {
        await this.visualizer?.loadGraphData(result.data.nodes, result.data.edges);
        this.displayMetrics(result.data.stats);
        this.updateConsole(`影响分析完成，找到 ${result.data.nodes.length} 个节点和 ${result.data.edges.length} 条边`);
      } else {
        this.updateConsole(`影响分析失败: ${result.message || '未知错误'}`);
      }
    } catch (error: any) {
      this.updateConsole(`影响分析异常: ${error.message}`);
    }
  }
  
  /**
   * 显示统计指标
   */
  private displayMetrics(stats: any) {
    const metricsContainer = this.container.querySelector('#metrics-container') as HTMLElement;
    if (!metricsContainer) return;
    
    if (!stats) {
      metricsContainer.innerHTML = '<div class="no-metrics">无可用指标</div>';
      return;
    }
    
    metricsContainer.innerHTML = `
      <div class="metric-item">
        <span class="metric-label">节点数量:</span>
        <span class="metric-value">${stats.nodeCount.toLocaleString()}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">边数量:</span>
        <span class="metric-value">${stats.edgeCount.toLocaleString()}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">密度:</span>
        <span class="metric-value">${(stats.edgeCount / (stats.nodeCount * (stats.nodeCount - 1) / 2) || 0).toFixed(4)}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">平均度:</span>
        <span class="metric-value">${(2 * stats.edgeCount / stats.nodeCount || 0).toFixed(2)}</span>
      </div>
    `;
  }
  
  /**
   * 更新控制台消息
   */
  private updateConsole(message: string) {
    const consoleElement = this.container.querySelector('#console-messages') as HTMLElement;
    if (consoleElement) {
      consoleElement.textContent = message;
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
  
  /**
   * 销毁页面
   */
  destroy() {
    // 销毁可视化组件
    this.visualizer?.destroy();
    
    // 清理事件监听器
    const analyzeDependenciesButton = this.container.querySelector('#analyze-dependencies') as HTMLButtonElement;
    const analyzeImpactButton = this.container.querySelector('#analyze-impact') as HTMLButtonElement;
    
    analyzeDependenciesButton?.removeEventListener('click', () => {});
    analyzeImpactButton?.removeEventListener('click', () => {});
  }
}