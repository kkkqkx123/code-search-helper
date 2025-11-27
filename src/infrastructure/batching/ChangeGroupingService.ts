import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { FileChangeEvent } from '../../service/filesystem/ChangeDetectionService';

/**
 * 变更分组结果
 */
export interface GroupedChanges {
  vectorChanges: FileChangeEvent[];
  graphChanges: FileChangeEvent[];
}

/**
 * 变更分组服务
 * 负责按目标类型分组文件变更
 */
@injectable()
export class ChangeGroupingService {
  private readonly vectorExtensions = [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.md', '.txt'
  ];

  private readonly graphExtensions = [
    '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp'
  ];

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 按目标分组变更
   */
  groupChangesByTarget(changes: FileChangeEvent[]): GroupedChanges {
    const initial: GroupedChanges = {
      vectorChanges: [],
      graphChanges: []
    };

    return changes.reduce((groups, change) => {
      if (this.isVectorRelevantChange(change)) {
        groups.vectorChanges.push(change);
      }
      if (this.isGraphRelevantChange(change)) {
        groups.graphChanges.push(change);
      }
      return groups;
    }, initial);
  }

  /**
   * 判断变更是否与向量索引相关
   */
  private isVectorRelevantChange(change: FileChangeEvent): boolean {
    const extension = this.getFileExtension(change.path);
    return this.vectorExtensions.includes(extension);
  }

  /**
   * 判断变更是否与图索引相关
   */
  private isGraphRelevantChange(change: FileChangeEvent): boolean {
    const extension = this.getFileExtension(change.path);
    return this.graphExtensions.includes(extension);
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }

  /**
   * 按变更类型分组
   */
  groupChangesByType(changes: FileChangeEvent[]): Map<string, FileChangeEvent[]> {
    const groups = new Map<string, FileChangeEvent[]>();

    changes.forEach(change => {
      if (!groups.has(change.type)) {
        groups.set(change.type, []);
      }
      groups.get(change.type)!.push(change);
    });

    return groups;
  }

  /**
   * 按路径模式分组
   */
  groupChangesByPattern(
    changes: FileChangeEvent[],
    pattern: RegExp
  ): { matched: FileChangeEvent[]; unmatched: FileChangeEvent[] } {
    return {
      matched: changes.filter(change => pattern.test(change.path)),
      unmatched: changes.filter(change => !pattern.test(change.path))
    };
  }

  /**
   * 排序变更（优先级：修改 > 创建 > 删除）
   */
  sortChangesByPriority(changes: FileChangeEvent[]): FileChangeEvent[] {
    const priorityMap: { [key: string]: number } = {
      'modified': 1,
      'created': 2,
      'deleted': 3
    };

    return changes.sort((a, b) => {
      const priorityA = priorityMap[a.type] || 999;
      const priorityB = priorityMap[b.type] || 999;
      return priorityA - priorityB;
    });
  }
}
