import { createHash } from 'crypto';
import { injectable } from 'inversify';
import { CodeChunk } from '../parser/types';

export interface DeduplicationResult {
  uniqueChunks: CodeChunk[];
  duplicateChunks: CodeChunk[];
  duplicateCount: number;
  savedSpace: number;
  processingTime: number;
}

export interface DeduplicationOptions {
  algorithm: 'exact' | 'fuzzy' | 'semantic';
  similarityThreshold?: number;
  ignoreWhitespace?: boolean;
  ignoreComments?: boolean;
  normalizeIdentifiers?: boolean;
  minChunkSize?: number;
}

@injectable()
export class HashBasedDeduplicator {
  private exactHashCache: Map<string, string> = new Map();
  private fuzzyHashCache: Map<string, string> = new Map();

  constructor() { }

  async deduplicateChunks(
    chunks: CodeChunk[],
    options?: Partial<DeduplicationOptions>
  ): Promise<DeduplicationResult> {
    const startTime = Date.now();
    const dedupOptions: Required<DeduplicationOptions> = {
      algorithm: options?.algorithm ?? 'exact',
      similarityThreshold: options?.similarityThreshold ?? 0.95,
      ignoreWhitespace: options?.ignoreWhitespace ?? true,
      ignoreComments: options?.ignoreComments ?? true,
      normalizeIdentifiers: options?.normalizeIdentifiers ?? false,
      minChunkSize: options?.minChunkSize ?? 50,
    };

    const result: DeduplicationResult = {
      uniqueChunks: [],
      duplicateChunks: [],
      duplicateCount: 0,
      savedSpace: 0,
      processingTime: 0,
    };

    switch (dedupOptions.algorithm) {
      case 'exact':
        result.uniqueChunks = await this.exactDeduplication(chunks, result, dedupOptions);
        break;
      case 'fuzzy':
        result.uniqueChunks = await this.fuzzyDeduplication(chunks, result, dedupOptions);
        break;
      case 'semantic':
        result.uniqueChunks = await this.semanticDeduplication(chunks, result, dedupOptions);
        break;
    }

    result.processingTime = Date.now() - startTime;
    return result;
  }

  private async exactDeduplication(
    chunks: CodeChunk[],
    result: DeduplicationResult,
    options: Required<DeduplicationOptions>
  ): Promise<CodeChunk[]> {
    const seenHashes = new Set<string>();
    const uniqueChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length < options.minChunkSize) {
        uniqueChunks.push(chunk);
        continue;
      }

      const processedContent = this.preprocessContent(chunk.content, options);
      const hash = this.generateExactHash(processedContent);

      if (seenHashes.has(hash)) {
        result.duplicateChunks.push(chunk);
        result.duplicateCount++;
        result.savedSpace += chunk.content.length;
      } else {
        seenHashes.add(hash);
        uniqueChunks.push(chunk);
      }
    }

    return uniqueChunks;
  }

  private async fuzzyDeduplication(
    chunks: CodeChunk[],
    result: DeduplicationResult,
    options: Required<DeduplicationOptions>
  ): Promise<CodeChunk[]> {
    const uniqueChunks: CodeChunk[] = [];
    const processedChunks = chunks.map(chunk => ({
      original: chunk,
      processed: this.preprocessContent(chunk.content, options),
      fuzzyHash: this.generateFuzzyHash(this.preprocessContent(chunk.content, options)),
    }));

    for (let i = 0; i < processedChunks.length; i++) {
      const current = processedChunks[i];

      if (current.original.content.length < options.minChunkSize) {
        uniqueChunks.push(current.original);
        continue;
      }

      let isDuplicate = false;

      for (let j = 0; j < uniqueChunks.length; j++) {
        const existing = uniqueChunks[j];
        const existingProcessed = this.preprocessContent(existing.content, options);

        const similarity = this.calculateSimilarity(current.processed, existingProcessed);

        if (similarity >= options.similarityThreshold) {
          result.duplicateChunks.push(current.original);
          result.duplicateCount++;
          result.savedSpace += current.original.content.length;
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueChunks.push(current.original);
      }
    }

    return uniqueChunks;
  }

  private async semanticDeduplication(
    chunks: CodeChunk[],
    result: DeduplicationResult,
    options: Required<DeduplicationOptions>
  ): Promise<CodeChunk[]> {
    const uniqueChunks: CodeChunk[] = [];
    const semanticHashes = new Map<string, CodeChunk[]>();

    for (const chunk of chunks) {
      if (chunk.content.length < options.minChunkSize) {
        uniqueChunks.push(chunk);
        continue;
      }

      const semanticHash = this.generateSemanticHash(chunk, options);

      if (semanticHashes.has(semanticHash)) {
        const similarChunks = semanticHashes.get(semanticHash)!;
        let isDuplicate = false;

        for (const existingChunk of similarChunks) {
          const similarity = this.calculateSemanticSimilarity(chunk, existingChunk);

          if (similarity >= options.similarityThreshold) {
            result.duplicateChunks.push(chunk);
            result.duplicateCount++;
            result.savedSpace += chunk.content.length;
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          similarChunks.push(chunk);
          uniqueChunks.push(chunk);
        }
      } else {
        semanticHashes.set(semanticHash, [chunk]);
        uniqueChunks.push(chunk);
      }
    }

    return uniqueChunks;
  }

  private preprocessContent(content: string, options: Required<DeduplicationOptions>): string {
    let processed = content;

    if (options.ignoreWhitespace) {
      processed = processed.replace(/\s+/g, ' ').trim();
    }

    if (options.ignoreComments) {
      processed = this.removeComments(processed);
    }

    if (options.normalizeIdentifiers) {
      processed = this.normalizeIdentifiers(processed);
    }

    return processed;
  }

  private removeComments(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove Python-style comments
    content = content.replace(/#.*$/gm, '');

    return content.trim();
  }

  private normalizeIdentifiers(content: string): string {
    // Replace variable names with generic placeholders
    return content
      .replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, 'VAR')
      .replace(/\b\d+\b/g, 'NUM')
      .replace(/["'`][^"'`]*["'`]/g, 'STRING')
      .replace(/\/[^\/]*\//g, 'REGEX');
  }

  private generateExactHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private generateFuzzyHash(content: string): string {
    // SimHash-like approach for fuzzy matching
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
    const wordFreq = new Map<string, number>();

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    const sortedWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return createHash('md5').update(sortedWords.join(' ')).digest('hex');
  }

  private generateSemanticHash(chunk: CodeChunk, options: Required<DeduplicationOptions>): string {
    const features = this.extractSemanticFeatures(chunk, options);
    const featureString = JSON.stringify(features, Object.keys(features).sort());

    return createHash('sha256').update(featureString).digest('hex');
  }

  private extractSemanticFeatures(
    chunk: CodeChunk,
    options: Required<DeduplicationOptions>
  ): Record<string, any> {
    const content = this.preprocessContent(chunk.content, options);

    return {
      type: chunk.type,
      lineCount: chunk.endLine - chunk.startLine + 1,
      avgLineLength: content.length / Math.max(1, chunk.endLine - chunk.startLine + 1),
      hasLoops: /\b(for|while|do)\b/i.test(content),
      hasConditionals: /\b(if|else|switch|case)\b/i.test(content),
      hasFunctions: /\b(function|def|func|=>)\b/i.test(content),
      hasClasses: /\b(class|interface|struct)\b/i.test(content),
      hasReturns: /\b(return|yield)\b/i.test(content),
      hasExceptions: /\b(try|catch|throw|except)\b/i.test(content),
      bracketCount: (content.match(/[{}]/g) || []).length,
      parenthesisCount: (content.match(/[()]/g) || []).length,
      semicolonCount: (content.match(/;/g) || []).length,
      complexity: this.calculateComplexity(content),
    };
  }

  private calculateComplexity(content: string): number {
    let complexity = 1;

    // Count control flow statements
    const controlFlow = /\b(if|else|elif|for|while|do|switch|case|try|catch|except|finally)\b/gi;
    const matches = content.match(controlFlow);
    if (matches) {
      complexity += matches.length;
    }

    // Count logical operators
    const logicalOps = /(&&|\|\||and|or|\?|\?\.)/g;
    const logicalMatches = content.match(logicalOps);
    if (logicalMatches) {
      complexity += logicalMatches.length * 0.5;
    }

    return Math.round(complexity);
  }

  private calculateSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateSemanticSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): number {
    const features1 = this.extractSemanticFeatures(chunk1, {
      algorithm: 'semantic',
      similarityThreshold: 0.95,
      ignoreWhitespace: true,
      ignoreComments: true,
      normalizeIdentifiers: false,
      minChunkSize: 50,
    });

    const features2 = this.extractSemanticFeatures(chunk2, {
      algorithm: 'semantic',
      similarityThreshold: 0.95,
      ignoreWhitespace: true,
      ignoreComments: true,
      normalizeIdentifiers: false,
      minChunkSize: 50,
    });

    const similarities: number[] = [];

    // Compare numeric features
    const numericFeatures = [
      'lineCount',
      'avgLineLength',
      'bracketCount',
      'parenthesisCount',
      'semicolonCount',
      'complexity',
    ];
    for (const feature of numericFeatures) {
      const val1 = features1[feature] as number;
      const val2 = features2[feature] as number;
      const maxVal = Math.max(val1, val2);
      const similarity = maxVal > 0 ? 1 - Math.abs(val1 - val2) / maxVal : 1;
      similarities.push(similarity);
    }

    // Compare boolean features
    const booleanFeatures = [
      'hasLoops',
      'hasConditionals',
      'hasFunctions',
      'hasClasses',
      'hasReturns',
      'hasExceptions',
    ];
    for (const feature of booleanFeatures) {
      const val1 = features1[feature] as boolean;
      const val2 = features2[feature] as boolean;
      const similarity = val1 === val2 ? 1 : 0;
      similarities.push(similarity);
    }

    // Compare type
    const typeSimilarity = features1.type === features2.type ? 1 : 0;
    similarities.push(typeSimilarity);

    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
  }

  clearCache(): void {
    this.exactHashCache.clear();
    this.fuzzyHashCache.clear();
  }

  getCacheStats(): {
    exactCacheSize: number;
    fuzzyCacheSize: number;
  } {
    return {
      exactCacheSize: this.exactHashCache.size,
      fuzzyCacheSize: this.fuzzyHashCache.size,
    };
  }
}
