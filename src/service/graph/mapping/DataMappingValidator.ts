import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import {
  GraphNode,
  GraphRelationship,
  GraphNodeType,
  GraphRelationshipType
} from './IGraphDataMappingService';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SchemaValidationRule {
  nodeType: GraphNodeType;
  requiredProperties: string[];
  optionalProperties?: string[];
  propertyValidators?: {
    [key: string]: (value: any) => boolean;
  };
}

@injectable()
export class DataMappingValidator {
  private logger: LoggerService;
  private schemaRules: SchemaValidationRule[] = [];

  constructor(@inject(TYPES.LoggerService) logger: LoggerService) {
    this.logger = logger;

    // 初始化默认验证规则
    this.initializeDefaultRules();
  }

  /**
   * 验证图节点
   */
  validateNode(node: GraphNode): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证节点ID
    if (!node.id || typeof node.id !== 'string') {
      errors.push('Node ID is required and must be a string');
    }

    // 验证节点类型
    if (!node.type || !Object.values(GraphNodeType).includes(node.type)) {
      errors.push(`Invalid node type: ${node.type}`);
    }

    // 验证节点属性
    if (!node.properties || typeof node.properties !== 'object') {
      errors.push('Node properties are required and must be an object');
    }

    // 根据节点类型应用特定规则
    const rule = this.schemaRules.find(r => r.nodeType === node.type);
    if (rule) {
      // 检查必需属性
      for (const prop of rule.requiredProperties) {
        if (!(prop in node.properties)) {
          errors.push(`Missing required property '${prop}' for node type ${node.type}`);
        }
      }

      // 验证属性值
      if (rule.propertyValidators) {
        for (const [prop, validator] of Object.entries(rule.propertyValidators)) {
          if (prop in node.properties && !validator(node.properties[prop])) {
            errors.push(`Property '${prop}' failed validation for node type ${node.type}`);
          }
        }
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    if (!result.isValid) {
      this.logger.warn('Node validation failed', {
        nodeId: node.id,
        errors: result.errors
      });
    }

    return result;
  }

  /**
   * 验证图关系
   */
  validateRelationship(relationship: GraphRelationship): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证关系ID
    if (!relationship.id || typeof relationship.id !== 'string') {
      errors.push('Relationship ID is required and must be a string');
    }

    // 验证关系类型
    if (!relationship.type || !Object.values(GraphRelationshipType).includes(relationship.type)) {
      errors.push(`Invalid relationship type: ${relationship.type}`);
    }

    // 验证源节点ID
    if (!relationship.fromNodeId || typeof relationship.fromNodeId !== 'string') {
      errors.push('Relationship fromNodeId is required and must be a string');
    }

    // 验证目标节点ID
    if (!relationship.toNodeId || typeof relationship.toNodeId !== 'string') {
      errors.push('Relationship toNodeId is required and must be a string');
    }

    // 验证关系属性
    if (!relationship.properties || typeof relationship.properties !== 'object') {
      errors.push('Relationship properties are required and must be an object');
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    if (!result.isValid) {
      this.logger.warn('Relationship validation failed', {
        relationshipId: relationship.id,
        errors: result.errors
      });
    }

    return result;
  }

  /**
   * 验证节点数组
   */
  validateNodes(nodes: GraphNode[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const node of nodes) {
      const result = this.validateNode(node);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证关系数组
   */
  validateRelationships(relationships: GraphRelationship[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const relationship of relationships) {
      const result = this.validateRelationship(relationship);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 验证整个图数据
   */
  validateGraphData(nodes: GraphNode[], relationships: GraphRelationship[]): ValidationResult {
    const nodeResult = this.validateNodes(nodes);
    const relationshipResult = this.validateRelationships(relationships);

    // 检查关系引用的节点是否存在
    const nodeIds = new Set(nodes.map(n => n.id));
    const relationshipErrors: string[] = [];

    for (const rel of relationships) {
      if (!nodeIds.has(rel.fromNodeId)) {
        relationshipErrors.push(`Source node ${rel.fromNodeId} does not exist for relationship ${rel.id}`);
      }
      if (!nodeIds.has(rel.toNodeId)) {
        relationshipErrors.push(`Target node ${rel.toNodeId} does not exist for relationship ${rel.id}`);
      }
    }

    return {
      isValid: nodeResult.isValid && relationshipResult.isValid && relationshipErrors.length === 0,
      errors: [...nodeResult.errors, ...relationshipResult.errors, ...relationshipErrors],
      warnings: [...nodeResult.warnings, ...relationshipResult.warnings]
    };
  }

  /**
   * 添加自定义验证规则
   */
  addValidationRule(rule: SchemaValidationRule): void {
    this.schemaRules.push(rule);
    this.logger.debug('Added validation rule', { nodeType: rule.nodeType });
  }

  /**
   * 移除验证规则
   */
  removeValidationRule(nodeType: GraphNodeType): void {
    this.schemaRules = this.schemaRules.filter(rule => rule.nodeType !== nodeType);
    this.logger.debug('Removed validation rule', { nodeType });
  }

  private initializeDefaultRules(): void {
    // 文件节点验证规则
    this.addValidationRule({
      nodeType: GraphNodeType.FILE,
      requiredProperties: ['name', 'path', 'language', 'size', 'lastModified', 'projectId'],
      propertyValidators: {
        size: (value: any) => typeof value === 'number' && value >= 0,
        lastModified: (value: any) => value instanceof Date || typeof value === 'string'
      }
    });

    // 函数节点验证规则
    this.addValidationRule({
      nodeType: GraphNodeType.FUNCTION,
      requiredProperties: ['name', 'signature', 'startLine', 'endLine', 'complexity', 'parentFileId'],
      propertyValidators: {
        startLine: (value: any) => typeof value === 'number' && value >= 0,
        endLine: (value: any) => typeof value === 'number' && value >= 0,
        complexity: (value: any) => typeof value === 'number' && value >= 0
      }
    });

    // 类节点验证规则
    this.addValidationRule({
      nodeType: GraphNodeType.CLASS,
      requiredProperties: ['name', 'methods', 'properties', 'parentFileId'],
      propertyValidators: {
        methods: (value: any) => Array.isArray(value),
        properties: (value: any) => Array.isArray(value)
      }
    });

    // 变量节点验证规则
    this.addValidationRule({
      nodeType: GraphNodeType.VARIABLE,
      requiredProperties: ['name', 'type', 'scope'],
      propertyValidators: {
        name: (value: any) => typeof value === 'string' && value.length > 0
      }
    });

    // 导入节点验证规则
    this.addValidationRule({
      nodeType: GraphNodeType.IMPORT,
      requiredProperties: ['name', 'path'],
      propertyValidators: {
        name: (value: any) => typeof value === 'string' && value.length > 0,
        path: (value: any) => typeof value === 'string' && value.length > 0
      }
    });
  }
}