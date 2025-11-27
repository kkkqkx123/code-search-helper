import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import * as path from 'path';

/**
 * 文件分组结果接口
 */
export interface FileGroup {
  /** 分组类型 */
  groupType: string;
  /** 文件列表 */
  files: string[];
  /** 分组权重（用于处理优先级） */
  priority: number;
  /** 预估处理时间（毫秒） */
  estimatedProcessingTime: number;
  /** 分组元数据 */
  metadata: {
    avgFileSize: number;
    totalSize: number;
    fileTypes: string[];
    complexity: number;
  };
}

/**
 * Graph模块文件分组策略
 * 根据文件类型、大小和复杂度进行智能分组
 */
@injectable()
export class GraphFileGroupingStrategy {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 按类型对文件进行分组
   */
  groupFilesByType(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const file of files) {
      const fileType = this.getFileType(file);
      const groupKey = this.getGroupKey(fileType);
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(file);
    }
    
    this.logger.debug('Files grouped by type', {
      totalFiles: files.length,
      groups: Array.from(groups.entries()).map(([type, files]) => ({
        type,
        count: files.length
      }))
    });
    
    return groups;
  }

  /**
   * 按复杂度对文件进行分组
   */
  groupFilesByComplexity(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    // 初始化分组
    groups.set('simple', []);
    groups.set('medium', []);
    groups.set('complex', []);
    
    for (const file of files) {
      const complexity = this.estimateFileComplexity(file);
      let groupKey: string;
      
      if (complexity <= 0.3) {
        groupKey = 'simple';
      } else if (complexity <= 0.7) {
        groupKey = 'medium';
      } else {
        groupKey = 'complex';
      }
      
      groups.get(groupKey)!.push(file);
    }
    
    this.logger.debug('Files grouped by complexity', {
      totalFiles: files.length,
      groups: Array.from(groups.entries()).map(([type, files]) => ({
        type,
        count: files.length
      }))
    });
    
    return groups;
  }

  /**
   * 按大小对文件进行分组
   */
  groupFilesBySize(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    // 初始化分组
    groups.set('small', []);    // < 50KB
    groups.set('medium', []);   // 50KB - 200KB
    groups.set('large', []);    // > 200KB
    
    for (const file of files) {
      const size = this.getFileSize(file);
      let groupKey: string;
      
      if (size <= 50 * 1024) {
        groupKey = 'small';
      } else if (size <= 200 * 1024) {
        groupKey = 'medium';
      } else {
        groupKey = 'large';
      }
      
      groups.get(groupKey)!.push(file);
    }
    
    this.logger.debug('Files grouped by size', {
      totalFiles: files.length,
      groups: Array.from(groups.entries()).map(([type, files]) => ({
        type,
        count: files.length
      }))
    });
    
    return groups;
  }

  /**
   * 智能分组 - 综合考虑类型、大小和复杂度
   */
  groupFilesIntelligently(files: string[]): FileGroup[] {
    const typeGroups = this.groupFilesByType(files);
    const groups: FileGroup[] = [];
    
    for (const [groupType, groupFiles] of typeGroups.entries()) {
      if (groupFiles.length === 0) continue;
      
      // 计算分组统计信息
      const metadata = this.calculateGroupMetadata(groupFiles);
      
      // 确定优先级
      const priority = this.calculateGroupPriority(groupType, metadata);
      
      // 估算处理时间
      const estimatedProcessingTime = this.estimateGroupProcessingTime(metadata);
      
      groups.push({
        groupType,
        files: groupFiles,
        priority,
        estimatedProcessingTime,
        metadata
      });
    }
    
    // 按优先级排序（高优先级先处理）
    groups.sort((a, b) => b.priority - a.priority);
    
    this.logger.info('Intelligent file grouping completed', {
      totalGroups: groups.length,
      totalFiles: files.length,
      groups: groups.map(g => ({
        type: g.groupType,
        fileCount: g.files.length,
        priority: g.priority,
        estimatedTime: Math.round(g.estimatedProcessingTime / 1000) + 's'
      }))
    });
    
    return groups;
  }

  /**
   * 按目录结构对文件进行分组
   */
  groupFilesByDirectory(files: string[], maxDepth: number = 3): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const file of files) {
      const dirPath = this.getDirectoryPath(file, maxDepth);
      
      if (!groups.has(dirPath)) {
        groups.set(dirPath, []);
      }
      groups.get(dirPath)!.push(file);
    }
    
    this.logger.debug('Files grouped by directory', {
      totalFiles: files.length,
      maxDepth,
      groups: Array.from(groups.entries()).map(([dir, files]) => ({
        directory: dir,
        count: files.length
      }))
    });
    
    return groups;
  }

  /**
   * 获取文件类型
   */
  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const typeMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.java': 'java',
      '.py': 'python',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.md': 'markdown',
      '.txt': 'text',
      '.sql': 'sql'
    };
    
    return typeMap[ext] || 'other';
  }

  /**
   * 根据文件类型确定分组键
   */
  private getGroupKey(fileType: string): string {
    const typeGroups: Record<string, string> = {
      'typescript': 'code-heavy',
      'javascript': 'code-heavy',
      'java': 'code-heavy',
      'python': 'code-heavy',
      'cpp': 'code-heavy',
      'c': 'code-heavy',
      'csharp': 'code-heavy',
      'rust': 'code-heavy',
      'go': 'code-heavy',
      'scala': 'code-heavy',
      'kotlin': 'code-heavy',
      'swift': 'code-heavy',
      'php': 'code-heavy',
      'ruby': 'code-heavy',
      'json': 'config',
      'yaml': 'config',
      'yml': 'config',
      'xml': 'config',
      'html': 'markup',
      'css': 'style',
      'scss': 'style',
      'sass': 'style',
      'less': 'style',
      'md': 'documentation',
      'txt': 'documentation',
      'sql': 'database',
      'other': 'miscellaneous'
    };
    
    return typeGroups[fileType] || 'miscellaneous';
  }

  /**
   * 估算文件复杂度
   */
  private estimateFileComplexity(filePath: string): number {
    const fileType = this.getFileType(filePath);
    const fileSize = this.getFileSize(filePath);
    
    // 基础复杂度（基于文件类型）
    const complexityMap: Record<string, number> = {
      'typescript': 0.8,
      'java': 0.9,
      'cpp': 0.85,
      'rust': 0.85,
      'scala': 0.8,
      'csharp': 0.8,
      'python': 0.5,
      'javascript': 0.6,
      'go': 0.6,
      'kotlin': 0.7,
      'swift': 0.7,
      'php': 0.6,
      'ruby': 0.5,
      'json': 0.2,
      'yaml': 0.2,
      'xml': 0.4,
      'html': 0.4,
      'css': 0.3,
      'scss': 0.4,
      'sass': 0.4,
      'less': 0.4,
      'md': 0.1,
      'txt': 0.1,
      'sql': 0.5
    };
    
    let complexity = complexityMap[fileType] || 0.5;
    
    // 基于文件大小调整复杂度
    if (fileSize > 200 * 1024) { // > 200KB
      complexity = Math.min(1.0, complexity + 0.2);
    } else if (fileSize > 100 * 1024) { // > 100KB
      complexity = Math.min(1.0, complexity + 0.1);
    } else if (fileSize < 10 * 1024) { // < 10KB
      complexity = Math.max(0.1, complexity - 0.1);
    }
    
    return complexity;
  }

  /**
   * 获取文件大小
   */
  private getFileSize(filePath: string): number {
    try {
      const fs = require('fs');
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      this.logger.debug(`Failed to get file size: ${filePath}`, { error });
      return 0;
    }
  }

  /**
   * 计算分组元数据
   */
  private calculateGroupMetadata(files: string[]): FileGroup['metadata'] {
    let totalSize = 0;
    const fileTypes = new Set<string>();
    let totalComplexity = 0;
    
    for (const file of files) {
      const size = this.getFileSize(file);
      const fileType = this.getFileType(file);
      const complexity = this.estimateFileComplexity(file);
      
      totalSize += size;
      fileTypes.add(fileType);
      totalComplexity += complexity;
    }
    
    return {
      avgFileSize: files.length > 0 ? totalSize / files.length : 0,
      totalSize,
      fileTypes: Array.from(fileTypes),
      complexity: files.length > 0 ? totalComplexity / files.length : 0
    };
  }

  /**
   * 计算分组优先级
   */
  private calculateGroupPriority(groupType: string, metadata: FileGroup['metadata']): number {
    let priority = 50; // 基础优先级
    
    // 基于分组类型调整优先级
    const typePriority: Record<string, number> = {
      'code-heavy': 80,
      'config': 90,
      'style': 60,
      'markup': 50,
      'documentation': 30,
      'database': 70,
      'miscellaneous': 20
    };
    
    priority += typePriority[groupType] || 0;
    
    // 基于复杂度调整优先级（简单文件优先处理）
    if (metadata.complexity <= 0.3) {
      priority += 20;
    } else if (metadata.complexity <= 0.7) {
      priority += 10;
    }
    
    // 基于文件大小调整优先级（小文件优先处理）
    if (metadata.avgFileSize <= 50 * 1024) {
      priority += 15;
    } else if (metadata.avgFileSize <= 100 * 1024) {
      priority += 5;
    }
    
    return Math.max(0, Math.min(100, priority));
  }

  /**
   * 估算分组处理时间
   */
  private estimateGroupProcessingTime(metadata: FileGroup['metadata']): number {
    // 基础处理时间（每KB的毫秒数）
    const baseTimePerKB = 10;
    
    // 复杂度系数
    const complexityMultiplier = 1 + metadata.complexity;
    
    // 文件类型系数
    let typeMultiplier = 1.0;
    for (const fileType of metadata.fileTypes) {
      const typeMultiplierMap: Record<string, number> = {
        'typescript': 1.5,
        'java': 1.8,
        'cpp': 1.6,
        'rust': 1.7,
        'python': 1.2,
        'javascript': 1.3,
        'json': 0.5,
        'yaml': 0.5,
        'html': 0.8,
        'css': 0.7,
        'md': 0.3
      };
      
      typeMultiplier = Math.max(typeMultiplier, typeMultiplierMap[fileType] || 1.0);
    }
    
    // 计算总处理时间
    const totalSizeKB = metadata.totalSize / 1024;
    const estimatedTime = totalSizeKB * baseTimePerKB * complexityMultiplier * typeMultiplier;
    
    return Math.round(estimatedTime);
  }

  /**
   * 获取目录路径（限制深度）
   */
  private getDirectoryPath(filePath: string, maxDepth: number): string {
    const parsedPath = path.parse(filePath);
    const dirs = parsedPath.dir.split(path.sep);
    
    if (dirs.length <= maxDepth) {
      return parsedPath.dir;
    }
    
    // 返回最后maxDepth个目录
    return dirs.slice(-maxDepth).join(path.sep);
  }

  /**
   * 获取分组策略建议
   */
  getGroupingRecommendation(files: string[]): {
    recommendedStrategy: string;
    reasoning: string[];
    expectedGroups: number;
  } {
    const totalFiles = files.length;
    const typeGroups = this.groupFilesByType(files);
    const sizeGroups = this.groupFilesBySize(files);
    const complexityGroups = this.groupFilesByComplexity(files);
    
    let recommendedStrategy = 'intelligent';
    const reasoning: string[] = [];
    
    // 分析文件分布特征
    const typeDiversity = typeGroups.size;
    const sizeVariance = sizeGroups.size;
    const complexityVariance = complexityGroups.size;
    
    if (totalFiles < 10) {
      recommendedStrategy = 'simple';
      reasoning.push('文件数量较少，使用简单分组策略');
    } else if (typeDiversity > 5) {
      recommendedStrategy = 'type';
      reasoning.push('文件类型多样，按类型分组可以提高处理效率');
    } else if (sizeVariance > 2) {
      recommendedStrategy = 'size';
      reasoning.push('文件大小差异较大，按大小分组可以优化内存使用');
    } else if (complexityVariance > 2) {
      recommendedStrategy = 'complexity';
      reasoning.push('文件复杂度差异较大，按复杂度分组可以平衡处理时间');
    } else {
      reasoning.push('使用智能分组策略，综合考虑多个因素');
    }
    
    const expectedGroups = Math.max(1, Math.min(typeGroups.size, Math.ceil(totalFiles / 10)));
    
    return {
      recommendedStrategy,
      reasoning,
      expectedGroups
    };
  }
}