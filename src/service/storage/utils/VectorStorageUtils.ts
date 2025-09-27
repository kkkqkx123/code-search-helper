import { CodeChunk } from '../../parser/types';

export class VectorStorageUtils {
  static extractUniqueFileCount(chunks: CodeChunk[]): number {
    const uniqueFiles = new Set<string>();

    for (const chunk of chunks) {
      if (chunk.metadata.filePath) {
        uniqueFiles.add(chunk.metadata.filePath);
      }
    }

    return uniqueFiles.size;
  }

  static generateCollectionName(projectId: string): string {
    return `project-${projectId}`;
  }
}
