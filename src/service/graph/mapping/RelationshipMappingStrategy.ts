import { GraphRelationship, GraphRelationshipType, GraphEdge } from './IGraphDataMappingService';
import {
  DataFlowRelationship,
  ControlFlowRelationship,
  SemanticRelationship,
  LifecycleRelationship,
  ConcurrencyRelationship,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship
} from './interfaces/IRelationshipExtractor';
import { v4 as uuidv4 } from 'uuid';

export class RelationshipMappingStrategy {
  private readonly TYPE_MAPPING = {
    // 基础关系映射
    'call': GraphRelationshipType.CALLS,
    'inheritance': GraphRelationshipType.INHERITS,
    'dependency': GraphRelationshipType.IMPORTS,
    'reference': GraphRelationshipType.USES,
    'creation': GraphRelationshipType.DEFINES,
    'annotation': GraphRelationshipType.USES,

    // 数据流关系映射
    'data_flow': GraphRelationshipType.DATA_FLOWS_TO,
    'parameter_flow': GraphRelationshipType.PARAMETER_PASSES_TO,
    'return_flow': GraphRelationshipType.RETURNS_TO,

    // 控制流关系映射
    'control_flow': GraphRelationshipType.CONTROLS,
    'exception_flow': GraphRelationshipType.HANDLES_EXCEPTION,
    'callback_flow': GraphRelationshipType.CALLBACKS,
    'async_await_flow': GraphRelationshipType.AWAITS,

    // 语义关系映射
    'overrides': GraphRelationshipType.OVERRIDES,
    'overloads': GraphRelationshipType.OVERLOADS,
    'delegates': GraphRelationshipType.DELEGATES_TO,
    'observes': GraphRelationshipType.OBSERVES,
    'configures': GraphRelationshipType.CONFIGURES,

    // 生命周期关系映射
    'instantiates': GraphRelationshipType.INSTANTIATES,
    'initializes': GraphRelationshipType.INITIALIZES,
    'destroys': GraphRelationshipType.DESTROYS,
    'manages': GraphRelationshipType.MANAGES_LIFECYCLE,

    // 并发关系映射
    'synchronizes': GraphRelationshipType.SYNCHRONIZES_WITH,
    'locks': GraphRelationshipType.LOCKS,
    'communicates': GraphRelationshipType.COMMUNICATES_WITH,
    'races': GraphRelationshipType.RACES_WITH,
    'awaits': GraphRelationshipType.AWAITS
  };

  mapToGraphRelationship(relationship: any): GraphEdge {
    let graphType: GraphRelationshipType;

    // Determine the relationship type based on the object structure
    if (this.isDataFlowRelationship(relationship)) {
      const dataFlowRel = relationship as DataFlowRelationship;
      graphType = this.TYPE_MAPPING[`${dataFlowRel.flowType}` as keyof typeof this.TYPE_MAPPING] ||
        GraphRelationshipType.DATA_FLOWS_TO;
    } else if (this.isControlFlowRelationship(relationship)) {
      const controlFlowRel = relationship as ControlFlowRelationship;
      const controlFlowKey = `${controlFlowRel.flowType}_flow` as keyof typeof this.TYPE_MAPPING;
      graphType = this.TYPE_MAPPING[controlFlowKey] || GraphRelationshipType.CONTROLS;
    } else if (this.isSemanticRelationship(relationship)) {
      const semanticRel = relationship as SemanticRelationship;
      graphType = this.TYPE_MAPPING[semanticRel.semanticType as keyof typeof this.TYPE_MAPPING] ||
        GraphRelationshipType.OVERRIDES; // Default to overrides for semantic relationships
    } else if (this.isLifecycleRelationship(relationship)) {
      const lifecycleRel = relationship as LifecycleRelationship;
      graphType = this.TYPE_MAPPING[lifecycleRel.lifecycleType as keyof typeof this.TYPE_MAPPING] ||
        GraphRelationshipType.INSTANTIATES; // Default to instantiates for lifecycle relationships
    } else if (this.isConcurrencyRelationship(relationship)) {
      const concurrencyRel = relationship as ConcurrencyRelationship;
      graphType = this.TYPE_MAPPING[concurrencyRel.concurrencyType as keyof typeof this.TYPE_MAPPING] ||
        GraphRelationshipType.SYNCHRONIZES_WITH; // Default to synchronizes for concurrency relationships
    } else if (this.isCallRelationship(relationship)) {
      graphType = GraphRelationshipType.CALLS;
    } else if (this.isInheritanceRelationship(relationship)) {
      graphType = GraphRelationshipType.INHERITS;
    } else if (this.isDependencyRelationship(relationship)) {
      graphType = GraphRelationshipType.IMPORTS;
    } else if (this.isReferenceRelationship(relationship)) {
      graphType = GraphRelationshipType.USES;
    } else if (this.isCreationRelationship(relationship)) {
      graphType = GraphRelationshipType.DEFINES;
    } else if (this.isAnnotationRelationship(relationship)) {
      graphType = GraphRelationshipType.USES;
    } else {
      graphType = GraphRelationshipType.USES; // default
    }

    return {
      id: uuidv4(),
      type: graphType,
      sourceNodeId: relationship.sourceId,
      targetNodeId: relationship.targetId,
      properties: {
        ...relationship,
        extractedAt: new Date().toISOString(),
        confidence: this.calculateConfidence(relationship)
      }
    };
  }

  private calculateConfidence(relationship: any): number {
    // Calculate confidence based on available information
    let confidence = 0.5; // default confidence

    // Increase confidence if symbol resolution is available
    if (relationship.resolvedSymbol ||
      relationship.resolvedSourceSymbol ||
      relationship.resolvedTargetSymbol ||
      relationship.resolvedParentSymbol ||
      relationship.resolvedChildSymbol ||
      relationship.resolvedAnnotationSymbol) {
      confidence = 0.8;
    }

    return confidence;
  }

  private isDataFlowRelationship(relationship: any): relationship is DataFlowRelationship {
    return 'flowType' in relationship &&
      'flowPath' in relationship &&
      'location' in relationship;
  }

  private isControlFlowRelationship(relationship: any): relationship is ControlFlowRelationship {
    return 'flowType' in relationship &&
      'isExceptional' in relationship &&
      'location' in relationship;
  }

  private isSemanticRelationship(relationship: any): relationship is SemanticRelationship {
    return 'semanticType' in relationship &&
      'metadata' in relationship &&
      'location' in relationship;
  }

  private isLifecycleRelationship(relationship: any): relationship is LifecycleRelationship {
    return 'lifecycleType' in relationship &&
      'lifecyclePhase' in relationship &&
      'location' in relationship;
  }

  private isConcurrencyRelationship(relationship: any): relationship is ConcurrencyRelationship {
    return 'concurrencyType' in relationship &&
      'location' in relationship;
  }

  private isCallRelationship(relationship: any): relationship is CallRelationship {
    return 'callerId' in relationship &&
      'calleeId' in relationship &&
      'callName' in relationship &&
      'location' in relationship;
  }

  private isInheritanceRelationship(relationship: any): relationship is InheritanceRelationship {
    return 'parentId' in relationship &&
      'childId' in relationship &&
      'inheritanceType' in relationship &&
      'location' in relationship;
  }

  private isDependencyRelationship(relationship: any): relationship is DependencyRelationship {
    return 'sourceId' in relationship &&
      'targetId' in relationship &&
      'dependencyType' in relationship &&
      'target' in relationship &&
      'location' in relationship;
  }

  private isReferenceRelationship(relationship: any): relationship is ReferenceRelationship {
    return 'sourceId' in relationship &&
      'targetId' in relationship &&
      'referenceType' in relationship &&
      'referenceName' in relationship &&
      'location' in relationship;
  }

  private isCreationRelationship(relationship: any): relationship is CreationRelationship {
    return 'sourceId' in relationship &&
      'targetId' in relationship &&
      'creationType' in relationship &&
      'targetName' in relationship &&
      'location' in relationship;
  }

  private isAnnotationRelationship(relationship: any): relationship is AnnotationRelationship {
    return 'sourceId' in relationship &&
      'targetId' in relationship &&
      'annotationType' in relationship &&
      'annotationName' in relationship &&
      'location' in relationship;
  }
}