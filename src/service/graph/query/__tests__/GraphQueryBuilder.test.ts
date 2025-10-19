import { GraphQueryBuilder } from '../GraphQueryBuilder';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { NebulaQueryBuilder } from '../../../../database/nebula/query/NebulaQueryBuilder';

// Mock dependencies
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandlerService = {
  handleError: jest.fn(),
  createError: jest.fn(),
};

const mockConfigService = {
  get: jest.fn(),
  has: jest.fn(),
};

const mockNebulaQueryBuilder = {
  buildQuery: jest.fn(),
};

describe('GraphQueryBuilder', () => {
  let graphQueryBuilder: GraphQueryBuilder;

  beforeEach(() => {
    graphQueryBuilder = new GraphQueryBuilder(
      mockLoggerService as unknown as LoggerService,
      mockErrorHandlerService as unknown as ErrorHandlerService,
      mockConfigService as unknown as ConfigService,
      mockNebulaQueryBuilder as unknown as NebulaQueryBuilder
    );
  });

  describe('buildNodeCountQuery', () => {
    it('should build a correct node count query', () => {
      const tag = 'TestClass';
      const result = graphQueryBuilder.buildNodeCountQuery(tag);
      
      expect(result.nGQL).toContain(`LOOKUP ON \`${tag}\``);
      expect(result.nGQL).toContain('YIELD vertex AS node');
      expect(result.nGQL).toContain('count($-.node) AS total');
      expect(result.parameters).toEqual({});
    });
  });

 describe('buildRelationshipCountQuery', () => {
    it('should build a correct relationship count query', () => {
      const edgeType = 'TestClass';
      const result = graphQueryBuilder.buildRelationshipCountQuery(edgeType);
      
      expect(result.nGQL).toContain(`LOOKUP ON \`${edgeType}\``);
      expect(result.nGQL).toContain('YIELD edge AS rel');
      expect(result.nGQL).toContain('count($-.rel) AS total');
      expect(result.parameters).toEqual({});
    });
  });

  describe('buildNodeSearchQuery', () => {
    it('should build a search query for a specific node type', () => {
      const searchTerm = 'test';
      const nodeType = 'TestClass';
      const result = graphQueryBuilder.buildNodeSearchQuery(searchTerm, nodeType);
      
      expect(result.nGQL).toContain(`LOOKUP ON \`${nodeType}\``);
      expect(result.nGQL).toContain(`name CONTAINS "${searchTerm}"`);
      expect(result.nGQL).toContain(`content CONTAINS "${searchTerm}"`);
      expect(result.nGQL).toContain('LIMIT 10');
      expect(result.parameters).toEqual({ searchTerm });
    });

    it('should build a search query across all node types', () => {
      const searchTerm = 'test';
      const result = graphQueryBuilder.buildNodeSearchQuery(searchTerm);
      
      expect(result.nGQL).toContain('LOOKUP ON *');
      expect(result.nGQL).toContain(`* CONTAINS "${searchTerm}"`);
      expect(result.nGQL).toContain('LIMIT 10');
      expect(result.parameters).toEqual({ searchTerm });
    });
  });

  describe('buildRelationshipSearchQuery', () => {
    it('should build a correct relationship search query', () => {
      const relationshipType = 'TestClass';
      const result = graphQueryBuilder.buildRelationshipSearchQuery(relationshipType);
      
      expect(result.nGQL).toContain(`MATCH ()-[r:\`${relationshipType}\`]->()`);
      expect(result.nGQL).toContain('RETURN r');
      expect(result.nGQL).toContain('LIMIT 10');
      expect(result.parameters).toEqual({ relationshipType });
    });
 });

  describe('buildPathQuery', () => {
    it('should build a correct path query with default max depth', () => {
      const sourceId = 'source123';
      const targetId = 'target456';
      const result = graphQueryBuilder.buildPathQuery(sourceId, targetId);
      
      expect(result.nGQL).toContain(`FROM "${sourceId}" TO "${targetId}"`);
      expect(result.nGQL).toContain('UPTO 5 STEPS');
      expect(result.parameters).toEqual({ sourceId, targetId, maxDepth: 5 });
    });

    it('should build a correct path query with custom max depth', () => {
      const sourceId = 'source123';
      const targetId = 'target456';
      const maxDepth = 3;
      const result = graphQueryBuilder.buildPathQuery(sourceId, targetId, maxDepth);
      
      expect(result.nGQL).toContain(`FROM "${sourceId}" TO "${targetId}"`);
      expect(result.nGQL).toContain('UPTO 3 STEPS');
      expect(result.parameters).toEqual({ sourceId, targetId, maxDepth });
    });
  });

  describe('buildDependencyQuery', () => {
    it('should build a correct outgoing dependency query with default depth', () => {
      const fileId = 'file123';
      const result = graphQueryBuilder.buildDependencyQuery(fileId);
      
      expect(result.nGQL).toContain(`FROM "${fileId}"`);
      expect(result.nGQL).toContain('IMPORTS, CALLS');
      expect(result.nGQL).toContain('LIMIT 50');
      expect(result.parameters).toEqual({ fileId, depth: 3 });
    });

    it('should build a correct incoming dependency query', () => {
      const fileId = 'file123';
      const direction: 'incoming' | 'outgoing' = 'incoming';
      const result = graphQueryBuilder.buildDependencyQuery(fileId, direction);
      
      expect(result.nGQL).toContain(`FROM "${fileId}"`);
      expect(result.nGQL).toContain('IMPORTS_REVERSE, CALLS_REVERSE');
      expect(result.parameters).toEqual({ fileId, depth: 3 });
    });

    it('should build a correct dependency query with custom depth', () => {
      const fileId = 'file123';
      const direction: 'incoming' | 'outgoing' = 'outgoing';
      const depth = 5;
      const result = graphQueryBuilder.buildDependencyQuery(fileId, direction, depth);
      
      expect(result.nGQL).toContain(`FROM "${fileId}"`);
      expect(result.nGQL).toContain('IMPORTS, CALLS');
      expect(result.parameters).toEqual({ fileId, depth });
    });
  });

  describe('buildCodeStructureQuery', () => {
    it('should build a correct code structure query', () => {
      const fileId = 'file123';
      const result = graphQueryBuilder.buildCodeStructureQuery(fileId);
      
      expect(result.nGQL).toContain(`(f:File {id: "${fileId}"})-[:CONTAINS]->(child)`);
      expect(result.nGQL).toContain('RETURN f, child');
      expect(result.nGQL).toContain('LIMIT 100');
      expect(result.parameters).toEqual({ fileId });
    });
  });

  describe('buildImportQuery', () => {
    it('should build a correct import query', () => {
      const fileId = 'file123';
      const result = graphQueryBuilder.buildImportQuery(fileId);
      
      expect(result.nGQL).toContain(`FROM "${fileId}" OVER IMPORTS`);
      expect(result.nGQL).toContain('LIMIT 20');
      expect(result.parameters).toEqual({ fileId });
    });
  });

  describe('buildCallQuery', () => {
    it('should build a correct call query', () => {
      const functionId = 'func123';
      const result = graphQueryBuilder.buildCallQuery(functionId);
      
      expect(result.nGQL).toContain(`FROM "${functionId}" OVER CALLS`);
      expect(result.nGQL).toContain('LIMIT 20');
      expect(result.parameters).toEqual({ functionId });
    });
  });

  describe('buildComplexTraversal', () => {
    it('should build a correct complex traversal query', () => {
      const startId = 'start123';
      const edgeTypes = ['IMPORTS', 'CALLS'];
      const options = { maxDepth: 2, limit: 5 };
      const result = graphQueryBuilder.buildComplexTraversal(startId, edgeTypes, options);
      
      expect(result.nGQL).toContain(`FROM "${startId}" OVER ${edgeTypes.join(',')}`);
      expect(result.nGQL).toContain('2 STEPS');
      expect(result.nGQL).toContain('LIMIT 5');
      expect(result.parameters).toEqual({ startId });
    });

    it('should handle empty edge types', () => {
      const startId = 'start123';
      const edgeTypes: string[] = [];
      const result = graphQueryBuilder.buildComplexTraversal(startId, edgeTypes);
      
      expect(result.nGQL).toContain(`FROM "${startId}" OVER *`);
      expect(result.parameters).toEqual({ startId });
    });
  });

  describe('buildCommunityDetectionQuery', () => {
    it('should build a correct community detection query with default options', () => {
      const result = graphQueryBuilder.buildCommunityDetectionQuery();
      
      expect(result.nGQL).toContain('GET SUBGRAPH WITH PROP FROM 2');
      expect(result.nGQL).toContain('STEPS FROM "*"');
      expect(result.parameters).toEqual({ limit: 10, minCommunitySize: 2, maxIterations: 10 });
    });

    it('should build a correct community detection query with custom options', () => {
      const options = { limit: 5, minCommunitySize: 3, maxIterations: 15 };
      const result = graphQueryBuilder.buildCommunityDetectionQuery(options);
      
      expect(result.nGQL).toContain('GET SUBGRAPH WITH PROP FROM 3');
      expect(result.nGQL).toContain('LIMIT 5');
      expect(result.parameters).toEqual(options);
    });
  });

  describe('buildPageRankQuery', () => {
    it('should build a correct PageRank query with default options', () => {
      const result = graphQueryBuilder.buildPageRankQuery();
      
      expect(result.nGQL).toContain('GET SUBGRAPH FROM "*"');
      expect(result.parameters).toEqual({ limit: 10, iterations: 20, dampingFactor: 0.85 });
    });

    it('should build a correct PageRank query with custom options', () => {
      const options = { limit: 5, iterations: 15, dampingFactor: 0.9 };
      const result = graphQueryBuilder.buildPageRankQuery(options);
      
      expect(result.nGQL).toContain('LIMIT 5');
      expect(result.parameters).toEqual(options);
    });
  });

  describe('buildCodeAnalysisQuery', () => {
    it('should build a correct code analysis query with default options', () => {
      const projectId = 'project123';
      const result = graphQueryBuilder.buildCodeAnalysisQuery(projectId);
      
      expect(result.nGQL).toContain(`FROM "${projectId}" OVER IMPORTS,CALLS,EXTENDS,CONTAINS,BELONGS_TO`);
      expect(result.parameters).toEqual({ projectId, depth: 3 });
    });

    it('should build a correct code analysis query with dependencies focus', () => {
      const projectId = 'project123';
      const options = { depth: 2, focus: 'dependencies' as const };
      const result = graphQueryBuilder.buildCodeAnalysisQuery(projectId, options);
      
      expect(result.nGQL).toContain(`FROM "${projectId}" OVER IMPORTS,CALLS`);
      expect(result.parameters).toEqual({ projectId, depth: 2 });
    });

    it('should build a correct code analysis query with imports focus', () => {
      const projectId = 'project123';
      const options = { depth: 2, focus: 'imports' as const };
      const result = graphQueryBuilder.buildCodeAnalysisQuery(projectId, options);
      
      expect(result.nGQL).toContain(`FROM "${projectId}" OVER IMPORTS`);
      expect(result.parameters).toEqual({ projectId, depth: 2 });
    });

    it('should build a correct code analysis query with classes focus', () => {
      const projectId = 'project123';
      const options = { depth: 2, focus: 'classes' as const };
      const result = graphQueryBuilder.buildCodeAnalysisQuery(projectId, options);
      
      expect(result.nGQL).toContain(`FROM "${projectId}" OVER EXTENDS,CONTAINS`);
      expect(result.parameters).toEqual({ projectId, depth: 2 });
    });

    it('should build a correct code analysis query with functions focus', () => {
      const projectId = 'project123';
      const options = { depth: 2, focus: 'functions' as const };
      const result = graphQueryBuilder.buildCodeAnalysisQuery(projectId, options);
      
      expect(result.nGQL).toContain(`FROM "${projectId}" OVER CALLS,CONTAINS`);
      expect(result.parameters).toEqual({ projectId, depth: 2 });
    });
  });
});