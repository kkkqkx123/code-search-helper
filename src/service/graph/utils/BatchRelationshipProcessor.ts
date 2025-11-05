import { AnnotationRelationship, CallRelationship, ConcurrencyRelationship, ControlFlowRelationship, CreationRelationship, DataFlowRelationship, DependencyRelationship, ILanguageRelationshipExtractor, InheritanceRelationship, LifecycleRelationship, ReferenceRelationship, SemanticRelationship } from '../mapping/interfaces/IRelationshipExtractor';
import { SymbolResolver } from '../symbol/SymbolResolver';
import { DynamicParserManager } from '../../parser/core/parse/DynamicParserManager';

export interface RelationshipExtractionResult {
  filePath: string;
  relationships: any[];
  error?: Error;
}

export interface BatchExtractionOptions {
  batchSize?: number;
  concurrency?: number;
  cacheEnabled?: boolean;
}

export class BatchRelationshipProcessor {
  private parserService: DynamicParserManager;
  private symbolResolver: SymbolResolver;

  constructor(parserService: DynamicParserManager, symbolResolver: SymbolResolver) {
    this.parserService = parserService;
    this.symbolResolver = symbolResolver;
  }

  async processRelationshipsInBatches(
    extractors: ILanguageRelationshipExtractor[],
    files: string[],
    options: BatchExtractionOptions = {}
  ): Promise<RelationshipExtractionResult[]> {
    const {
      batchSize = 10,
      concurrency = 1,
      cacheEnabled = true
    } = options;

    const results: RelationshipExtractionResult[] = [];

    // Process files in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      // Process batch with concurrency control
      const batchResults = await this.processBatch(extractors, batch, concurrency, cacheEnabled);
      results.push(...batchResults);
    }

    return results;
  }

  private async processBatch(
    extractors: ILanguageRelationshipExtractor[],
    files: string[],
    concurrency: number,
    cacheEnabled: boolean
  ): Promise<RelationshipExtractionResult[]> {
    if (concurrency === 1) {
      // Sequential processing
      const results: RelationshipExtractionResult[] = [];
      for (const file of files) {
        const result = await this.processFile(extractors, file, cacheEnabled);
        results.push(result);
      }
      return results;
    } else {
      // Concurrent processing with limited concurrency
      const results: RelationshipExtractionResult[] = [];
      const promises: Promise<RelationshipExtractionResult>[] = [];

      for (const file of files) {
        const promise = this.processFile(extractors, file, cacheEnabled);
        promises.push(promise);

        if (promises.length >= concurrency) {
          const batchResults = await Promise.all(promises);
          results.push(...batchResults);
          promises.length = 0; // Clear the array
        }
      }

      // Process remaining promises
      if (promises.length > 0) {
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }

      return results;
    }
  }

  private async processFile(
    extractors: ILanguageRelationshipExtractor[],
    filePath: string,
    cacheEnabled: boolean
  ): Promise<RelationshipExtractionResult> {
    try {
      // Read the file content
      const fs = require('fs');
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Parse the file AST
      const parseResult = await this.parserService.parseFile(filePath, content);
      if (!parseResult.success || !parseResult.ast) {
        return {
          filePath,
          relationships: [],
          error: new Error(`Failed to parse file: ${filePath}, error: ${parseResult.error}`)
        };
      }

      const ast = parseResult.ast;

      // Find appropriate extractor for the file
      const fileExtension = this.getFileExtension(filePath);
      const extractor = this.findExtractorForLanguage(extractors, fileExtension);

      if (!extractor) {
        return {
          filePath,
          relationships: [],
          error: new Error(`No extractor found for language: ${fileExtension}`)
        };
      }

      // Process all relationship types using the extractor
      const allRelationships: any[] = [];

      // Extract existing relationship types
      // Build the symbol table for the file
      await this.symbolResolver.buildSymbolTable(filePath, ast, extractor.getSupportedLanguage());

      // Extract all supported relationship types
      const supportedTypes = extractor.getSupportedRelationshipTypes();

      for (const relType of supportedTypes) {
        try {
          let relationships: CallRelationship[] | InheritanceRelationship[] | DependencyRelationship[] | ReferenceRelationship[] | CreationRelationship[] | AnnotationRelationship[] | DataFlowRelationship[] | ControlFlowRelationship[] | SemanticRelationship[] | LifecycleRelationship[] | ConcurrencyRelationship[] = [];
          switch (relType) {
            case 'call':
              relationships = await extractor.extractCallRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'inheritance':
              relationships = await extractor.extractInheritanceRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'dependency':
              relationships = await extractor.extractDependencyRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'reference':
              relationships = await extractor.extractReferenceRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'creation':
              relationships = await extractor.extractCreationRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'annotation':
              relationships = await extractor.extractAnnotationRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'data_flow':
              relationships = await extractor.extractDataFlowRelationships(ast, filePath);
              break;
            case 'control_flow':
              relationships = await extractor.extractControlFlowRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'semantic':
              relationships = await extractor.extractSemanticRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'lifecycle':
              relationships = await extractor.extractLifecycleRelationships(ast, filePath, this.symbolResolver);
              break;
            case 'concurrency':
              relationships = await extractor.extractConcurrencyRelationships(ast, filePath, this.symbolResolver);
              break;
            default:
              // Skip unknown relationship types
              break;
          }

          allRelationships.push(...relationships);
        } catch (error) {
          console.warn(`Error extracting ${relType} relationships from ${filePath}:`, error);
        }
      }

      return {
        filePath,
        relationships: allRelationships
      };
    } catch (error) {
      return {
        filePath,
        relationships: [],
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 0 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private findExtractorForLanguage(
    extractors: ILanguageRelationshipExtractor[],
    fileExtension: string
  ): ILanguageRelationshipExtractor | null {
    // Map file extensions to language names
    const extensionToLanguage: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'rs': 'rust',
      'go': 'go',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'kt': 'kotlin',
      'css': 'css',
      'html': 'html',
      'vue': 'vue'
    };

    const language = extensionToLanguage[fileExtension] || fileExtension;

    return extractors.find(extractor => extractor.getSupportedLanguage() === language) || null;
  }
}