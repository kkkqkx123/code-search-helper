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
import { TreeSitterService } from '../parser/core/parse/TreeSitterService';

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
  private treeSitterService: TreeSitterService;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.DataMappingValidator) validator: DataMappingValidator,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService
  ) {
    this.logger = logger;
    this.validator = validator;
    this.cache = cache;
    this.batchOptimizer = batchOptimizer;
    this.treeSitterService = treeSitterService;
    
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
      const callRels = await this.extractCallRelationships(analysisResult, fileContent);
      relationships.push(...callRels);
    }

    if (opts.includePropertyAccesses) {
      const propertyRels = await this.extractPropertyAccessRelationships(analysisResult, fileContent);
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
   * 提取调用关系
   */
  async extractCallRelationships(analysisResult: FileAnalysisResult, fileContent: string): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 在函数之间创建调用关系（这需要从AST中提取实际的调用信息）
    for (const func of analysisResult.functions) {
      // 获取调用者函数的ID
      const callerId = this.computeNodeId(func.name, GraphNodeType.FUNCTION, analysisResult.filePath);
      
      // 查找函数内部调用的其他函数
      const calledFunctions = await this.extractCalledFunctionsFromAST(func, analysisResult, fileContent);
      
      for (const calledFunc of calledFunctions) {
        // 计算被调用函数的ID
        const calleeId = this.computeNodeId(calledFunc, GraphNodeType.FUNCTION, analysisResult.filePath);
        
        relationships.push({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.CALLS,
          fromNodeId: callerId,
          toNodeId: calleeId,
          properties: {
            callType: 'function',
            created: new Date().toISOString()
          }
        });
      }
    }

    this.logger.debug('Extracted call relationships', { count: relationships.length });
    return relationships;
  }
  
  /**
   * 从函数AST中提取被调用的函数信息
   */
 private async extractCalledFunctionsFromAST(functionInfo: FunctionInfo, analysisResult: FileAnalysisResult, fileContent: string): Promise<string[]> {
    // 使用TreeSitterService来提取函数调用
    if (analysisResult.ast) {
      try {
        // 使用TreeSitterService查询函数调用表达式
        const callExpressions = this.treeSitterService.findNodeByType(analysisResult.ast, 'call_expression');
        
        const calledFunctions: string[] = [];
        for (const callExpr of callExpressions) {
          // 获取函数名部分，通常在call_expression的第一个子节点中
          if (callExpr.children && callExpr.children.length > 0) {
            const funcNameNode = callExpr.children[0];
            if (funcNameNode.type === 'identifier' || funcNameNode.type === 'member_expression') {
              // 如果是成员表达式（如obj.method()），提取方法名
              if (funcNameNode.type === 'member_expression') {
                const lastChild = funcNameNode.children[funcNameNode.children.length - 1];
                if (lastChild && lastChild.type === 'property_identifier') {
                  const propertyText = this.treeSitterService.getNodeText(lastChild, fileContent);
                  calledFunctions.push(propertyText);
                }
              } else {
                // 如果是简单标识符，直接使用节点文本
                const funcText = this.treeSitterService.getNodeText(funcNameNode, fileContent);
                calledFunctions.push(funcText);
              }
            }
          }
        }
        
        return calledFunctions;
      } catch (error) {
        this.logger.warn('Failed to extract function calls from AST', { error: (error as Error).message });
        // 如果提取失败，返回空数组
        return [];
      }
    }
    
    // 如果没有AST，返回空数组
    return [];
  }
  
  /**
   * 提取属性访问关系
   */
  async extractPropertyAccessRelationships(analysisResult: FileAnalysisResult, fileContent: string): Promise<GraphRelationship[]> {
    const relationships: GraphRelationship[] = [];

    // 提取函数中对类属性的访问关系
    for (const func of analysisResult.functions) {
      // 获取访问函数的ID
      const accessorId = this.computeNodeId(func.name, GraphNodeType.FUNCTION, analysisResult.filePath);
      
      const accessedProperties = await this.extractAccessedPropertiesFromAST(func, analysisResult, fileContent);
      
      for (const prop of accessedProperties) {
        // 查找属性所属的类
        const classWithProperty = this.findClassWithProperty(prop, analysisResult);
        if (classWithProperty) {
          const classId = this.computeNodeId(classWithProperty.name, GraphNodeType.CLASS, analysisResult.filePath);
          
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.USES,
            fromNodeId: accessorId,
            toNodeId: classId,
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
   * 从函数AST中提取被访问的属性信息
   */
  private async extractAccessedPropertiesFromAST(functionInfo: FunctionInfo, analysisResult: FileAnalysisResult, fileContent: string): Promise<string[]> {
    // 如果AST存在，使用TreeSitterService来提取属性访问
    if (analysisResult.ast) {
      try {
        // 使用TreeSitterService查询属性访问表达式
        const memberExpressions = this.treeSitterService.findNodeByType(analysisResult.ast, 'member_expression');
        
        const accessedProperties: string[] = [];
        for (const memberExpr of memberExpressions) {
          // 在member_expression中，属性名通常是最后一个子节点
          if (memberExpr.children && memberExpr.children.length > 0) {
            const lastChild = memberExpr.children[memberExpr.children.length - 1];
            if (lastChild && lastChild.type === 'property_identifier') {
              const propertyText = this.treeSitterService.getNodeText(lastChild, fileContent);
              accessedProperties.push(propertyText);
            }
          }
        }
        
        return accessedProperties;
      } catch (error) {
        this.logger.warn('Failed to extract property accesses from AST', { error: (error as Error).message });
        // 如果提取失败，返回空数组
        return [];
      }
    }
    
    // 如果没有AST，返回空数组
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
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
     const char = str.charCodeAt(i);
     hash = (hash << 5) - hash + char;
     hash = hash & hash; // Convert to 32bit integer
   }
   return Math.abs(hash).toString(36);
 }
}