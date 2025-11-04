import { DataFlowRelationship, ControlFlowRelationship, SemanticRelationship, LifecycleRelationship, ConcurrencyRelationship, CallRelationship, InheritanceRelationship, DependencyRelationship, ReferenceRelationship, CreationRelationship, AnnotationRelationship } from '../mapping/interfaces/IRelationshipExtractor';

export interface RelationshipExtractionCacheEntry {
  relationships: Array<
    DataFlowRelationship | 
    ControlFlowRelationship | 
    SemanticRelationship | 
    LifecycleRelationship | 
    ConcurrencyRelationship | 
    CallRelationship | 
    InheritanceRelationship | 
    DependencyRelationship | 
    ReferenceRelationship | 
    CreationRelationship | 
    AnnotationRelationship
  >;
  timestamp: number;
  fileHash: string;
}

export class RelationshipExtractionCache {
  private cache = new Map<string, RelationshipExtractionCacheEntry>();
  private maxSize: number;
  private ttl: number; // time to live in milliseconds

  constructor(maxSize: number = 1000, ttl: number = 3600000) { // 1 hour default TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  async getCachedRelationships(
    filePath: string,
    fileHash: string,
    relationshipType: string
  ): Promise<any[] | null> {
    const key = `${filePath}_${relationshipType}`;
    const cachedEntry = this.cache.get(key);

    if (cachedEntry && 
        cachedEntry.fileHash === fileHash && 
        Date.now() - cachedEntry.timestamp < this.ttl) {
      return cachedEntry.relationships;
    }

    // Remove expired or outdated entries
    if (cachedEntry && (cachedEntry.fileHash !== fileHash || Date.now() - cachedEntry.timestamp >= this.ttl)) {
      this.cache.delete(key);
    }

    return null;
  }

  async cacheRelationships(
    filePath: string,
    fileHash: string,
    relationshipType: string,
    relationships: any[]
  ): Promise<void> {
    const key = `${filePath}_${relationshipType}`;

    // Check if we need to remove the oldest entry to maintain size limit
    if (this.cache.size >= this.maxSize) {
      // Remove the oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      relationships,
      fileHash,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  removeCacheEntry(filePath: string, relationshipType: string): void {
    const key = `${filePath}_${relationshipType}`;
    this.cache.delete(key);
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}