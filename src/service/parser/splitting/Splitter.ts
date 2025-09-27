export interface CodeChunk {
  content: string;
  metadata: {
    startLine: number;
    endLine: number;
    language: string;
    filePath?: string;
  }
}

export interface Splitter {
  split(code: string, language: string, filePath?: string): Promise<CodeChunk[]>;
  setChunkSize(chunkSize: number): void;
  setChunkOverlap(chunkOverlap: number): void;
}