import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import {
  GraphNode,
  GraphRelationship,
  GraphNodeType,
  GraphRelationshipType,
  FileAnalysisResult,
  FunctionInfo,
  ClassInfo
} from './IGraphDataMappingService';
import { v4 as uuidv4 } from 'uuid';
import { DataMappingValidator } from './DataMappingValidator';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../utils/GraphBatchOptimizer';
import { StandardizedQueryResult } from '../../parser/core/normalization/types';
import { ContentHashUtils } from '../../../utils/cache/ContentHashUtils';

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

    this.logger.info('AdvancedMappingService initialized - TreeSitter dependencies removed');
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
      // 使用新的标准化方法
      this.logger.warn('Method calls extraction is now handled by standardized modules');
      // const callRels = await this.extractCallRelationshipsFromStandardized(analysisResult, standardizedNodes);
      // relationships.push(...callRels);
    }

    if (opts.includePropertyAccesses) {
      // 使用新的标准化方法
      this.logger.warn('Property access extraction is now handled by standardized modules');
      // const propertyRels = await this.extractPropertyAccessRelationshipsFromStandardized(analysisResult, standardizedNodes);
      // relationships.push(...propertyRels);
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
        // 计算父类和子类的节点ID
        const superClassId = this.computeNodeId(cls.superClass, GraphNodeType.CLASS, analysisResult.filePath);
        const subClassId = this.computeNodeId(cls.name, GraphNodeType.CLASS, analysisResult.filePath);

        relationships.push({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.INHERITS,
          fromNodeId: superClassId,
          toNodeId: subClassId,
          properties: {
            inheritanceType: 'extends',
            created: new Date().toISOString()
          }
        });
      }

      // 处理接口实现关系
      for (const interfaceName of cls.interfaces) {
        const interfaceId = this.computeNodeId(interfaceName, GraphNodeType.INTERFACE, analysisResult.filePath);
        const classId = this.computeNodeId(cls.name, GraphNodeType.CLASS, analysisResult.filePath);

        relationships.push({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.IMPLEMENTS,
          fromNodeId: interfaceId,
          toNodeId: classId,
          properties: {
            inheritanceType: 'implements',
            created: new Date().toISOString()
          }
        });
      }
    }

    this.logger.debug('Extracted inheritance relationships', { count: relationships.length });
    return relationships;
  }


  /**
   * 从标准化结果中提取调用关系
   * @param analysisResult 文件分析结果
   * @param standardizedNodes 标准化查询结果
   * @returns 调用关系列表
   */
  async extractCallRelationshipsFromStandardized(
    analysisResult: FileAnalysisResult,
    standardizedNodes: StandardizedQueryResult[]
  ): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 筛选出调用关系节点
    const callNodes = standardizedNodes.filter(node => node.type === 'call');

    for (const callNode of callNodes) {
      const callData = callNode.metadata.extra;
      if (callData && callData.fromNodeId && callData.toNodeId) {
        relationships.push({
          id: callNode.nodeId,
          type: GraphRelationshipType.CALLS,
          fromNodeId: callData.fromNodeId,
          toNodeId: callData.toNodeId,
          properties: {
            callName: callData.callName,
            callType: callData.callType,
            created: new Date().toISOString()
          }
        });
      }
    }

    this.logger.debug('Extracted call relationships from standardized results', { count: relationships.length });
    return relationships;
  }

  /**
   /**
    * 从标准化结果中提取被调用的函数
    * @param functionInfo 当前函数信息
    * @param standardizedNodes 标准化查询结果
    * @returns 被调用的函数名列表
    */
  private extractCalledFunctionsFromStandardizedResults(
    functionInfo: FunctionInfo,
    standardizedNodes: StandardizedQueryResult[]
  ): string[] {
    const calledFunctions: string[] = [];

    // 筛选出调用关系且在当前函数范围内的节点
    const callNodes = standardizedNodes.filter(node =>
      node.type === 'call' &&
      node.startLine >= functionInfo.startLine &&
      node.endLine <= functionInfo.endLine
    );

    for (const callNode of callNodes) {
      const callName = callNode.metadata.extra?.callName;
      if (callName) {
        calledFunctions.push(callName);
      }
    }

    return [...new Set(calledFunctions)]; // 去重
  }

  /**
   * 从标准化结果中提取访问的属性
   * @param functionInfo 当前函数信息
   * @param standardizedNodes 标准化查询结果
   * @returns 访问的属性名列表
   */
  private extractAccessedPropertiesFromStandardizedResults(
    functionInfo: FunctionInfo,
    standardizedNodes: StandardizedQueryResult[]
  ): string[] {
    const accessedProperties: string[] = [];

    // 筛选出依赖关系且在当前函数范围内的节点（作为引用关系的替代）
    const referenceNodes = standardizedNodes.filter(node =>
      node.type === 'dependency' &&
      node.startLine >= functionInfo.startLine &&
      node.endLine <= functionInfo.endLine
    );

    for (const refNode of referenceNodes) {
      const referenceName = refNode.metadata.extra?.target || refNode.name;
      if (referenceName) {
        accessedProperties.push(referenceName);
      }
    }

    return [...new Set(accessedProperties)]; // 去重
  }

  /**
   * 从标准化结果中提取属性访问关系
   * @param analysisResult 文件分析结果
   * @param standardizedNodes 标准化查询结果
   * @returns 属性访问关系列表
   */
  async extractPropertyAccessRelationshipsFromStandardized(
    analysisResult: FileAnalysisResult,
    standardizedNodes: StandardizedQueryResult[]
  ): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 筛选出依赖关系节点（作为引用关系的替代）
    const referenceNodes = standardizedNodes.filter(node => node.type === 'dependency');

    for (const refNode of referenceNodes) {
      const refData = refNode.metadata.extra;
      if (refData && refData.source && refData.target) {
        relationships.push({
          id: refNode.nodeId,
          type: GraphRelationshipType.ACCESSES,
          fromNodeId: refData.source,
          toNodeId: refData.target,
          properties: {
            referenceType: refData.type,
            referenceName: refData.referenceName,
            accessType: 'read',
            created: new Date().toISOString()
          }
        });
      }
    }

    this.logger.debug('Extracted property access relationships from standardized results', { count: relationships.length });
    return relationships;
  }

  /**
   * @deprecated 此方法已废弃，属性访问提取现在通过标准化模块处理
   */
  private async extractAccessedPropertiesFromAST(functionInfo: FunctionInfo, analysisResult: FileAnalysisResult, fileContent: string): Promise<string[]> {
    this.logger.warn('extractAccessedPropertiesFromAST is deprecated. Property access extraction is now handled by standardized modules.');
    return [];
  }

  /**
    * 提取接口实现关系
    */
  async extractInterfaceImplementationRelationships(analysisResult: FileAnalysisResult): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    for (const cls of analysisResult.classes) {
      const classId = this.computeNodeId(cls.name, GraphNodeType.CLASS, analysisResult.filePath);

      for (const interfaceName of cls.interfaces) {
        const interfaceId = this.computeNodeId(interfaceName, GraphNodeType.INTERFACE, analysisResult.filePath);

        // 创建类实现接口的关系
        relationships.push({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.IMPLEMENTS,
          fromNodeId: classId,
          toNodeId: interfaceId,
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
    const fileId = this.computeNodeId(analysisResult.filePath, GraphNodeType.FILE, analysisResult.filePath);

    for (const imp of analysisResult.imports) {
      // 为导入的模块创建一个ID
      const importedFileId = this.computeNodeId(imp.path, GraphNodeType.FILE, imp.path);

      relationships.push({
        id: `rel_${uuidv4()}`,
        type: GraphRelationshipType.IMPORTS,
        fromNodeId: fileId,
        toNodeId: importedFileId,
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
    const fileNodeId = this.computeNodeId(filePath, GraphNodeType.FILE, filePath);
    const fileNode: GraphNode = {
      id: fileNodeId,
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
      const funcNodeId = this.computeNodeId(func.name, GraphNodeType.FUNCTION, filePath);
      const funcNode: GraphNode = {
        id: funcNodeId,
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
      const classNodeId = this.computeNodeId(cls.name, GraphNodeType.CLASS, filePath);
      const classNode: GraphNode = {
        id: classNodeId,
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

  private findClassWithProperty(propertyName: string, analysisResult: FileAnalysisResult): ClassInfo | undefined {
    // 查找包含特定属性的类
    for (const cls of analysisResult.classes) {
      if (cls.properties.some(prop => prop.name === propertyName)) {
        return cls;
      }
    }
    return undefined;
  }

  /**
   * 计算节点ID
   */
  private computeNodeId(name: string, type: GraphNodeType, filePath: string): string {
    // 使用文件路径和节点名称生成唯一ID
    const prefix = type.toLowerCase();
    const hash = this.simpleHash(`${filePath}_${name}`);
    return `${prefix}_${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    return ContentHashUtils.generateContentHash(str);
  }
}