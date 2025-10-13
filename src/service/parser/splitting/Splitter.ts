export interface CodeChunkMetadata {
  startLine: number;
  endLine: number;
  language: string;
  filePath?: string;
  type?: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function';
  functionName?: string;
  className?: string;
  complexity?: number; // 新增：代码复杂度
  startByte?: number;
  endByte?: number;
  imports?: string[];
  exports?: string[];
  nestingLevel?: number;
  [key: string]: any;
}

export interface CodeChunk {
  id?: string;
  content: string;
  metadata: CodeChunkMetadata;
}

export interface Splitter {
  split(code: string, language: string, filePath?: string): Promise<CodeChunk[]>;
 setChunkSize(chunkSize: number): void;
  setChunkOverlap(chunkOverlap: number): void;
}