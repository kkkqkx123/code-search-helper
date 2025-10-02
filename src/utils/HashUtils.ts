import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileHash {
  path: string;
  hash: string;
  size: number;
  lastModified: Date;
}

export interface DirectoryHash {
  path: string;
  hash: string;
  fileCount: number;
  files: FileHash[];
}

export class HashUtils {
  static async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error}`);
    }
  }

  static async calculateDirectoryHash(dirPath: string): Promise<DirectoryHash> {
    const files: FileHash[] = [];
    const hash = crypto.createHash('sha256');

    const processFile = async (filePath: string) => {
      try {
        const stats = await fs.stat(filePath);
        const fileHash = await this.calculateFileHash(filePath);

        const fileHashInfo: FileHash = {
          path: path.relative(dirPath, filePath),
          hash: fileHash,
          size: stats.size,
          lastModified: stats.mtime,
        };

        files.push(fileHashInfo);
        hash.update(fileHashInfo.path + fileHashInfo.hash);
      } catch (error) {
        // Skip files that can't be read
      }
    };

    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          await processFile(fullPath);
        }
      }
    };

    await processDirectory(dirPath);

    return {
      path: dirPath,
      hash: hash.digest('hex'),
      fileCount: files.length,
      files,
    };
  }

  static calculateStringHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  static generateId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  static normalizePath(filePath: string): string {
    // 标准化路径，转换反斜杠为正斜杠，并移除尾斜杠（除非是根路径）
    let normalized = path.normalize(filePath).replace(/\\/g, '/');
    
    // 移除尾斜杠，但保留根路径的斜杠
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    // 处理双斜杠问题（Windows UNC路径）
    if (normalized.startsWith('//') && !normalized.startsWith('///')) {
      normalized = '/' + normalized.substring(2);
    }
    
    return normalized;
  }

  static getFileExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return ext.startsWith('.') ? ext.substr(1) : ext;
  }

  static isValidCodeFile(filePath: string, allowedExtensions: string[] = []): boolean {
    const extension = this.getFileExtension(filePath);
    const defaultExtensions = [
      'ts',
      'js',
      'jsx',
      'tsx',
      'py',
      'java',
      'go',
      'rs',
      'cpp',
      'c',
      'h',
      'cs',
      'php',
      'rb',
      'swift',
      'kt',
    ];
    const extensions = allowedExtensions.length > 0 ? allowedExtensions : defaultExtensions;

    return extensions.includes(extension);
  }
}