import { GraphData } from '../caching/types';
import { CodeChunk } from '../../parser/types';

/**
 * 图构建服务接口
 * 负责从代码块构建图结构
 */
export interface IGraphConstructionService {
  /**
   * 构建图结构
   * @param files 文件路径列表
   * @param projectPath 项目路径
   * @returns 图数据
   */
  buildGraphStructure(files: string[], projectPath: string): Promise<GraphData>;

  /**
   * 将代码块转换为图节点
   * @param chunks 代码块列表
   * @returns 图节点列表
   */
  convertToGraphNodes(chunks: CodeChunk[]): any[];

  /**
   * 将代码块转换为图关系
   * @param chunks 代码块列表
   * @returns 图关系列表
   */
  convertToGraphRelationships(chunks: CodeChunk[]): any[];
}