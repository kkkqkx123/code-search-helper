import fs from 'fs/promises';
import path from 'path';

export interface FileSystemStats {
  totalFiles: number;
  totalSize: number;
  fileTypes: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
}

export class PathUtils {
  static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  static async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  static async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  static async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  static async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    };

    await processDirectory(dirPath);
    return totalSize;
  }

  static async getFileSystemStats(dirPath: string): Promise<FileSystemStats> {
    const stats: FileSystemStats = {
      totalFiles: 0,
      totalSize: 0,
      fileTypes: {},
      largestFiles: [],
    };

    const processDirectory = async (currentPath: string) => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else if (entry.isFile()) {
          const fileStats = await fs.stat(fullPath);
          const extension = path.extname(fullPath).toLowerCase();

          stats.totalFiles++;
          stats.totalSize += fileStats.size;
          stats.fileTypes[extension] = (stats.fileTypes[extension] || 0) + 1;

          stats.largestFiles.push({
            path: path.relative(dirPath, fullPath),
            size: fileStats.size,
          });
        }
      }
    };

    await processDirectory(dirPath);

    // Keep only top 10 largest files
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 10);

    return stats;
  }

  static async cleanPath(filePath: string): Promise<string> {
    const normalized = path.normalize(filePath);
    const resolved = path.resolve(normalized);
    return resolved.replace(/\\/g, '/');
  }

  static async getRelativePath(fromPath: string, toPath: string): Promise<string> {
    const relative = path.relative(fromPath, toPath);
    return relative.replace(/\\/g, '/');
  }

  static async joinPaths(...paths: string[]): Promise<string> {
    const joined = path.join(...paths);
    return joined.replace(/\\/g, '/');
  }

  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async deleteDirectory(dirPath: string): Promise<boolean> {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  static async copyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path.dirname(targetPath));
      await fs.copyFile(sourcePath, targetPath);
      return true;
    } catch {
      return false;
    }
  }

  static async moveFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      await this.ensureDirectoryExists(path.dirname(targetPath));
      await fs.rename(sourcePath, targetPath);
      return true;
    } catch {
      return false;
    }
  }
}
