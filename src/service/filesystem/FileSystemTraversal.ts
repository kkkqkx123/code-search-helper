import { injectable, inject, optional } from 'inversify';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { GitignoreParser } from '../../utils/GitignoreParser';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';

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

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject('TraversalOptions') @optional() options?: TraversalOptions
  ) {
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
        '.txt',
        '.md',
        '.json',
        '.yaml',
        '.yml',
        '.xml',
        '.csv',
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

    // Debug: Log the traversal options
    this.logger.debug(`[DEBUG] Traversal options for ${rootPath}`, {
      includePatterns: traversalOptions.includePatterns,
      excludePatterns: traversalOptions.excludePatterns,
      supportedExtensions: traversalOptions.supportedExtensions,
      maxFileSize: traversalOptions.maxFileSize,
      ignoreHiddenFiles: traversalOptions.ignoreHiddenFiles,
      ignoreDirectories: traversalOptions.ignoreDirectories,
      respectGitignore: traversalOptions.respectGitignore
    });

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
          this.logger.debug(`[DEBUG] Added gitignore patterns`, gitignorePatterns);
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
      
      // Debug: Log the final results
      this.logger.debug(`[DEBUG] Traversal completed for ${rootPath}`, {
        filesFound: result.files.length,
        directoriesFound: result.directories.length,
        errors: result.errors,
        processingTime: result.processingTime,
        files: result.files.map(f => ({ path: f.path, extension: f.extension, language: f.language }))
      });
    } catch (error) {
      result.errors.push(
        `Failed to traverse directory: ${error instanceof Error ? error.message : String(error)}`
      );
      result.processingTime = Date.now() - startTime;
      
      // Debug: Log the error
      this.logger.error(`[DEBUG] Traversal failed for ${rootPath}`, error);
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
    // Debug: Log file processing attempt
    this.logger.debug(`[DEBUG] Processing file`, { filePath, relativePath });
    
    if (this.shouldIgnoreFile(relativePath, options)) {
      this.logger.debug(`[DEBUG] File ignored by pattern`, { relativePath });
      return;
    }

    if (stats.size > options.maxFileSize) {
      result.errors.push(`File too large: ${relativePath} (${stats.size} bytes)`);
      this.logger.debug(`[DEBUG] File too large`, { relativePath, size: stats.size });
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const language = this.detectLanguage(extension, options.supportedExtensions);
    
    this.logger.debug(`[DEBUG] File detected`, { extension, language, supported: options.supportedExtensions.includes(extension) });

    if (!language) {
      this.logger.debug(`[DEBUG] File skipped - unsupported extension`, { extension });
      return;
    }

    try {
      this.logger.debug(`[DEBUG] Starting isBinaryFile check for ${relativePath}`);
      const isBinary = await this.isBinaryFile(filePath);
      this.logger.debug(`[DEBUG] File binary check completed`, { isBinary });

      if (isBinary) {
        this.logger.debug(`[DEBUG] File skipped - binary file`, { relativePath });
        return;
      }

      this.logger.debug(`[DEBUG] Starting hash calculation for ${relativePath}`);
      const hash = await this.calculateFileHash(filePath);
      this.logger.debug(`[DEBUG] Hash calculation completed`, { hash });

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
      this.logger.debug(`[DEBUG] File added to results`, { relativePath });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(
        `Error processing file ${relativePath}: ${errorMessage}`
      );
      this.logger.error(`[DEBUG] Error processing file ${relativePath}`, { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
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

    // Check if excludePatterns is an array before iterating
    if (Array.isArray(options.excludePatterns)) {
      for (const pattern of options.excludePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return true;
        }
      }
    }

    // If no include patterns are specified, don't filter by include patterns
    if (!Array.isArray(options.includePatterns) || options.includePatterns.length === 0) {
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
      '.txt': 'text',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.csv': 'csv',
    };

    const language = languageMap[extension];
    return language && supportedExtensions.includes(extension) ? language : null;
  }

  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      // Use simpler approach with readFile
      const buffer = await fs.readFile(filePath, { encoding: null });
      
      // Check first 1024 bytes for null bytes (indicating binary file)
      const checkLength = Math.min(buffer.length, 1024);
      for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.logger.debug(`[DEBUG] Error checking if file is binary: ${filePath}`, { error: error instanceof Error ? error.message : String(error) });
      return true;
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      // Use simpler approach with readFile
      const data = await fs.readFile(filePath);
      const hash = createHash('sha256');
      hash.update(data);
      return hash.digest('hex');
    } catch (error) {
      this.logger.debug(`[DEBUG] Error calculating file hash: ${filePath}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to calculate hash for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
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