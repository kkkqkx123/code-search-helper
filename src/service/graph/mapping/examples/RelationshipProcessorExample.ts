import { StandardizedQueryResult } from '../../../parser/core/normalization/types';
import { GraphDataMappingService } from '../GraphDataMappingService';
import {
  CallRelationshipProcessor,
  InheritanceRelationshipProcessor,
  DependencyRelationshipProcessor,
  ReferenceRelationshipProcessor,
  CreationRelationshipProcessor,
  AnnotationRelationshipProcessor,
  DataFlowRelationshipProcessor,
  ControlFlowRelationshipProcessor,
  SemanticRelationshipProcessor,
  LifecycleRelationshipProcessor,
  ConcurrencyRelationshipProcessor,
  ImplementsRelationshipProcessor
} from '../interfaces/IRelationshipMetadataProcessor';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 关系元数据处理器使用示例
 * 展示如何使用新的标准化模块和关系元数据处理器替代ILanguageRelationshipExtractor
 */
export class RelationshipProcessorExample {
  private logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * 示例：处理调用关系
   */
  processCallRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new CallRelationshipProcessor();
    
    // 筛选出调用关系节点
    const callNodes = standardizedNodes.filter(node => node.type === 'call');
    
    for (const callNode of callNodes) {
      const relationshipData = callNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed call relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            callName: processedData.properties.callName,
            callType: processedData.properties.callType
          });
        }
      }
    }
  }

  /**
   * 示例：处理继承关系
   */
  processInheritanceRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new InheritanceRelationshipProcessor();
    
    // 筛选出继承关系节点
    const inheritanceNodes = standardizedNodes.filter(node => node.type === 'inheritance');
    
    for (const inheritanceNode of inheritanceNodes) {
      const relationshipData = inheritanceNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed inheritance relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            inheritanceType: processedData.properties.inheritanceType
          });
        }
      }
    }
  }

  /**
   * 示例：处理依赖关系
   */
  processDependencyRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new DependencyRelationshipProcessor();
    
    // 筛选出依赖关系节点
    const dependencyNodes = standardizedNodes.filter(node => node.type === 'dependency');
    
    for (const dependencyNode of dependencyNodes) {
      const relationshipData = dependencyNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed dependency relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            dependencyType: processedData.properties.dependencyType
          });
        }
      }
    }
  }

  /**
   * 示例：处理引用关系
   */
  processReferenceRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new ReferenceRelationshipProcessor();
    
    // 筛选出引用关系节点
    const referenceNodes = standardizedNodes.filter(node => node.type === 'reference');
    
    for (const referenceNode of referenceNodes) {
      const relationshipData = referenceNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed reference relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            referenceType: processedData.properties.referenceType,
            referenceName: processedData.properties.referenceName
          });
        }
      }
    }
  }

  /**
   * 示例：处理创建关系
   */
  processCreationRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new CreationRelationshipProcessor();
    
    // 筛选出创建关系节点
    const creationNodes = standardizedNodes.filter(node => node.type === 'creation');
    
    for (const creationNode of creationNodes) {
      const relationshipData = creationNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed creation relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            creationType: processedData.properties.creationType
          });
        }
      }
    }
  }

  /**
   * 示例：处理注解关系
   */
  processAnnotationRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new AnnotationRelationshipProcessor();
    
    // 筛选出注解关系节点
    const annotationNodes = standardizedNodes.filter(node => node.type === 'annotation');
    
    for (const annotationNode of annotationNodes) {
      const relationshipData = annotationNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed annotation relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            annotationType: processedData.properties.annotationType,
            annotationName: processedData.properties.annotationName
          });
        }
      }
    }
  }

  /**
   * 示例：处理数据流关系
   */
  processDataFlowRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new DataFlowRelationshipProcessor();
    
    // 筛选出数据流关系节点
    const dataFlowNodes = standardizedNodes.filter(node => node.type === 'data-flow');
    
    for (const dataFlowNode of dataFlowNodes) {
      const relationshipData = dataFlowNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed data flow relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            flowType: processedData.properties.flowType
          });
        }
      }
    }
  }

  /**
   * 示例：处理控制流关系
   */
  processControlFlowRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new ControlFlowRelationshipProcessor();
    
    // 筛选出控制流关系节点
    const controlFlowNodes = standardizedNodes.filter(node => node.type === 'control-flow');
    
    for (const controlFlowNode of controlFlowNodes) {
      const relationshipData = controlFlowNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed control flow relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            controlFlowType: processedData.properties.controlFlowType
          });
        }
      }
    }
  }

  /**
   * 示例：处理语义关系
   */
  processSemanticRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new SemanticRelationshipProcessor();
    
    // 筛选出语义关系节点
    const semanticNodes = standardizedNodes.filter(node => node.type === 'semantic');
    
    for (const semanticNode of semanticNodes) {
      const relationshipData = semanticNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed semantic relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            semanticType: processedData.properties.semanticType
          });
        }
      }
    }
  }

  /**
   * 示例：处理生命周期关系
   */
  processLifecycleRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new LifecycleRelationshipProcessor();
    
    // 筛选出生命周期关系节点
    const lifecycleNodes = standardizedNodes.filter(node => node.type === 'lifecycle');
    
    for (const lifecycleNode of lifecycleNodes) {
      const relationshipData = lifecycleNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed lifecycle relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            lifecycleType: processedData.properties.lifecycleType
          });
        }
      }
    }
  }

  /**
   * 示例：处理并发关系
   */
  processConcurrencyRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new ConcurrencyRelationshipProcessor();
    
    // 筛选出并发关系节点
    const concurrencyNodes = standardizedNodes.filter(node => node.type === 'concurrency');
    
    for (const concurrencyNode of concurrencyNodes) {
      const relationshipData = concurrencyNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed concurrency relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            concurrencyType: processedData.properties.concurrencyType
          });
        }
      }
    }
  }

  /**
   * 示例：处理实现关系
   */
  processImplementsRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    const processor = new ImplementsRelationshipProcessor();
    
    // 筛选出实现关系节点
    const implementsNodes = standardizedNodes.filter(node => node.type === 'implements');
    
    for (const implementsNode of implementsNodes) {
      const relationshipData = implementsNode.metadata.extra;
      if (relationshipData) {
        const processedData = processor.processMetadata(relationshipData);
        if (processedData) {
          this.logger.info('Processed implements relationship', {
            sourceNodeId: processedData.sourceNodeId,
            targetNodeId: processedData.targetNodeId,
            implementsType: processedData.properties.implementsType
          });
        }
      }
    }
  }

  /**
   * 完整示例：处理所有类型的关系
   */
  processAllRelationships(standardizedNodes: StandardizedQueryResult[]): void {
    this.logger.info('Processing all relationships using new metadata processors');
    
    // 处理各种类型的关系
    this.processCallRelationships(standardizedNodes);
    this.processInheritanceRelationships(standardizedNodes);
    this.processDependencyRelationships(standardizedNodes);
    this.processReferenceRelationships(standardizedNodes);
    this.processCreationRelationships(standardizedNodes);
    this.processAnnotationRelationships(standardizedNodes);
    this.processDataFlowRelationships(standardizedNodes);
    this.processControlFlowRelationships(standardizedNodes);
    this.processSemanticRelationships(standardizedNodes);
    this.processLifecycleRelationships(standardizedNodes);
    this.processConcurrencyRelationships(standardizedNodes);
    this.processImplementsRelationships(standardizedNodes);
    
    this.logger.info('Completed processing all relationships');
  }

  /**
   * 示例：与GraphDataMappingService集成使用
   */
  async integrateWithGraphMappingService(
    graphMappingService: GraphDataMappingService,
    filePath: string,
    standardizedNodes: StandardizedQueryResult[]
  ): Promise<void> {
    this.logger.info(`Integrating relationship processors with GraphDataMappingService for ${filePath}`);
    
    try {
      // 使用GraphDataMappingService进行图映射
      const graphResult = await graphMappingService.mapToGraph(filePath, standardizedNodes);
      
      this.logger.info('Graph mapping completed', {
        nodeCount: graphResult.nodes.length,
        edgeCount: graphResult.edges.length
      });
      
      // 处理关系（可选，用于额外的分析或日志记录）
      this.processAllRelationships(standardizedNodes);
      
    } catch (error) {
      this.logger.error('Failed to integrate with GraphDataMappingService', { error });
    }
  }
}