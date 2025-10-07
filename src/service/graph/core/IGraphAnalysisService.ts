import {
  GraphAnalysisOptions,
  GraphAnalysisResult,
  CodeGraphRelationship
} from './types';

/**
 * 图分析服务接口
 * 专注于代码库分析、依赖查找、影响分析等分析功能
 */
export interface IGraphAnalysisService {
  /**
   * 分析代码库
   * @param projectPath 项目路径
   * @param options 分析选项
   * @returns 分析结果
   */
  analyzeCodebase(
    projectPath: string,
    options?: GraphAnalysisOptions
  ): Promise<{
    result: GraphAnalysisResult;
    formattedResult: any;
  }>;

  /**
   * 查找依赖关系
   * @param filePath 文件路径
   * @param options 查找选项
   * @returns 依赖关系结果
   */
  findDependencies(
    filePath: string,
    options?: { direction?: 'incoming' | 'outgoing'; depth?: number }
  ): Promise<{
    direct: CodeGraphRelationship[];
    transitive: CodeGraphRelationship[];
    summary: {
      directCount: number;
      transitiveCount: number;
      criticalPath: string[];
    };
  }>;

  /**
   * 查找影响范围
   * @param filePath 文件路径
   * @param options 分析选项
   * @returns 影响分析结果
   */
  findImpact(
    filePath: string,
    options?: { maxDepth?: number; includeTests?: boolean }
  ): Promise<{
    affectedFiles: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    impactScore: number;
    affectedComponents: string[];
  }>;

  /**
   * 获取图统计信息
   * @param projectPath 项目路径
   * @returns 统计信息
   */
  getGraphStats(projectPath: string): Promise<{
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalImports: number;
    complexityScore: number;
    maintainabilityIndex: number;
    cyclicDependencies: number;
  }>;

  /**
   * 导出图数据
   * @param projectPath 项目路径
   * @param format 导出格式
   * @returns 导出数据
   */
  exportGraph(projectPath: string, format: 'json' | 'graphml' | 'dot'): Promise<string>;

  /**
   * 分析依赖关系
   * @param filePath 文件路径
   * @param projectId 项目ID
   * @param options 分析选项
   * @returns 依赖分析结果
   */
  analyzeDependencies(
    filePath: string,
    projectId: string,
    options?: { includeTransitive?: boolean; includeCircular?: boolean }
  ): Promise<any>;

  /**
   * 分析调用图
   * @param functionName 函数名
   * @param projectId 项目ID
   * @param options 分析选项
   * @returns 调用图分析结果
   */
  analyzeCallGraph(
    functionName: string,
    projectId: string,
    options?: { depth?: number; direction?: 'in' | 'out' | 'both' }
  ): Promise<any>;

  /**
   * 分析影响范围
   * @param nodeIds 节点ID列表
   * @param projectId 项目ID
   * @param options 分析选项
   * @returns 影响分析结果
   */
  analyzeImpact(
    nodeIds: string[],
    projectId: string,
    options?: { depth?: number }
  ): Promise<any>;

  /**
   * 获取项目概览
   * @param projectId 项目ID
   * @returns 项目概览信息
   */
  getProjectOverview(projectId: string): Promise<any>;

  /**
   * 获取结构指标
   * @param projectId 项目ID
   * @returns 结构指标信息
   */
  getStructureMetrics(projectId: string): Promise<any>;

  /**
   * 检测循环依赖
   * @param projectId 项目ID
   * @returns 循环依赖检测结果
   */
  detectCircularDependencies(projectId: string): Promise<any>;

  /**
   * 按项目获取图统计信息
   * @param projectId 项目ID
   * @returns 图统计信息
   */
  getGraphStatsByProject(projectId: string): Promise<any>;
}