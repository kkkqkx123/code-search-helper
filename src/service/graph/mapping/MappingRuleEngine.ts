import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import {
  GraphNode,
  GraphRelationship,
  GraphNodeType,
  GraphRelationshipType,
  FileAnalysisResult
} from './IGraphDataMappingService';

export interface MappingRule {
  id: string;
  name: string;
  description: string;
  condition: (context: MappingRuleContext) => boolean;
  action: (context: MappingRuleContext) => void;
  priority: number; // 数字越小优先级越高
}

export interface MappingRuleContext {
  filePath: string;
  fileContent: string;
  analysisResult: FileAnalysisResult;
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  language: string;
  additionalData?: any;
}

export interface RuleEngineOptions {
  enableCaching: boolean;
  cacheTTL: number; // 毫秒
  maxRules: number;
  registerDefaultRules: boolean;
}

@injectable()
export class MappingRuleEngine {
  private logger: LoggerService;
  private rules: MappingRule[] = [];
  private options: RuleEngineOptions;
  private ruleCache: Map<string, GraphNode[]> = new Map();
  private relationshipCache: Map<string, GraphRelationship[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    options?: Partial<RuleEngineOptions>
  ) {
    this.logger = logger;
    this.options = {
      enableCaching: true,
      cacheTTL: 300000, // 5分钟
      maxRules: 100,
      registerDefaultRules: true,
      ...options
    };

    this.logger.info('MappingRuleEngine initialized', { options: this.options });

    // 注册默认规则
    if (this.options.registerDefaultRules) {
      this.registerDefaultRules();
    }
  }

  /**
   * 注册映射规则
   */
  registerRule(rule: MappingRule): void {
    if (this.rules.length >= (this.options.maxRules || 100)) {
      this.logger.warn('Maximum number of rules reached, not adding new rule', { ruleId: rule.id });
      return;
    }

    // 按优先级插入规则（数字越小优先级越高）
    // 当优先级相同时，新规则插入到相同优先级规则之前
    const insertIndex = this.rules.findIndex(r => r.priority >= rule.priority);
    if (insertIndex === -1) {
      this.rules.push(rule);
    } else {
      this.rules.splice(insertIndex, 0, rule);
    }

    this.logger.debug('Registered mapping rule', {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority
    });
  }

  /**
   * 执行映射规则
   */
  async executeRules(context: MappingRuleContext): Promise<{
    nodes: GraphNode[];
    relationships: GraphRelationship[];
  }> {
    // 检查缓存
    if (this.options.enableCaching) {
      const cacheKey = this.generateCacheKey(context);
      const cachedNodes = this.ruleCache.get(cacheKey);
      const cachedRelationships = this.relationshipCache.get(cacheKey);

      if (cachedNodes && cachedRelationships) {
        this.logger.debug('Using cached rule execution result', { cacheKey });
        return {
          nodes: cachedNodes,
          relationships: cachedRelationships
        };
      }
    }

    this.logger.debug('Executing mapping rules', {
      filePath: context.filePath,
      ruleCount: this.rules.length
    });

    // 创建上下文副本以避免修改原始数据
    const executionContext: MappingRuleContext = {
      ...context,
      nodes: [...context.nodes],
      relationships: [...context.relationships]
    };

    // 执行所有规则
    for (const rule of this.rules) {
      try {
        if (rule.condition(executionContext)) {
          this.logger.debug('Executing rule', {
            ruleId: rule.id,
            ruleName: rule.name
          });

          rule.action(executionContext);
        }
      } catch (error) {
        this.logger.error('Error executing rule', {
          ruleId: rule.id,
          ruleName: rule.name,
          error: (error as Error).message
        });
      }
    }

    // 缓存结果
    if (this.options.enableCaching) {
      const cacheKey = this.generateCacheKey(context);
      this.ruleCache.set(cacheKey, executionContext.nodes);
      this.relationshipCache.set(cacheKey, executionContext.relationships);

      // 清理过期缓存
      this.cleanupExpiredCache();
    }

    this.logger.debug('Rule execution completed', {
      filePath: context.filePath,
      nodeCount: executionContext.nodes.length,
      relationshipCount: executionContext.relationships.length
    });

    return {
      nodes: executionContext.nodes,
      relationships: executionContext.relationships
    };
  }

  /**
   * 批量执行规则
   */
  async executeRulesBatch(
    contexts: MappingRuleContext[]
  ): Promise<Array<{ nodes: GraphNode[]; relationships: GraphRelationship[] }>> {
    const results: Array<{ nodes: GraphNode[]; relationships: GraphRelationship[] }> = [];

    for (const context of contexts) {
      const result = await this.executeRules(context);
      results.push(result);
    }

    return results;
  }

  /**
    * 获取所有注册的规则
    */
  getRules(): MappingRule[] {
    return [...this.rules];
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(rule => rule.id !== ruleId);
    const removed = this.rules.length !== initialLength;

    if (removed) {
      this.logger.debug('Removed mapping rule', { ruleId });
    } else {
      this.logger.warn('Rule not found for removal', { ruleId });
    }

    return removed;
  }

  /**
   * 清空所有规则
   */
  clearRules(): void {
    this.rules = [];
    this.logger.info('Cleared all mapping rules');
  }

  private registerDefaultRules(): void {
    // 文件节点创建规则
    this.registerRule({
      id: 'file-node-creation',
      name: 'File Node Creation',
      description: 'Creates a file node for each processed file',
      condition: (context: MappingRuleContext) => context.filePath !== undefined,
      action: (context: MappingRuleContext) => {
        // 检查是否已存在文件节点
        const existingFileNode = context.nodes.find(
          node => node.type === GraphNodeType.FILE &&
            node.properties.path === context.filePath
        );

        if (!existingFileNode) {
          const fileNode = {
            id: `file_${Buffer.from(context.filePath).toString('hex')}`,
            type: GraphNodeType.FILE,
            properties: {
              name: context.filePath.split('/').pop()?.split('\\').pop() || context.filePath,
              path: context.filePath,
              language: context.language,
              size: context.fileContent.length,
              lastModified: new Date(),
              projectId: 'default-project'
            }
          };
          context.nodes.push(fileNode);
        }
      },
      priority: 1
    });

    // 函数节点创建规则
    this.registerRule({
      id: 'function-node-creation',
      name: 'Function Node Creation',
      description: 'Creates function nodes from analysis results',
      condition: (context: MappingRuleContext) => context.analysisResult.functions.length > 0,
      action: (context: MappingRuleContext) => {
        const fileNode = context.nodes.find(
          node => node.type === GraphNodeType.FILE &&
            node.properties.path === context.filePath
        );

        if (fileNode) {
          for (const func of context.analysisResult.functions) {
            // 检查是否已存在函数节点
            const existingFuncNode = context.nodes.find(
              node => node.type === GraphNodeType.FUNCTION &&
                node.properties.name === func.name &&
                node.properties.startLine === func.startLine
            );

            if (!existingFuncNode) {
              const funcNode = {
                id: `func_${Buffer.from(`${context.filePath}_${func.name}_${func.startLine}`).toString('hex')}`,
                type: GraphNodeType.FUNCTION,
                properties: {
                  ...func,
                  parentFileId: fileNode.id
                }
              };
              context.nodes.push(funcNode);

              // 创建文件包含函数的关系
              context.relationships.push({
                id: `rel_${Buffer.from(`${fileNode.id}_${funcNode.id}`).toString('hex')}`,
                type: GraphRelationshipType.CONTAINS,
                fromNodeId: fileNode.id,
                toNodeId: funcNode.id,
                properties: {
                  created: new Date().toISOString()
                }
              });
            }
          }
        }
      },
      priority: 2
    });

    // 类节点创建规则
    this.registerRule({
      id: 'class-node-creation',
      name: 'Class Node Creation',
      description: 'Creates class nodes from analysis results',
      condition: (context: MappingRuleContext) => context.analysisResult.classes.length > 0,
      action: (context: MappingRuleContext) => {
        const fileNode = context.nodes.find(
          node => node.type === GraphNodeType.FILE &&
            node.properties.path === context.filePath
        );

        if (fileNode) {
          for (const cls of context.analysisResult.classes) {
            // 检查是否已存在类节点
            const existingClassNode = context.nodes.find(
              node => node.type === GraphNodeType.CLASS &&
                node.properties.name === cls.name
            );

            if (!existingClassNode) {
              const classNode = {
                id: `class_${Buffer.from(`${context.filePath}_${cls.name}`).toString('hex')}`,
                type: GraphNodeType.CLASS,
                properties: {
                  ...cls,
                  parentFileId: fileNode.id
                }
              };
              context.nodes.push(classNode);

              // 创建文件包含类的关系
              context.relationships.push({
                id: `rel_${Buffer.from(`${fileNode.id}_${classNode.id}`).toString('hex')}`,
                type: GraphRelationshipType.CONTAINS,
                fromNodeId: fileNode.id,
                toNodeId: classNode.id,
                properties: {
                  created: new Date().toISOString()
                }
              });
            }
          }
        }
      },
      priority: 3
    });
  }

  private generateCacheKey(context: MappingRuleContext): string {
    // 生成基于文件路径、内容哈希和规则版本的缓存键
    const contentHash = this.simpleHash(context.fileContent);
    const ruleVersion = this.getRuleVersion();
    return `${context.filePath}_${contentHash}_${ruleVersion}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString();
  }

  private getRuleVersion(): string {
    // 简单的规则版本生成，实际实现中可能需要更复杂的版本管理
    return this.rules.length.toString();
  }

  private cleanupExpiredCache(): void {
    // 简单的缓存清理，实际实现中可能需要更复杂的过期策略
    // 这里只是占位符，因为我们的缓存没有存储时间戳
  }
}