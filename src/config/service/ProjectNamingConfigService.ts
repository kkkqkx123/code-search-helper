import { injectable } from 'inversify';
import { ProjectIdManager } from '../../database/ProjectIdManager';

@injectable()
export class ProjectNamingConfigService {
  /**
   * 获取Qdrant集合名称，实现配置优先级逻辑
   * 1. 检查显式环境配置
   * 2. 项目隔离的动态命名
   * 3. 默认回退
   */
  static getQdrantCollectionName(projectId: string): string {
    // 1. 检查显式环境配置
    const explicitName = process.env.QDRANT_COLLECTION;
    if (explicitName && explicitName !== 'code-snippets') {
      // 显式设置的配置
      return explicitName;
    }
    
    // 2. 使用项目隔离的动态命名
    return `project-${projectId}`;
  }

  /**
   * 获取Nebula空间名称，实现配置优先级逻辑
   * 1. 检查显式环境配置
   * 2. 项目隔离的动态命名
   * 3. 默认回退
   */
  static getNebulaSpaceName(projectId: string): string {
    // 1. 检查显式环境配置
    const explicitName = process.env.NEBULA_SPACE;
    if (explicitName && explicitName !== 'code_graphs') {
      // 显式设置的配置
      return explicitName;
    }
    
    // 2. 使用项目隔离的动态命名
    return `project-${projectId}`;
  }

  /**
   * 验证命名约定是否符合数据库约束
   * @param name 集合名或空间名
   * @returns 是否符合约束
   */
  static validateNamingConvention(name: string): boolean {
    return ProjectIdManager.validateNamingConvention(name);
  }
}