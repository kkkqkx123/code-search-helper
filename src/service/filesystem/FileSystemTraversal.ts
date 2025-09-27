import { injectable, inject, optional } from 'inversify';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { GitignoreParser } from '../../utils/GitignoreParser';

export interface FileInfo {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
  hash: string;
  lastModified: Date;
  language: string;
  isBinary: boolean;
}

export interface TraversalOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFileSize?: number;
  supportedExtensions?: string[];
  followSymlinks?: boolean;
  ignoreHiddenFiles?: boolean;
  ignoreDirectories?: string[];
  respectGitignore?: boolean;
}

export interface TraversalResult {
  files: FileInfo[];
  directories: string[];
  errors: string[];
  totalSize: number;
  processingTime: number;
}

@injectable()
export class FileSystemTraversal {
  private defaultOptions: Required<TraversalOptions>;

  constructor(@inject('TraversalOptions') @optional() options?: TraversalOptions) {
    this.defaultOptions = {
      includePatterns: options?.includePatterns ?? [],
      excludePatterns: options?.excludePatterns ?? [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
      ],
      maxFileSize: options?.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      supportedExtensions: options?.supportedExtensions ?? [
        '.ts',
        '.js',
        '.tsx',
        '.jsx',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.cpp',
        '.c',
        '.h',
        '.hpp',
      ],
      followSymlinks: options?.followSymlinks ?? false,
      ignoreHiddenFiles: options?.ignoreHiddenFiles ?? true,
      ignoreDirectories: options?.ignoreDirectories ?? [
        'node_modules',
        '.git',
        'dist',
        'build',
        'coverage',
        'logs',
      ],
      respectGitignore: options?.respectGitignore ?? true,
    };
  }

  async traverseDirectory(rootPath: string, options?: TraversalOptions): Promise<TraversalResult> {
    const startTime = Date.now();
    let traversalOptions = { ...this.defaultOptions, ...options };

    // If respectGitignore is enabled, parse .gitignore and add patterns to exclude
    if (traversalOptions.respectGitignore) {
      try {
        const gitignorePath = path.join(rootPath, '.gitignore');
        const gitignorePatterns = await GitignoreParser.parseGitignore(gitignorePath);
        if (gitignorePatterns.length > 0) {
          traversalOptions = {
            ...traversalOptions,
            excludePatterns: [...(traversalOptions.excludePatterns || []), ...gitignorePatterns],
          };
        }
      } catch (error) {
        // Log error but continue with traversal
        console.warn(`Failed to parse .gitignore: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const result: TraversalResult = {
      files: [],
      directories: [],
      errors: [],
      totalSize: 0,
      processingTime: 0,
    };

    try {
      await this.traverseRecursive(rootPath, rootPath, result, traversalOptions);
      result.processingTime = Date.now() - startTime;
    } catch (error) {
      result.errors.push(
        `Failed to traverse directory: ${error instanceof Error ? error.message : String(error)}`
      );
      result.processingTime = Date.now() - startTime;
    }

    return result;
  }

  private async traverseRecursive(
    currentPath: string,
    rootPath: string,
    result: TraversalResult,
    options: Required<TraversalOptions>,
    visitedPaths: Set<string> = new Set()
  ): Promise<void> {
    try {
      // Check for circular references to prevent infinite recursion
      let realPath: string;
      try {
        realPath = fsSync.realpathSync(currentPath);
      } catch (error) {
        result.errors.push(`Cannot resolve real path: ${currentPath}`);
        return;
      }
      
      if (visitedPaths.has(realPath)) {
        result.errors.push(`Circular reference detected: ${currentPath}`);
        return;
      }
      visitedPaths.add(realPath);

      // Limit recursion depth to prevent stack overflow
      if (visitedPaths.size > 1000) {
        result.errors.push(`Maximum recursion depth exceeded: ${currentPath}`);
        return;
      }

      const stats = await fs.stat(currentPath);
      const relativePath = path.relative(rootPath, currentPath);

      if (stats.isDirectory()) {
        await this.processDirectory(currentPath, relativePath, rootPath, result, options, visitedPaths);
      } else if (stats.isFile()) {
        await this.processFile(currentPath, relativePath, stats, result, options);
      }
    } catch (error) {
      // If this is the root path, rethrow to be caught by the outer try-catch
      if (currentPath === rootPath) {
        throw error;
      }
      result.errors.push(
        `Error accessing ${currentPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async processDirectory(
    dirPath: string,
    relativePath: string,
    rootPath: string,
    result: TraversalResult,
    options: Required<TraversalOptions>,
    visitedPaths: Set<string>
  ): Promise<void> {
    const dirName = path.basename(dirPath);

    if (this.shouldIgnoreDirectory(dirName, options)) {
      return;
    }

    if (relativePath !== '') {
      result.directories.push(relativePath);
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await this.traverseRecursive(fullPath, rootPath, result, options, visitedPaths);
        } else if (entry.isFile() || (entry.isSymbolicLink() && options.followSymlinks)) {
          await this.traverseRecursive(fullPath, rootPath, result, options, visitedPaths);
        }
      }
    } catch (error) {
      result.errors.push(
        `Error reading directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async processFile(
    filePath: string,
    relativePath: string,
    stats: fsSync.Stats,
    result: TraversalResult,
    options: Required<TraversalOptions>
  ): Promise<void> {
    if (this.shouldIgnoreFile(relativePath, options)) {
      return;
    }

    if (stats.size > options.maxFileSize) {
      result.errors.push(`File too large: ${relativePath} (${stats.size} bytes)`);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(extension, options.supportedExtensions);

    if (!language) {
      return;
    }

    try {
      const isBinary = await this.isBinaryFile(filePath);

      if (isBinary) {
        return;
      }

      const hash = await this.calculateFileHash(filePath);

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        name: path.basename(filePath),
        extension,
        size: stats.size,
        hash,
        lastModified: stats.mtime,
        language,
        isBinary,
      };

      result.files.push(fileInfo);
      result.totalSize += stats.size;
    } catch (error) {
      result.errors.push(
        `Error processing file ${relativePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private shouldIgnoreDirectory(dirName: string, options: Required<TraversalOptions>): boolean {
    if (options.ignoreHiddenFiles && dirName.startsWith('.')) {
      return true;
    }

    return options.ignoreDirectories.includes(dirName);
  }

  private shouldIgnoreFile(relativePath: string, options: Required<TraversalOptions>): boolean {
    if (options.ignoreHiddenFiles && path.basename(relativePath).startsWith('.')) {
      return true;
    }

    const fileName = path.basename(relativePath).toLowerCase();

    for (const pattern of options.excludePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }

    // If no include patterns are specified, don't filter by include patterns
    if (options.includePatterns.length === 0) {
      return false;
    }

    // If include patterns are specified, file must match at least one
    for (const pattern of options.includePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return false;
      }
    }
    return true;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    try {
      // Convert glob pattern to regex
      let regexPattern = pattern
        .replace(/\*\*/g, '__DOUBLE_ASTERISK__')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\./g, '\\.')
        .replace(/__DOUBLE_ASTERISK__/g, '.*');

      // Ensure the pattern matches the entire path
      if (!regexPattern.startsWith('^')) {
        regexPattern = '^' + regexPattern;
      }
      if (!regexPattern.endsWith('$')) {
        regexPattern = regexPattern + '$';
      }

      const regex = new RegExp(regexPattern);
      if (regex.test(filePath)) {
        return true;
      }

      // Special case for patterns like **/*.js - also try matching without the path part
      if (pattern.startsWith('**/') && pattern.includes('/') && !filePath.includes('/')) {
        const filenameOnlyPattern = pattern.replace(/^\*\*\//, '');
        let filenameRegexPattern = filenameOnlyPattern
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')
          .replace(/\./g, '\\.');

        if (!filenameRegexPattern.startsWith('^')) {
          filenameRegexPattern = '^' + filenameRegexPattern;
        }
        if (!filenameRegexPattern.endsWith('$')) {
          filenameRegexPattern = filenameRegexPattern + '$';
        }

        const filenameRegex = new RegExp(filenameRegexPattern);
        if (filenameRegex.test(filePath)) {
          return true;
        }
      }

      // For patterns that expect a directory path (like **/*.js), also check if the pattern
      // matches just the filename part for cases where filePath is just a filename
      if (pattern.includes('/') && !filePath.includes('/')) {
        // Extract the filename part from pattern (after the last /)
        const lastSlashIndex = pattern.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
          const filenamePattern = pattern.substring(lastSlashIndex + 1);
          // Convert this filename pattern to regex and test against filePath
          // For filename patterns like *.js, we want to match files ending with .js
          // We need to be careful about escaping - only escape literal dots
          let filenameRegexPattern = filenamePattern
            .replace(/\*/g, '.*')   // Replace * with .*
            .replace(/\?/g, '.')    // Replace ? with .
            .replace(/\./g, '\\.'); // Escape literal dots (this needs to be last to avoid escaping the dots we just added)
          
          if (!filenameRegexPattern.startsWith('^')) {
            filenameRegexPattern = '^' + filenameRegexPattern;
          }
          if (!filenameRegexPattern.endsWith('$')) {
            filenameRegexPattern = filenameRegexPattern + '$';
          }
          
          const filenameRegex = new RegExp(filenameRegexPattern);
          if (filenameRegex.test(filePath)) {
            return true;
          }
        }
      }

      // Additional check: For patterns like **/*.js, also check if the pattern without the **/ prefix matches
      if (pattern.startsWith('**/') && pattern.includes('/') && !filePath.includes('/')) {
        const filenamePattern = pattern.substring(3); // Remove **/ prefix
        let filenameRegexPattern = filenamePattern
          .replace(/\*/g, '.*')   // Replace * with .*
          .replace(/\?/g, '.')    // Replace ? with .
          .replace(/\./g, '\\.'); // Escape literal dots
          
        if (!filenameRegexPattern.startsWith('^')) {
          filenameRegexPattern = '^' + filenameRegexPattern;
        }
        if (!filenameRegexPattern.endsWith('$')) {
          filenameRegexPattern = filenameRegexPattern + '$';
        }
        
        const filenameRegex = new RegExp(filenameRegexPattern);
        if (filenameRegex.test(filePath)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // If the pattern is invalid, return false
      return false;
    }
  }

  private detectLanguage(extension: string, supportedExtensions: string[]): string | null {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c++': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
    };

    const language = languageMap[extension];
    return language && supportedExtensions.includes(extension) ? language : null;
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    let fileHandle: fs.FileHandle | null = null;
    try {
      // Use file handle to ensure proper resource cleanup
      fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(1024);
      const { bytesRead } = await fileHandle.read(buffer, 0, 1024, 0);
      
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return true;
    } finally {
      if (fileHandle) {
        try {
          await fileHandle.close();
        } catch (closeError) {
          // Ignore close errors
        }
      }
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = fsSync.createReadStream(filePath);
      let isDestroyed = false;
      
      const cleanup = () => {
        if (!isDestroyed) {
          isDestroyed = true;
          stream.destroy();
        }
      };
      
      stream.on('data', (chunk) => {
        hash.update(chunk);
      });
      
      stream.on('end', () => {
        cleanup();
        resolve(hash.digest('hex'));
      });
      
      stream.on('error', (error) => {
        cleanup();
        reject(error);
      });
      
      stream.on('close', cleanup);
      
      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (!isDestroyed) {
          cleanup();
          reject(new Error(`File hash calculation timeout: ${filePath}`));
        }
      }, 30000); // 30 second timeout
    });
  }

  async findChangedFiles(
    rootPath: string,
    previousHashes: Map<string, string>,
    options?: TraversalOptions
  ): Promise<FileInfo[]> {
    const result = await this.traverseDirectory(rootPath, options);
    const changedFiles: FileInfo[] = [];

    for (const file of result.files) {
      const previousHash = previousHashes.get(file.relativePath);

      if (!previousHash || previousHash !== file.hash) {
        changedFiles.push(file);
      }
    }

    return changedFiles;
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getDirectoryStats(
    rootPath: string,
    options?: TraversalOptions
  ): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByLanguage: Record<string, number>;
    largestFiles: FileInfo[];
  }> {
    const result = await this.traverseDirectory(rootPath, options);

    const filesByLanguage: Record<string, number> = {};
    const largestFiles = [...result.files].sort((a, b) => b.size - a.size).slice(0, 10);

    for (const file of result.files) {
      filesByLanguage[file.language] = (filesByLanguage[file.language] || 0) + 1;
    }

    return {
      totalFiles: result.files.length,
      totalSize: result.totalSize,
      filesByLanguage,
      largestFiles,
    };
  }
}