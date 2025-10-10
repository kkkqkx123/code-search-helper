import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { FileSystemTraversal, FileInfo } from '../../filesystem/FileSystemTraversal';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileTraversalOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
}

@injectable()
export class FileTraversalService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.FileSystemTraversal) private fileSystemTraversal: FileSystemTraversal
  ) {}

  /**
   * 获取项目中的所有文件
   */
  async getProjectFiles(projectPath: string, options?: FileTraversalOptions): Promise<string[]> {
    try {
      this.logger.debug(`[DEBUG] Starting file traversal for project: ${projectPath}`, { projectPath });

      const traversalResult = await this.fileSystemTraversal.traverseDirectory(projectPath, {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns
      });

      const files = traversalResult.files.map(file => file.path);
      this.logger.info(`Found ${files.length} files to process in project: ${projectPath}`);

      // Debug: Log traversal details
      this.logger.debug(`[DEBUG] Traversal completed for project: ${projectPath}`, {
        filesFound: files.length
      });

      return files;
    } catch (error) {
      this.logger.error(`Failed to get project files for path: ${projectPath}`, { error });
      throw error;
    }
  }

  /**
   * 检查是否为代码文件
   */
  isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.go', '.rs', '.rb', '.php', '.cs', '.swift', '.kt', '.scala',
      '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml'
    ];

    const ext = path.extname(filename).toLowerCase();
    return codeExtensions.includes(ext);
  }
}