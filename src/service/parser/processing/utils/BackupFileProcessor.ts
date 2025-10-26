import { injectable } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import * as path from 'path';
import { BACKUP_FILE_PATTERNS, LANGUAGE_MAP, CODE_LANGUAGES } from './backup-constants';

/**
 * 备份文件处理器
 * 负责识别备份文件并推断其原始类型
 */
@injectable()
export class BackupFileProcessor {
  private readonly backupPatterns: string[];
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
    this.backupPatterns = [...BACKUP_FILE_PATTERNS];
  }

  /**
   * 检查文件是否为备份文件
   */
  isBackupFile(filePath: string): boolean {
    const fileName = path.basename(filePath);

    for (const pattern of this.backupPatterns) {
      if (fileName.endsWith(pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 识别备份文件并推断原始类型
   */
  inferOriginalType(filePath: string): {
    originalExtension: string;
    originalLanguage: string;
    originalFileName: string;
    confidence: number;
  } {
    const baseName = path.basename(filePath);

    // 尝试各种备份文件模式
    let originalFileName = baseName;
    let originalExtension = '';
    let confidence = 0.5; // 默认置信度

    // 检查特殊模式：文件名中包含原始文件类型（如 *.py.bak, *.js.backup 等）
    // 这种模式下，文件名格式为：originalName.originalExt.backupExt
    const specialPatternMatch = baseName.match(/^(.+?)\.([a-z0-9]+)\.(?:bak|backup|old|tmp|temp|orig|save|swo)$/i);
    if (specialPatternMatch) {
      // 提取原始文件名和扩展名
      const originalNameWithoutExt = specialPatternMatch[1];
      const detectedOriginalExt = '.' + specialPatternMatch[2].toLowerCase();

      // 验证检测到的扩展名是否为有效编程语言扩展名
      if (this.isValidLanguageExtension(detectedOriginalExt)) {
        originalFileName = originalNameWithoutExt + detectedOriginalExt;
        originalExtension = detectedOriginalExt;
        confidence = 0.95; // 高置信度，因为模式明确且扩展名有效
      }
    } else {
      // 处理标准备份后缀
      for (const pattern of this.backupPatterns) {
        if (baseName.endsWith(pattern)) {
          originalFileName = baseName.slice(0, -pattern.length);
          originalExtension = path.extname(originalFileName);
          confidence = 0.8;
          break;
        }
      }

      // 使用 0.95 置信度，与 py.bak 等模式保持一致，额外添加 .txt/.md 是为了阻止 LSP 尝试解析
      if (!originalExtension && baseName.endsWith('.bak.md')) {
        originalFileName = baseName.slice(0, -7); // 移除 .bak.md
        originalExtension = '.md';
        confidence = 0.95;
      } else if (!originalExtension && baseName.endsWith('.bak.txt')) {
        originalFileName = baseName.slice(0, -8); // 移除 .bak.txt
        originalExtension = '.txt';
        confidence = 0.95;
      }


      // 如果没有找到原始扩展名，尝试其他方法
      if (!originalExtension) {
        // 检查文件名中是否包含扩展名模式
        const extensionMatch = baseName.match(/\.([a-z0-9]+)(?:\.(?:bak|backup|old|tmp|temp))?$/i);
        if (extensionMatch) {
          originalExtension = '.' + extensionMatch[1].toLowerCase();
          confidence = 0.6;
        }
      }
    }

    const originalLanguage = this.detectLanguageByExtension(originalExtension);

    this.logger?.debug(`Inferred original type for backup file: ${filePath}`, {
      originalFileName,
      originalExtension,
      originalLanguage,
      confidence
    });

    return {
      originalExtension,
      originalLanguage,
      originalFileName,
      confidence
    };
  }

  /**
   * 根据扩展名检测语言
   */
  detectLanguageByExtension(extension: string): string {
    return LANGUAGE_MAP[extension.toLowerCase()] || 'unknown';
  }

  /**
   * 验证扩展名是否为有效的编程语言扩展名
   */
  private isValidLanguageExtension(extension: string): boolean {
    return this.detectLanguageByExtension(extension) !== 'unknown';
  }

  /**
   * 获取备份文件的原始路径
   */
  getOriginalFilePath(backupFilePath: string): string {
    const dir = path.dirname(backupFilePath);
    const inferred = this.inferOriginalType(backupFilePath);

    return path.join(dir, inferred.originalFileName);
  }

  /**
   * 检查备份文件是否可能包含代码内容
   */
  isLikelyCodeFile(filePath: string): boolean {
    const inferred = this.inferOriginalType(filePath);
    return CODE_LANGUAGES.includes(inferred.originalLanguage);
  }

  /**
    * 获取备份文件的元数据
    */
  getBackupFileMetadata(filePath: string): {
    isBackup: boolean;
    backupType?: string;
    originalInfo?: {
      fileName: string;
      extension: string;
      language: string;
      confidence: number;
    };
    isLikelyCode: boolean;
  } {
    const isBackup = this.isBackupFile(filePath);

    if (!isBackup) {
      return {
        isBackup: false,
        isLikelyCode: false
      };
    }

    const inferredType = this.inferOriginalType(filePath);
    const backupType = this.detectBackupType(filePath);
    const isLikelyCode = this.isLikelyCodeFile(filePath);

    // 转换为期望的格式
    const originalInfo = {
      fileName: inferredType.originalFileName,
      extension: inferredType.originalExtension,
      language: inferredType.originalLanguage,
      confidence: inferredType.confidence
    };

    return {
      isBackup: true,
      backupType,
      originalInfo,
      isLikelyCode
    };
  }

  /**
   * 检测备份文件类型
   */
  private detectBackupType(filePath: string): string {
    const fileName = path.basename(filePath);

    if (fileName.endsWith('.bak')) return 'standard-backup';
    if (fileName.endsWith('.backup')) return 'full-backup';
    if (fileName.endsWith('.old')) return 'old-version';
    if (fileName.endsWith('.tmp') || fileName.endsWith('.temp')) return 'temporary';
    if (fileName.endsWith('.orig')) return 'original';
    if (fileName.endsWith('.save')) return 'saved';

    return 'unknown-backup';
  }

  /**
   * 添加自定义备份模式
   */
  addBackupPattern(pattern: string): void {
    if (!this.backupPatterns.includes(pattern)) {
      this.backupPatterns.push(pattern);
      this.logger?.info(`Added custom backup pattern: ${pattern}`);
    }
  }

  /**
   * 移除备份模式
   */
  removeBackupPattern(pattern: string): void {
    const index = this.backupPatterns.indexOf(pattern);
    if (index > -1) {
      this.backupPatterns.splice(index, 1);
      this.logger?.info(`Removed backup pattern: ${pattern}`);
    }
  }

  /**
   * 获取所有备份模式
   */
  getBackupPatterns(): string[] {
    return [...this.backupPatterns];
  }
}