import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { 
  GraphNode, 
  GraphRelationship, 
  GraphNodeType, 
  GraphRelationshipType,
  FileAnalysisResult,
  FunctionInfo,
  ClassInfo
} from './IGraphDataMappingService';
import { CodeChunk } from '../parser/splitting/Splitter';
import { v4 as uuidv4 } from 'uuid';
import { DataMappingValidator } from '../validation/DataMappingValidator';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../batching/GraphBatchOptimizer';

export interface AdvancedMappingOptions {
  includeInheritance: boolean;
 includeMethodCalls: boolean;
  includePropertyAccesses: boolean;
  includeInterfaceImplementations: boolean;
  includeDependencies: boolean;
}

export interface InheritanceRelationship {
  superClass: string;
  subClass: string;
  relationshipType: 'extends' | 'implements';
}

export interface CallRelationship {
  caller: string;
  callee: string;
 callType: 'method' | 'function' | 'constructor';
}

@injectable()
export class AdvancedMappingService {
  private logger: LoggerService;
  private validator: DataMappingValidator;
  private cache: GraphMappingCache;
  private batchOptimizer: GraphBatchOptimizer;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.DataMappingValidator) validator: DataMappingValidator,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer
  ) {
    this.logger = logger;
    this.validator = validator;
    this.cache = cache;
    this.batchOptimizer = batchOptimizer;
    
    this.logger.info('AdvancedMappingService initialized');
  }

  /**
   * 执行高级映射，包括继承关系、调用链等
   */
 async mapWithAdvancedFeatures(
    filePath: string,
    fileContent: string,
    analysisResult: FileAnalysisResult,
    options?: AdvancedMappingOptions
  ): Promise<{
    nodes: GraphNode[];
    relationships: GraphRelationship[];
  }> {
    const opts: AdvancedMappingOptions = {
      includeInheritance: true,
      includeMethodCalls: true,
      includePropertyAccesses: true,
      includeInterfaceImplementations: true,
      includeDependencies: true,
      ...options
    };

    this.logger.debug('Starting advanced mapping', { filePath, options: opts });

    // 检查缓存
    const cacheKey = `advanced_mapping_${filePath}_${JSON.stringify(opts)}`;
    const cachedResult = await this.cache.getMappingResult(cacheKey);
    if (cachedResult) {
      this.logger.debug('Using cached advanced mapping result', { filePath });
      return {
        nodes: cachedResult.nodes,
        relationships: cachedResult.relationships
      };
    }

    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];

    // 基础映射（文件、函数、类等）
    const basicResult = await this.performBasicMapping(filePath, fileContent, analysisResult);
    nodes.push(...basicResult.nodes);
    relationships.push(...basicResult.relationships);

    // 高级映射功能
    if (opts.includeInheritance) {
      const inheritanceRels = await this.extractInheritanceRelationships(analysisResult);
      relationships.push(...inheritanceRels);
    }

    if (opts.includeMethodCalls) {
      const callRels = await this.extractCallRelationships(analysisResult);
      relationships.push(...callRels);
    }

    if (opts.includePropertyAccesses) {
      const propertyRels = await this.extractPropertyAccessRelationships(analysisResult);
      relationships.push(...propertyRels);
    }

    if (opts.includeInterfaceImplementations) {
      const interfaceRels = await this.extractInterfaceImplementationRelationships(analysisResult);
      relationships.push(...interfaceRels);
    }

    if (opts.includeDependencies) {
      const dependencyRels = await this.extractDependencyRelationships(analysisResult);
      relationships.push(...dependencyRels);
    }

    // 验证生成的节点和关系
    const validationResult = this.validator.validateGraphData(nodes, relationships);
    if (!validationResult.isValid) {
      this.logger.warn('Advanced mapping validation failed', {
        filePath,
        errors: validationResult.errors
      });
    }

    // 缓存结果
    await this.cache.cacheMappingResult(cacheKey, nodes, relationships);

    this.logger.debug('Advanced mapping completed', {
      filePath,
      nodeCount: nodes.length,
      relationshipCount: relationships.length
    });

    return { nodes, relationships };
  }

  /**
   * 提取继承关系
   */
  async extractInheritanceRelationships(analysisResult: FileAnalysisResult): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    for (const cls of analysisResult.classes) {
      // 处理类继承关系
      if (cls.superClass) {
        // 查找父类节点
        const superClassNode = this.findClassNode(cls.superClass, analysisResult);
        if (superClassNode) {
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.INHERITS,
            fromNodeId: superClassNode.id,
            toNodeId: cls.name, // 这里应该是类节点的实际ID
            properties: {
              inheritanceType: 'extends',
              created: new Date().toISOString()
            }
          });
        }
      }

      // 处理接口实现关系
      for (const interfaceName of cls.interfaces) {
        const interfaceNode = this.findClassNode(interfaceName, analysisResult); // 假设接口也作为类节点处理
        if (interfaceNode) {
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.IMPLEMENTS,
            fromNodeId: interfaceNode.id,
            toNodeId: cls.name, // 这里应该是类节点的实际ID
            properties: {
              inheritanceType: 'implements',
              created: new Date().toISOString()
            }
          });
        }
      }
    }

    this.logger.debug('Extracted inheritance relationships', { count: relationships.length });
    return relationships;
 }

  /**
   * 提取调用关系
   */
  async extractCallRelationships(analysisResult: FileAnalysisResult): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 在函数之间创建调用关系（这需要从AST中提取实际的调用信息）
    // 这里我们创建一个示例实现
    for (const func of analysisResult.functions) {
      // 示例：查找函数内部调用的其他函数
      const calledFunctions = this.extractCalledFunctions(func, analysisResult);
      
      for (const calledFunc of calledFunctions) {
        // 查找被调用函数的节点
        const calleeNode = this.findFunctionNode(calledFunc, analysisResult);
        if (calleeNode) {
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.CALLS,
            fromNodeId: func.name, // 这里应该是函数节点的实际ID
            toNodeId: calleeNode.id,
            properties: {
              callType: 'function',
              created: new Date().toISOString()
            }
          });
        }
      }
    }

    this.logger.debug('Extracted call relationships', { count: relationships.length });
    return relationships;
  }

  /**
   * 提取属性访问关系
   */
  async extractPropertyAccessRelationships(analysisResult: FileAnalysisResult): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 示例：提取函数中对类属性的访问关系
    for (const func of analysisResult.functions) {
      const accessedProperties = this.extractAccessedProperties(func, analysisResult);
      
      for (const prop of accessedProperties) {
        // 查找属性所属的类
        const classWithProperty = this.findClassWithProperty(prop, analysisResult);
        if (classWithProperty) {
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.USES,
            fromNodeId: func.name, // 这里应该是函数节点的实际ID
            toNodeId: classWithProperty.name, // 这里应该是类节点的实际ID
            properties: {
              property: prop,
              accessType: 'read',
              created: new Date().toISOString()
            }
          });
        }
      }
    }

    this.logger.debug('Extracted property access relationships', { count: relationships.length });
    return relationships;
 }

  /**
   * 提取接口实现关系
   */
  async extractInterfaceImplementationRelationships(analysisResult: FileAnalysisResult): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    for (const cls of analysisResult.classes) {
      for (const interfaceName of cls.interfaces) {
        // 创建类实现接口的关系
        relationships.push({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.IMPLEMENTS,
          fromNodeId: cls.name, // 这里应该是类节点的实际ID
          toNodeId: interfaceName, // 这里应该是接口节点的实际ID
          properties: {
            created: new Date().toISOString()
          }
        });
      }
    }

    this.logger.debug('Extracted interface implementation relationships', { count: relationships.length });
    return relationships;
 }

  /**
   * 提取依赖关系
   */
  async extractDependencyRelationships(analysisResult: FileAnalysisResult): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 处理导入关系
    for (const imp of analysisResult.imports) {
      relationships.push({
        id: `rel_${uuidv4()}`,
        type: GraphRelationshipType.IMPORTS,
        fromNodeId: analysisResult.filePath, // 文件节点ID
        toNodeId: imp.path, // 导入的模块路径
        properties: {
          importName: imp.name,
          importedAs: imp.importedAs,
          created: new Date().toISOString()
        }
      });
    }

    this.logger.debug('Extracted dependency relationships', { count: relationships.length });
    return relationships;
  }

  private async performBasicMapping(
    filePath: string,
    fileContent: string,
    analysisResult: FileAnalysisResult
  ): Promise<{ nodes: GraphNode[]; relationships: GraphRelationship[]; }> {
    // 这里应该调用基础映射服务，但为了简化，我们实现一个基本版本
    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];

    // 创建文件节点
    const fileNode: GraphNode = {
      id: `file_${uuidv4()}`,
      type: GraphNodeType.FILE,
      properties: {
        name: filePath.split('/').pop()?.split('\\').pop() || filePath,
        path: filePath,
        size: fileContent.length,
        language: analysisResult.language,
        lastModified: new Date(),
        projectId: 'default-project'
      }
    };
    nodes.push(fileNode);

    // 创建函数节点
    for (const func of analysisResult.functions) {
      const funcNode: GraphNode = {
        id: `func_${uuidv4()}`,
        type: GraphNodeType.FUNCTION,
        properties: {
          ...func,
          parentFileId: fileNode.id
        }
      };
      nodes.push(funcNode);

      // 创建文件包含函数的关系
      relationships.push({
        id: `rel_${uuidv4()}`,
        type: GraphRelationshipType.CONTAINS,
        fromNodeId: fileNode.id,
        toNodeId: funcNode.id,
        properties: {
          created: new Date().toISOString()
        }
      });
    }

    // 创建类节点
    for (const cls of analysisResult.classes) {
      const classNode: GraphNode = {
        id: `class_${uuidv4()}`,
        type: GraphNodeType.CLASS,
        properties: {
          ...cls,
          parentFileId: fileNode.id
        }
      };
      nodes.push(classNode);

      // 创建文件包含类的关系
      relationships.push({
        id: `rel_${uuidv4()}`,
        type: GraphRelationshipType.CONTAINS,
        fromNodeId: fileNode.id,
        toNodeId: classNode.id,
        properties: {
          created: new Date().toISOString()
        }
      });
    }

    return { nodes, relationships };
  }

  private findClassNode(className: string, analysisResult: FileAnalysisResult): any {
    // 简化的查找逻辑，实际实现可能需要更复杂的匹配
    return analysisResult.classes.find(cls => cls.name === className);
  }

  private findFunctionNode(functionName: string, analysisResult: FileAnalysisResult): any {
    // 简化的查找逻辑
    return analysisResult.functions.find(func => func.name === functionName);
  }

  private extractCalledFunctions(functionInfo: FunctionInfo, analysisResult: FileAnalysisResult): string[] {
    // 这里应该从函数的AST或内容中提取被调用的函数名
    // 为了示例，返回空数组
    return [];
  }

  private extractAccessedProperties(functionInfo: FunctionInfo, analysisResult: FileAnalysisResult): string[] {
    // 这里应该从函数的AST或内容中提取被访问的属性名
    // 为了示例，返回空数组
    return [];
  }

  private findClassWithProperty(propertyName: string, analysisResult: FileAnalysisResult): ClassInfo | undefined {
    // 查找包含特定属性的类
    for (const cls of analysisResult.classes) {
      if (cls.properties.some(prop => prop.name === propertyName)) {
        return cls;
      }
    }
    return undefined;
 }
}