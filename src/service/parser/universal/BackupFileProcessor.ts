import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import * as path from 'path';

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
    this.backupPatterns = [
      '.bak',
      '.backup',
      '.old',
      '.tmp',
      '.temp',
      '.orig',
      '.save',
      '.swp', // Vim swap files
      '.swo', // Vim swap files
      '~',    // Emacs backup files
      '.bak$', // Regex pattern for .bak at end
      '.backup$',
      '.old$',
      '.tmp$',
      '.temp$'
    ];
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
    
    // 检查临时文件模式（如 #filename#）
    if (fileName.startsWith('#') && fileName.endsWith('#')) {
      return true;
    }
    
    // 检查隐藏的临时文件（如 .filename.swp）
    if (fileName.startsWith('.') && fileName.includes('.swp')) {
      return true;
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
    // 优先处理特定格式的备份文件，避免与特殊模式冲突
    // 处理Vim交换文件 (.filename.swp)
    if (baseName.startsWith('.') && baseName.endsWith('.swp')) {
      originalFileName = baseName.slice(1, -4);
      originalExtension = path.extname(originalFileName);
      confidence = 0.9;
    }
    // 处理Vim风格的临时文件 (#filename#)
    else if (baseName.startsWith('#') && baseName.endsWith('#') && baseName.length > 2) {
      originalFileName = baseName.slice(1, -1);
      originalExtension = path.extname(originalFileName);
      confidence = 0.9;
    }
    // 处理Emacs风格的备份文件 (~结尾)
    else if (baseName.endsWith('~') && !baseName.endsWith('.bak~')) {
      originalFileName = baseName.slice(0, -1);
      originalExtension = path.extname(originalFileName);
      confidence = 0.7;
    }
    // 检查特殊模式：文件名中包含原始文件类型（如 *.py.bak, *.js.backup 等）
    // 这种模式下，文件名格式为：originalName.originalExt.backupExt
    // 注意：排除以 . 开头的文件，以避免与Vim交换文件冲突
    else if (!baseName.startsWith('.')) {
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
        
        // 处理隐藏的备份文件
        if (baseName.startsWith('.') && baseName.includes('.bak')) {
          originalFileName = baseName.replace('.bak', '');
          originalExtension = path.extname(originalFileName);
          confidence = 0.8;
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
      
      // 处理隐藏的备份文件
      if (baseName.startsWith('.') && baseName.includes('.bak')) {
        originalFileName = baseName.replace('.bak', '');
        originalExtension = path.extname(originalFileName);
        confidence = 0.8;
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
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.txt': 'text',
      '.log': 'log',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini',
      '.toml': 'toml',
      '.dockerfile': 'dockerfile',
      '.makefile': 'makefile',
      '.cmake': 'cmake',
      '.pl': 'perl',
      '.r': 'r',
      '.m': 'matlab',
      '.lua': 'lua',
      '.dart': 'dart',
      '.ex': 'elixir',
      '.exs': 'elixir',
      '.erl': 'erlang',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.vb': 'visualbasic',
      '.ps1': 'powershell',
      '.bat': 'batch',
      '.cmd': 'batch'
    };

    return languageMap[extension.toLowerCase()] || 'unknown';
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
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
      'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
      'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
      'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
      'visualbasic', 'powershell', 'batch'
    ];
    
    return codeLanguages.includes(inferred.originalLanguage);
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
    if (fileName.endsWith('~')) return 'emacs-backup';
    if (fileName.startsWith('#') && fileName.endsWith('#')) return 'vim-temporary';
    if (fileName.includes('.swp')) return 'vim-swap';
    if (fileName.startsWith('.')) return 'hidden-backup';
    
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