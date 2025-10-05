import { GraphVisualizer } from '../components/graph/GraphVisualizer.js';
import { GraphQueryBuilder } from '../components/graph/GraphQueryBuilder.js';
import { GraphStatsPanel } from '../components/graph/GraphStatsPanel.js';
import { GraphSearchPanel } from '../components/graph/GraphSearchPanel.js';
import { GraphApiClient } from '../services/graphApi.js';
import { GraphResult, PathResult } from '../types/graph.js';

/**
 * 图探索页面（主页面）
 * 提供图数据的可视化探索功能
 */
export class GraphExplorerPage {
  private container: HTMLElement;
  private visualizer: GraphVisualizer | null = null;
  private queryBuilder: GraphQueryBuilder | null = null;
  private statsPanel: GraphStatsPanel | null = null;
  private searchPanel: GraphSearchPanel | null = null;
  private graphApi: GraphApiClient;
  private currentProjectId: string = '';

  /**
   * 类型守卫函数：检查是否为GraphResult类型
   */
  private isGraphResult(result: any): result is GraphResult {
    return result && result.data && 'nodes' in result.data && 'edges' in result.data;
  }

  /**
   * 类型守卫函数：检查是否为PathResult类型
   */
  private isPathResult(result: any): result is PathResult {
    return result && result.data && 'paths' in result.data;
  }

  constructor(container: HTMLElement, projectId?: string) {
    this.container = container;
    this.graphApi = new GraphApiClient();
    this.currentProjectId = projectId || '';
    this.render();
    this.initializeComponents();
  }

  /**
   * 渲染图探索页面
   */
  private render() {
    this.container.innerHTML = `
      <div class="graph-explorer">
        <!-- 顶部导航栏 -->
        <div class="top-navbar">
          <h1>图探索</h1>
          <div class="nav-controls">
            <button id="layout-cose" class="nav-button">力导向布局</button>
            <button id="layout-circle" class="nav-button">圆形布局</button>
            <button id="layout-grid" class="nav-button">网格布局</button>
            <button id="layout-breadthfirst" class="nav-button">层次布局</button>
            <button id="zoom-in" class="nav-button">+</button>
            <button id="zoom-out" class="nav-button">-</button>
            <button id="reset-view" class="nav-button">重置</button>
          </div>
        </div>
        
        <!-- 主要布局容器 -->
        <div class="main-container">
          <!-- 侧边栏 -->
          <div class="sidebar">
            <!-- 查询构建器 -->
            <div class="sidebar-section">
              <h3>查询构建器</h3>
              <div id="query-builder-container"></div>
            </div>
            
            <!-- 搜索面板 -->
            <div class="sidebar-section">
              <h3>搜索与过滤</h3>
              <div id="search-panel-container"></div>
            </div>
            
            <!-- 统计面板 -->
            <div class="sidebar-section">
              <h3>统计信息</h3>
              <div id="stats-panel-container"></div>
            </div>
          </div>
          
          <!-- 主图可视化区域 -->
          <div class="main-content">
            <div id="graph-visualization" class="graph-visualization"></div>
          </div>
        </div>
        
        <!-- 底部状态栏 -->
        <div class="bottom-status">
          <div id="status-message">准备就绪</div>
          <div id="node-count">节点: 0</div>
          <div id="edge-count">边: 0</div>
        </div>
      </div>
    `;
  }

  /**
   * 初始化组件
   */
  private initializeComponents() {
    // 创建图可视化组件
    const visualizationContainer = this.container.querySelector('#graph-visualization') as HTMLElement;
    if (visualizationContainer) {
      this.visualizer = new GraphVisualizer(visualizationContainer);

      // 设置事件监听器
      this.visualizer.on('tap', (event) => {
        const node = event.target;
        if (node.isNode()) {
          this.updateStatus(`选中节点: ${node.data('label')} (${node.data('type')})`);
        }
      });
    }

    // 创建查询构建器
    const queryBuilderContainer = this.container.querySelector('#query-builder-container') as HTMLElement;
    if (queryBuilderContainer) {
      this.queryBuilder = new GraphQueryBuilder(queryBuilderContainer);
      this.queryBuilder.setOnQuerySubmit(async (query) => {
        await this.executeQuery(query);
      });
    }

    // 创建统计面板
    const statsPanelContainer = this.container.querySelector('#stats-panel-container') as HTMLElement;
    if (statsPanelContainer) {
      this.statsPanel = new GraphStatsPanel(statsPanelContainer, this.graphApi);
      if (this.currentProjectId) {
        this.statsPanel.setProjectId(this.currentProjectId);
        this.statsPanel.loadStats(this.currentProjectId);
      }
    }

    // 创建搜索面板
    const searchPanelContainer = this.container.querySelector('#search-panel-container') as HTMLElement;
    if (searchPanelContainer) {
      this.searchPanel = new GraphSearchPanel(searchPanelContainer);
      this.searchPanel.setOnSearchSubmit(async (searchTerm, options) => {
        await this.performSearch(searchTerm, options);
      });
    }

    // 设置顶部导航按钮事件
    this.setupNavigationControls();
  }

  /**
   * 设置顶部导航控制
   */
  private setupNavigationControls() {
    const layoutCoseButton = this.container.querySelector('#layout-cose') as HTMLButtonElement;
    const layoutCircleButton = this.container.querySelector('#layout-circle') as HTMLButtonElement;
    const layoutGridButton = this.container.querySelector('#layout-grid') as HTMLButtonElement;
    const layoutBreadthfirstButton = this.container.querySelector('#layout-breadthfirst') as HTMLButtonElement;
    const zoomInButton = this.container.querySelector('#zoom-in') as HTMLButtonElement;
    const zoomOutButton = this.container.querySelector('#zoom-out') as HTMLButtonElement;
    const resetViewButton = this.container.querySelector('#reset-view') as HTMLButtonElement;

    layoutCoseButton?.addEventListener('click', () => {
      this.visualizer?.updateLayout('cose');
    });

    layoutCircleButton?.addEventListener('click', () => {
      this.visualizer?.updateLayout('circle');
    });

    layoutGridButton?.addEventListener('click', () => {
      this.visualizer?.updateLayout('grid');
    });

    layoutBreadthfirstButton?.addEventListener('click', () => {
      this.visualizer?.updateLayout('breadthfirst');
    });

    zoomInButton?.addEventListener('click', () => {
      this.visualizer?.zoomIn();
    });

    zoomOutButton?.addEventListener('click', () => {
      this.visualizer?.zoomOut();
    });

    resetViewButton?.addEventListener('click', () => {
      this.visualizer?.resetView();
    });
  }

  /**
   * 执行图查询
   */
  private async executeQuery(query: any) {
    this.updateStatus('执行查询中...');

    try {
      let result;
      switch (query.type) {
        case 'RELATED_NODES':
          result = await this.graphApi.findRelatedNodes(
            query.parameters.nodeId,
            {
              maxDepth: query.parameters.maxDepth,
              direction: query.parameters.direction,
              relationshipTypes: query.parameters.relationshipTypes
            }
          );
          break;

        case 'PATH':
          result = await this.graphApi.findPath(
            query.parameters.sourceId,
            query.parameters.targetId,
            {
              maxDepth: query.parameters.maxDepth,
              direction: query.parameters.direction
            }
          );
          break;

        case 'TRAVERSAL':
          result = await this.graphApi.traverseGraph(
            query.parameters.startNodeId,
            {
              maxDepth: query.parameters.maxDepth,
              direction: query.parameters.direction
            }
          );
          break;

        case 'CUSTOM':
          result = await this.graphApi.customQuery(
            query.parameters.query,
            query.parameters.projectId
          );
          break;

        default:
          this.updateStatus('不支持的查询类型');
          return;
      }

      if (result.success) {
        // 检查是否是GraphResult类型（有nodes和edges）
        if (this.isGraphResult(result)) {
          await this.visualizer?.loadGraphData(result.data.nodes, result.data.edges);
          this.updateNodeCount(result.data.nodes.length);
          this.updateEdgeCount(result.data.edges.length);
          this.updateStatus(`查询成功，找到 ${result.data.nodes.length} 个节点和 ${result.data.edges.length} 条边`);
        }
        // 检查是否是PathResult类型（有paths）
        else if (this.isPathResult(result)) {
          // 从路径中提取所有节点和边
          const allNodes: any[] = [];
          const allEdges: any[] = [];

          result.data.paths.forEach(path => {
            allNodes.push(...path.nodes);
            allEdges.push(...path.edges);
          });

          await this.visualizer?.loadGraphData(allNodes, allEdges);
          this.updateNodeCount(allNodes.length);
          this.updateEdgeCount(allEdges.length);
          this.updateStatus(`路径查询成功，找到 ${result.data.paths.length} 条路径，包含 ${allNodes.length} 个节点和 ${allEdges.length} 条边`);
        }
      } else {
        // 使用类型守卫来安全访问message属性
        const errorMessage = this.isGraphResult(result) ? result.message : '未知错误';
        this.updateStatus(`查询失败: ${errorMessage || '未知错误'}`);
      }
    } catch (error: any) {
      this.updateStatus(`查询异常: ${error.message}`);
    }
  }

  /**
   * 执行搜索
   */
  private async performSearch(searchTerm: string, options: any) {
    this.updateStatus('搜索中...');

    try {
      // 这里可以实现更复杂的搜索逻辑
      // 目前简单地使用自定义查询
      const customQuery = `MATCH (n) WHERE n.label CONTAINS "${searchTerm}" RETURN n LIMIT ${options.maxResults}`;
      const result = await this.graphApi.customQuery(customQuery, '');

      if (result.success) {
        // 检查是否是GraphResult类型（有nodes和edges）
        if (this.isGraphResult(result)) {
          await this.visualizer?.loadGraphData(result.data.nodes, result.data.edges);
          this.updateNodeCount(result.data.nodes.length);
          this.updateEdgeCount(result.data.edges.length);
          this.updateStatus(`搜索完成，找到 ${result.data.nodes.length} 个匹配节点`);

          // 高亮搜索结果
          const nodeIds = result.data.nodes.map((node: any) => node.id);
          this.visualizer?.highlightSearchResults(nodeIds);
        }
      } else {
        // 使用类型守卫来安全访问message属性
        const errorMessage = this.isGraphResult(result) ? result.message : '未知错误';
        this.updateStatus(`搜索失败: ${errorMessage || '未知错误'}`);
      }
    } catch (error: any) {
      this.updateStatus(`搜索异常: ${error.message}`);
    }
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
   * 更新节点数量显示
   */
  private updateNodeCount(count: number) {
    const element = this.container.querySelector('#node-count') as HTMLElement;
    if (element) {
      element.textContent = `节点: ${count}`;
    }
  }

  /**
   * 更新边数量显示
   */
  private updateEdgeCount(count: number) {
    const element = this.container.querySelector('#edge-count') as HTMLElement;
    if (element) {
      element.textContent = `边: ${count}`;
    }
  }

  /**
   * 显示页面
   */
  show() {
    this.container.style.display = 'block';

    // 如果有项目ID，加载统计信息
    if (this.currentProjectId && this.statsPanel) {
      this.statsPanel.loadStats(this.currentProjectId);
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
    // 销毁所有组件
    this.visualizer?.destroy();
    this.queryBuilder?.destroy();
    this.statsPanel?.destroy();
    this.searchPanel?.destroy();

    // 清理事件监听器
    const buttons = this.container.querySelectorAll('.nav-button');
    buttons.forEach(button => {
      button.removeEventListener('click', () => { });
    });
  }
}