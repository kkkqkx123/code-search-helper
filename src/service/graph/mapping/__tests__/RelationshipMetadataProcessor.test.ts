import {
  AnnotationRelationshipProcessor,
  CallRelationshipProcessor,
  CreationRelationshipProcessor,
  DependencyRelationshipProcessor,
  ReferenceRelationshipProcessor,
  ConcurrencyRelationshipProcessor,
  LifecycleRelationshipProcessor,
  SemanticRelationshipProcessor,
  ControlFlowRelationshipProcessor,
  DataFlowRelationshipProcessor,
  InheritanceRelationshipProcessor,
  ImplementsRelationshipProcessor
} from '../interfaces/IRelationshipMetadataProcessor';

describe('Relationship Metadata Processors', () => {
  describe('AnnotationRelationshipProcessor', () => {
    let processor: AnnotationRelationshipProcessor;

    beforeEach(() => {
      processor = new AnnotationRelationshipProcessor();
    });

    test('should process annotation metadata correctly', () => {
      const metadata = {
        source: 'node1',
        target: 'node2',
        type: 'struct_tag',
        content: 'deprecated'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'node1',
        targetNodeId: 'node2',
        properties: {
          annotationType: 'struct_tag',
          source: 'node1',
          target: 'node2',
          type: 'struct_tag',
          content: 'deprecated'
        }
      });
    });

    test('should return null for null metadata', () => {
      const result = processor.processMetadata(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined metadata', () => {
      const result = processor.processMetadata(undefined);
      expect(result).toBeNull();
    });
  });

  describe('CallRelationshipProcessor', () => {
    let processor: CallRelationshipProcessor;

    beforeEach(() => {
      processor = new CallRelationshipProcessor();
    });

    test('should process call metadata correctly', () => {
      const metadata = {
        fromNodeId: 'caller1',
        toNodeId: 'callee1',
        callName: 'testFunction',
        callType: 'function',
        callContext: {
          isChained: false,
          isAsync: false,
          chainDepth: 0
        }
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'caller1',
        targetNodeId: 'callee1',
        properties: {
          callName: 'testFunction',
          callType: 'function',
          callContext: {
            isChained: false,
            isAsync: false,
            chainDepth: 0
          },
          fromNodeId: 'caller1',
          toNodeId: 'callee1'
        }
      });
    });

    test('should return null for null metadata', () => {
      const result = processor.processMetadata(null);
      expect(result).toBeNull();
    });
  });

  describe('CreationRelationshipProcessor', () => {
    let processor: CreationRelationshipProcessor;

    beforeEach(() => {
      processor = new CreationRelationshipProcessor();
    });

    test('should process creation metadata correctly', () => {
      const metadata = {
        source: 'creator1',
        target: 'created1',
        type: 'struct_instance',
        location: {
          filePath: 'test.c',
          lineNumber: 10
        }
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'creator1',
        targetNodeId: 'created1',
        properties: {
          creationType: 'struct_instance',
          source: 'creator1',
          target: 'created1',
          type: 'struct_instance',
          location: {
            filePath: 'test.c',
            lineNumber: 10
          }
        }
      });
    });
  });

  describe('DependencyRelationshipProcessor', () => {
    let processor: DependencyRelationshipProcessor;

    beforeEach(() => {
      processor = new DependencyRelationshipProcessor();
    });

    test('should process dependency metadata correctly', () => {
      const metadata = {
        source: 'dependent1',
        target: 'dependency1',
        type: 'import',
        targetName: 'stdio.h'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'dependent1',
        targetNodeId: 'dependency1',
        properties: {
          dependencyType: 'import',
          source: 'dependent1',
          target: 'dependency1',
          targetName: 'stdio.h',
          type: 'import'
        }
      });
    });
  });

  describe('ReferenceRelationshipProcessor', () => {
    let processor: ReferenceRelationshipProcessor;

    beforeEach(() => {
      processor = new ReferenceRelationshipProcessor();
    });

    test('should process reference metadata correctly', () => {
      const metadata = {
        source: 'referrer1',
        target: 'referenced1',
        type: 'read',
        referenceName: 'variable1'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'referrer1',
        targetNodeId: 'referenced1',
        properties: {
          referenceType: 'read',
          source: 'referrer1',
          target: 'referenced1',
          type: 'read',
          referenceName: 'variable1'
        }
      });
    });
  });

  describe('ConcurrencyRelationshipProcessor', () => {
    let processor: ConcurrencyRelationshipProcessor;

    beforeEach(() => {
      processor = new ConcurrencyRelationshipProcessor();
    });

    test('should process concurrency metadata correctly', () => {
      const metadata = {
        source: 'thread1',
        target: 'mutex1',
        type: 'locks',
        synchronizationMechanism: 'pthread_mutex'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'thread1',
        targetNodeId: 'mutex1',
        properties: {
          concurrencyType: 'locks',
          source: 'thread1',
          target: 'mutex1',
          type: 'locks',
          synchronizationMechanism: 'pthread_mutex'
        }
      });
    });
  });

  describe('LifecycleRelationshipProcessor', () => {
    let processor: LifecycleRelationshipProcessor;

    beforeEach(() => {
      processor = new LifecycleRelationshipProcessor();
    });

    test('should process lifecycle metadata correctly', () => {
      const metadata = {
        source: 'manager1',
        target: 'resource1',
        type: 'manages',
        lifecyclePhase: 'creation'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'manager1',
        targetNodeId: 'resource1',
        properties: {
          lifecycleType: 'manages',
          source: 'manager1',
          target: 'resource1',
          type: 'manages',
          lifecyclePhase: 'creation'
        }
      });
    });
  });

  describe('SemanticRelationshipProcessor', () => {
    let processor: SemanticRelationshipProcessor;

    beforeEach(() => {
      processor = new SemanticRelationshipProcessor();
    });

    test('should process semantic metadata correctly', () => {
      const metadata = {
        source: 'override1',
        target: 'base1',
        type: 'overrides',
        pattern: 'template_method'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'override1',
        targetNodeId: 'base1',
        properties: {
          semanticType: 'overrides',
          source: 'override1',
          target: 'base1',
          type: 'overrides',
          pattern: 'template_method'
        }
      });
    });
  });

  describe('ControlFlowRelationshipProcessor', () => {
    let processor: ControlFlowRelationshipProcessor;

    beforeEach(() => {
      processor = new ControlFlowRelationshipProcessor();
    });

    test('should process control flow metadata correctly', () => {
      const metadata = {
        source: 'controller1',
        target: 'controlled1',
        type: 'conditional',
        condition: 'x > 0'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'controller1',
        targetNodeId: 'controlled1',
        properties: {
          controlFlowType: 'conditional',
          source: 'controller1',
          target: 'controlled1',
          type: 'conditional',
          condition: 'x > 0'
        }
      });
    });
  });

  describe('DataFlowRelationshipProcessor', () => {
    let processor: DataFlowRelationshipProcessor;

    beforeEach(() => {
      processor = new DataFlowRelationshipProcessor();
    });

    test('should process data flow metadata correctly', () => {
      const metadata = {
        fromNodeId: 'source1',
        toNodeId: 'target1',
        type: 'assignment',
        dataType: 'int'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'source1',
        targetNodeId: 'target1',
        properties: {
          flowType: 'assignment',
          fromNodeId: 'source1',
          toNodeId: 'target1',
          type: 'assignment',
          dataType: 'int'
        }
      });
    });
  });

  describe('InheritanceRelationshipProcessor', () => {
    let processor: InheritanceRelationshipProcessor;

    beforeEach(() => {
      processor = new InheritanceRelationshipProcessor();
    });

    test('should process inheritance metadata correctly', () => {
      const metadata = {
        source: 'child1',
        target: 'parent1',
        type: 'extends'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'child1',
        targetNodeId: 'parent1',
        properties: {
          inheritanceType: 'extends',
          source: 'child1',
          target: 'parent1',
          type: 'extends'
        }
      });
    });
  });

  describe('ImplementsRelationshipProcessor', () => {
    let processor: ImplementsRelationshipProcessor;

    beforeEach(() => {
      processor = new ImplementsRelationshipProcessor();
    });

    test('should process implements metadata correctly', () => {
      const metadata = {
        source: 'implementer1',
        target: 'interface1',
        type: 'implements'
      };

      const result = processor.processMetadata(metadata);

      expect(result).toEqual({
        sourceNodeId: 'implementer1',
        targetNodeId: 'interface1',
        properties: {
          implementsType: 'implements',
          source: 'implementer1',
          target: 'interface1',
          type: 'implements'
        }
      });
    });
  });
});