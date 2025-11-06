import { GraphRelationshipType } from '../IGraphDataMappingService';

/**
 * 关系元数据处理器接口
 */
export interface IRelationshipMetadataProcessor {
  /**
   * 处理关系元数据
   * @param relationshipData 原始关系元数据
   * @returns 处理后的关系数据，包含sourceNodeId、targetNodeId和properties
   */
  processMetadata(relationshipData: any): {
    sourceNodeId: string;
    targetNodeId: string;
    properties: Record<string, any>;
  } | null;
}

/**
 * 处理结果接口
 */
export interface ProcessedRelationshipData {
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, any>;
}

/**
 * 注解关系元数据处理器
 */
export class AnnotationRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        annotationType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 调用关系元数据处理器
 */
export class CallRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.fromNodeId,
      targetNodeId: relationshipData.toNodeId,
      properties: {
        callName: relationshipData.callName,
        callType: relationshipData.callType,
        callContext: relationshipData.callContext,
        ...relationshipData
      }
    };
  }
}

/**
 * 创建关系元数据处理器
 */
export class CreationRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        creationType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 依赖关系元数据处理器
 */
export class DependencyRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        dependencyType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 引用关系元数据处理器
 */
export class ReferenceRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        referenceType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 并发关系元数据处理器
 */
export class ConcurrencyRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        concurrencyType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 生命周期关系元数据处理器
 */
export class LifecycleRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        lifecycleType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 语义关系元数据处理器
 */
export class SemanticRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        semanticType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 控制流关系元数据处理器
 */
export class ControlFlowRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        controlFlowType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 数据流关系元数据处理器
 */
export class DataFlowRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.fromNodeId,
      targetNodeId: relationshipData.toNodeId,
      properties: {
        flowType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 继承关系元数据处理器
 */
export class InheritanceRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        inheritanceType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}

/**
 * 实现关系元数据处理器
 */
export class ImplementsRelationshipProcessor implements IRelationshipMetadataProcessor {
  processMetadata(relationshipData: any): ProcessedRelationshipData | null {
    if (!relationshipData) return null;
    
    return {
      sourceNodeId: relationshipData.source,
      targetNodeId: relationshipData.target,
      properties: {
        implementsType: relationshipData.type,
        ...relationshipData
      }
    };
  }
}