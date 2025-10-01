import { GraphPersistenceOptions, GraphPersistenceResult, CodeGraphNode, CodeGraphRelationship } from './types';

export interface IGraphDataService {
  storeParsedFiles(
    files: any[],
    options?: GraphPersistenceOptions
 ): Promise<GraphPersistenceResult>;

  storeChunks(
    chunks: any[],
    options?: GraphPersistenceOptions
  ): Promise<GraphPersistenceResult>;

  findRelatedNodes(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth?: number
  ): Promise<CodeGraphNode[]>;

  findPath(
    sourceId: string,
    targetId: string,
    maxDepth?: number
 ): Promise<CodeGraphRelationship[]>;

  deleteNodes(nodeIds: string[]): Promise<boolean>;

  clearGraph(): Promise<boolean>;

  isServiceInitialized(): boolean;

  close(): Promise<void>;
  
  // Method to execute raw queries (needed for API routes)
  executeRawQuery(query: string, parameters?: Record<string, any>): Promise<any>;
}