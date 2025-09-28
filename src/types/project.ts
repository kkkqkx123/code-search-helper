export interface ProjectCreateRequest {
  name: string;
  path: string;
  options?: {
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    chunkSize?: number;
    overlapSize?: number;
  };
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string;
  configuration?: {
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    fileTypes?: string[];
    encoding?: string;
    followSymlinks?: boolean;
    respectGitignore?: boolean;
  };
}

export interface PathValidationRequest {
  path: string;
}

export interface PathValidationResult {
  isValid: boolean;
  exists: boolean;
  isDirectory: boolean;
  fileCount?: number;
  size?: number;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  status: 'pending' | 'indexing' | 'completed' | 'error';
  progress: number;
  lastIndexed: Date;
  fileCount: number;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  configuration?: {
    recursive: boolean;
    includePatterns: string[];
    excludePatterns: string[];
    maxFileSize: number;
    fileTypes: string[];
    encoding?: string;
    followSymlinks?: boolean;
    respectGitignore?: boolean;
  };
}

export interface IndexingProgress {
  projectId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  totalFiles: number;
  processedFiles: number;
  currentFile?: string;
  startTime: Date;
  error?: string;
}

export interface IndexingStats {
  processingRate: number;
  averageFileSize: number;
  totalSizeProcessed: number;
  errors: number;
}