import cytoscape from 'cytoscape';

/**
 * 图可视化组件
 * 使用Cytoscape.js实现交互式图可视化
 */
export class GraphVisualizer {
  private cy: cytoscape.Core;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.cy = cytoscape({
      container: container,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#6197ff',
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'width': 'data(size)',
            'height': 'data(size)',
            'border-width': 2,
            'border-color': '#4a7bd8'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 3,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-style': 'solid',
            'text-rotation': 'autorotate',
            'font-size': 12,
            'text-margin-y': -15
          }
        },
        {
          selector: 'node[type="file"]',
          style: {
            'background-color': '#4ade80',
            'shape': 'round-rectangle'
          }
        },
        {
          selector: 'node[type="function"]',
          style: {
            'background-color': '#fbbf24',
            'shape': 'ellipse'
          }
        },
        {
          selector: 'node[type="class"]',
          style: {
            'background-color': '#f97316',
            'shape': 'diamond'
          }
        },
        {
          selector: 'node[type="import"]',
          style: {
            'background-color': '#a855f7',
            'shape': 'triangle'
          }
        },
        {
          selector: 'edge[type="IMPORTS"]',
          style: {
            'line-color': '#a855f7',
            'target-arrow-color': '#a855f7',
            'line-style': 'dashed'
          }
        },
        {
          selector: 'edge[type="CALLS"]',
          style: {
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24'
          }
        },
        {
          selector: 'edge[type="EXTENDS"]',
          style: {
            'line-color': '#f97316',
            'target-arrow-color': '#f97316',
            'line-style': 'dotted'
          }
        },
        {
          selector: '.highlighted',
          style: {
            'background-color': '#ef4444',
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'transition-property': 'background-color, line-color, target-arrow-color',
            'transition-duration': 500
          }
        }
      ],
      layout: {
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      },
      interaction: {
        zoom: true,
        pan: true,
        selectionType: 'single',
        touchTapThreshold: 8,
        desktopTapThreshold: 4,
        autolock: false,
        autoungrabify: false,
        autounselectify: false
      }
    });
  }
  
  /**
   * 加载图数据
   */
  async loadGraphData(nodes: any[], edges: any[]) {
    // 清空现有图数据
    this.cy.elements().remove();
    
    // 添加新数据
    const elements = [
      ...nodes.map(node => ({
        data: { 
          id: node.id, 
          label: node.label || node.id,
          type: node.type,
          ...node.properties 
        }
      })),
      ...edges.map(edge => ({
        data: { 
          id: edge.id, 
          source: edge.source, 
          target: edge.target,
          type: edge.type,
          ...edge.properties 
        }
      }))
    ];
    
    this.cy.add(elements);
    
    // 应用布局
    await this.cy.layout(this.cy.options().layout).run();
  }
  
  /**
   * 搜索高亮
   */
  highlightSearchResults(nodeIds: string[]) {
    // 移除之前的所有高亮
    this.cy.elements().removeClass('highlighted');
    
    // 高亮匹配的节点
    nodeIds.forEach(id => {
      const node = this.cy.getElementById(id);
      if (node) {
        node.addClass('highlighted');
      }
    });
    
    // 如果有匹配的节点，居中显示
    if (nodeIds.length > 0) {
      const nodesToFocus = this.cy.nodes().filter(node => nodeIds.includes(node.id()));
      if (nodesToFocus.length > 0) {
        this.cy.animate({
          fit: {
            eles: nodesToFocus,
            padding: 50
          }
        }, {
          duration: 1000
        });
      }
    }
  }
  
  /**
   * 更新图布局
   */
  updateLayout(layoutName: string = 'cose') {
    let layoutOptions: any = {};
    
    switch (layoutName) {
      case 'cose':
        layoutOptions = {
          name: 'cose',
          idealEdgeLength: 100,
          nodeOverlap: 20,
          refresh: 20,
          fit: true,
          padding: 30,
          randomize: false,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          edgeElasticity: 100,
          nestingFactor: 5,
          gravity: 80,
          numIter: 1000,
          initialTemp: 200,
          coolingFactor: 0.95,
          minTemp: 1.0
        };
        break;
      case 'circle':
        layoutOptions = {
          name: 'circle',
          fit: true,
          padding: 30,
          rStepSize: 10,
          minNodeSpacing: 10
        };
        break;
      case 'grid':
        layoutOptions = {
          name: 'grid',
          fit: true,
          padding: 30,
          avoidOverlap: true,
          rows: undefined,
          columns: undefined
        };
        break;
      case 'breadthfirst':
        layoutOptions = {
          name: 'breadthfirst',
          fit: true,
          directed: true,
          padding: 30,
          circle: false,
          spacingFactor: 1.75
        };
        break;
      default:
        layoutOptions = { name: layoutName };
    }
    
    this.cy.layout(layoutOptions).run();
  }
  
  /**
   * 获取选中的节点
   */
  getSelectedNode() {
    return this.cy.$(':selected');
  }
  
  /**
   * 添加事件监听器
   */
  on(eventName: string, callback: (event: any) => void) {
    this.cy.on(eventName, callback);
  }
  
  /**
   * 销毁图可视化组件
   */
  destroy() {
    if (this.cy) {
      this.cy.destroy();
    }
  }
  
  /**
   * 获取Cytoscape实例
   */
  getInstance(): cytoscape.Core {
    return this.cy;
  }
  
  /**
   * 放大
   */
  zoomIn() {
    this.cy.animate({
      zoom: this.cy.zoom() * 1.2,
      center: { eles: this.cy.elements() }
    }, {
      duration: 500
    });
  }
  
  /**
   * 缩小
   */
  zoomOut() {
    this.cy.animate({
      zoom: this.cy.zoom() * 0.8,
      center: { eles: this.cy.elements() }
    }, {
      duration: 500
    });
  }
  
  /**
   * 重置视图
   */
  resetView() {
    this.cy.animate({
      fit: { eles: this.cy.elements() },
      zoom: this.cy.zoom(),
      pan: { x: 0, y: 0 }
    }, {
      duration: 1000
    });
  }
}