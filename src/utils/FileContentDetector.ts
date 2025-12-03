/**
 * 全局文件内容检测工具类
 * 提供统一的文件内容分析功能，包括二进制检测、代码检测、缩进检测等
 */

import { PythonIndentChecker } from './structure/PythonIndentChecker';

/**
 * 换行符类型枚举
 */
export enum LineEndingType {
  CRLF = 'crlf', // Windows
  LF = 'lf',     // Unix/Linux/Mac
  CR = 'cr',     // Old Mac
  MIXED = 'mixed' // 混合
}

/**
 * 缩进类型枚举
 */
export enum IndentType {
  SPACES = 'spaces',
  TABS = 'tabs',
  MIXED = 'mixed',
  NONE = 'none'
}

/**
 * 二进制检测结果接口
 */
export interface BinaryDetectionResult {
  /** 是否为二进制文件 */
  isBinary: boolean;
  /** null字节比例 */
  nullByteRatio: number;
  /** 不可打印字符比例 */
  nonPrintableRatio: number;
  /** 检测的字节数 */
  bytesChecked: number;
}



/**
 * 文件内容检测结果接口
 */
export interface FileContentAnalysisResult {
  /** 二进制检测结果 */
  binaryDetection: BinaryDetectionResult;
  /** 换行符类型 */
  lineEndingType: LineEndingType;
}

/**
 * 全局文件内容检测工具类
 */
export class FileContentDetector {
  /**
   * 常见文件类型的魔数定义
   * 格式：[魔数字节序列, 文件类型描述]
   */
  private static readonly MAGIC_NUMBERS: Array<{
    pattern: number[];
    type: string;
    description: string;
  }> = [
    // 图片格式
    { pattern: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], type: 'png', description: 'PNG图像' },
    { pattern: [0xFF, 0xD8, 0xFF], type: 'jpeg', description: 'JPEG图像' },
    { pattern: [0x47, 0x49, 0x46, 0x38], type: 'gif', description: 'GIF图像' },
    { pattern: [0x42, 0x4D], type: 'bmp', description: 'BMP图像' },
    { pattern: [0x52, 0x49, 0x46, 0x46], type: 'webp', description: 'WebP图像' }, // RIFF...
    { pattern: [0x49, 0x49, 0x2A, 0x00], type: 'tiff', description: 'TIFF图像' }, // II*.
    { pattern: [0x4D, 0x4D, 0x00, 0x2A], type: 'tiff', description: 'TIFF图像' }, // MM.*

    // 文档格式
    { pattern: [0x25, 0x50, 0x44, 0x46], type: 'pdf', description: 'PDF文档' },
    { pattern: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], type: 'office', description: 'Microsoft Office文档' }, // DOC, XLS, PPT等
    { pattern: [0x50, 0x4B, 0x03, 0x04], type: 'zip', description: 'ZIP压缩文件' }, // 也包括DOCX, XLSX等
    { pattern: [0x50, 0x4B, 0x05, 0x06], type: 'zip', description: 'ZIP压缩文件' },
    { pattern: [0x50, 0x4B, 0x07, 0x08], type: 'zip', description: 'ZIP压缩文件' },

    // 音频格式
    { pattern: [0x49, 0x44, 0x33], type: 'mp3', description: 'MP3音频' }, // ID3
    { pattern: [0xFF, 0xFB], type: 'mp3', description: 'MP3音频' }, // MPEG audio
    { pattern: [0xFF, 0xF3], type: 'mp3', description: 'MP3音频' },
    { pattern: [0xFF, 0xF2], type: 'mp3', description: 'MP3音频' },
    { pattern: [0x4F, 0x67, 0x67, 0x53], type: 'ogg', description: 'OGG音频' }, // OggS
    { pattern: [0x52, 0x49, 0x46, 0x46], type: 'wav', description: 'WAV音频' }, // RIFF (需要进一步检查)
    { pattern: [0x66, 0x4C, 0x61, 0x43], type: 'flac', description: 'FLAC音频' }, // fLaC

    // 视频格式
    { pattern: [0x1A, 0x45, 0xDF, 0xA3], type: 'mkv', description: 'MKV视频' }, // EBML
    { pattern: [0x46, 0x4C, 0x56], type: 'flv', description: 'FLV视频' }, // FLV
    { pattern: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], type: 'mp4', description: 'MP4视频' }, // ftyp
    { pattern: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], type: 'mp4', description: 'MP4视频' },
    { pattern: [0x1A, 0x45, 0xDF, 0xA3], type: 'webm', description: 'WebM视频' },

    // 可执行文件
    { pattern: [0x4D, 0x5A], type: 'exe', description: 'Windows可执行文件' }, // MZ
    { pattern: [0x7F, 0x45, 0x4C, 0x46], type: 'elf', description: 'Linux可执行文件' }, // ELF
    { pattern: [0xFE, 0xED, 0xFA, 0xCE], type: 'macho', description: 'macOS可执行文件' }, // Mach-O
    { pattern: [0xFE, 0xED, 0xFA, 0xCF], type: 'macho', description: 'macOS可执行文件' },

    // 其他常见二进制格式
    { pattern: [0x42, 0x45, 0x47, 0x49, 0x4E], type: 'sqlite', description: 'SQLite数据库' } // BEGIN
  ];

  /**
   * 基于文件扩展名的二进制文件类型
   * 这些扩展名通常表示二进制文件，即使内容检测可能认为是文本
   */
  private static readonly BINARY_EXTENSIONS = new Set([
    // Office文档
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
    // 图片
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'ico', 'svg',
    // 音频
    'mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma',
    // 视频
    'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp',
    // 压缩文件
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lzma',
    // 可执行文件
    'exe', 'dll', 'so', 'dylib', 'app', 'deb', 'rpm', 'dmg', 'iso',
    // 数据库
    'db', 'sqlite', 'sqlite3', 'mdb',
    // 字体
    'ttf', 'otf', 'woff', 'woff2', 'eot',
    // 其他二进制格式
    'pdf', 'psd', 'ai', 'eps', 'swf', 'class', 'jar', 'war', 'ear'
  ]);

  /**
   * 检测是否为二进制内容
   * 使用增强的检测算法，不仅检查null字节，还检查不可打印字符比例和UTF-8有效性
   * 
   * @param content 文件内容，可以是字符串或Buffer
   * @param filePath 文件路径（可选，用于扩展名检测）
   * @param checkBytes 检查的字节数，默认1024
   * @returns 二进制检测结果
   */
  static detectBinaryContent(
    content: string | Buffer, 
    filePath?: string, 
    checkBytes: number = 1024
  ): BinaryDetectionResult {
    // 如果是字符串，转换为Buffer
    const buffer = typeof content === 'string' 
      ? Buffer.from(content, 'utf8') 
      : content;

    // 检查前N个字节
    const checkLength = Math.min(buffer.length, checkBytes);
    let nullByteCount = 0;
    let controlCharCount = 0;
    let highBitCount = 0;

    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i];

      // 检查null字节
      if (byte === 0) {
        nullByteCount++;
      }

      // 检查控制字符 (ASCII < 32 且不是常见的控制字符)
      // 允许的控制字符: 9(TAB), 10(LF), 13(CR)
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        controlCharCount++;
      }

      // 检查高位字节 (可能的多字节字符或二进制数据)
      if (byte > 127) {
        highBitCount++;
      }
    }

    const nullByteRatio = nullByteCount / checkLength;
    const controlCharRatio = controlCharCount / checkLength;
    const highBitRatio = highBitCount / checkLength;

    // UTF-8有效性检查
    const isValidUTF8 = highBitCount > 0 ? this.isValidUTF8(buffer, 0, checkLength) : true;

    // 扩展名检测（如果提供了文件路径）
    const isBinaryByExtension = filePath ? this.isBinaryByExtension(filePath) : false;

    // 魔数检测
    const magicResult = this.detectByMagicNumber(buffer);
    const hasBinaryMagicNumber = magicResult && magicResult.type !== 'binary';

    // 改进的判断逻辑：
    // 1. 扩展名表明是二进制文件
    // 2. null字节比例超过0.1% (降低阈值)
    // 3. 控制字符比例超过3% (降低阈值)
    // 4. 高位字节比例高且不是有效的UTF-8
    // 5. 魔数检测到二进制格式
    const isBinary = isBinaryByExtension ||
                    nullByteRatio > 0.001 || 
                    controlCharRatio > 0.03 || 
                    (highBitRatio > 0.1 && !isValidUTF8) ||
                    hasBinaryMagicNumber ||
                    (nullByteRatio > 0 && controlCharRatio > 0.02);

    return {
      isBinary,
      nullByteRatio,
      nonPrintableRatio: (controlCharCount + highBitCount) / checkLength,
      bytesChecked: checkLength
    };
  }

  /**
   * 检查Buffer是否包含有效的UTF-8编码
   * 
   * @param buffer 要检查的Buffer
   * @param offset 起始偏移量
   * @param length 检查长度
   * @returns 是否为有效的UTF-8编码
   */
  private static isValidUTF8(buffer: Buffer, offset: number, length: number): boolean {
    let i = 0;
    while (i < length) {
      const byte = buffer[offset + i];
      
      if ((byte & 0x80) === 0) {
        // ASCII字符 (0xxxxxxx)
        i++;
      } else if ((byte & 0xE0) === 0xC0) {
        // 2字节UTF-8 (110xxxxx 10xxxxxx)
        if (i + 1 >= length) return false;
        if ((buffer[offset + i + 1] & 0xC0) !== 0x80) return false;
        i += 2;
      } else if ((byte & 0xF0) === 0xE0) {
        // 3字节UTF-8 (1110xxxx 10xxxxxx 10xxxxxx)
        if (i + 2 >= length) return false;
        if ((buffer[offset + i + 1] & 0xC0) !== 0x80) return false;
        if ((buffer[offset + i + 2] & 0xC0) !== 0x80) return false;
        i += 3;
      } else if ((byte & 0xF8) === 0xF0) {
        // 4字节UTF-8 (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
        if (i + 3 >= length) return false;
        if ((buffer[offset + i + 1] & 0xC0) !== 0x80) return false;
        if ((buffer[offset + i + 2] & 0xC0) !== 0x80) return false;
        if ((buffer[offset + i + 3] & 0xC0) !== 0x80) return false;
        i += 4;
      } else {
        // 无效的UTF-8起始字节
        return false;
      }
    }
    return true;
  }

  /**
   * 通过魔数检测文件类型
   * 
   * @param buffer 文件内容Buffer
   * @returns 检测到的文件类型信息，如果没有匹配则返回null
   */
  private static detectByMagicNumber(buffer: Buffer): { type: string; description: string } | null {
    for (const { pattern, type, description } of this.MAGIC_NUMBERS) {
      if (buffer.length >= pattern.length) {
        let match = true;
        for (let i = 0; i < pattern.length; i++) {
          if (buffer[i] !== pattern[i]) {
            match = false;
            break;
          }
        }
        if (match) {
          return { type, description };
        }
      }
    }
    return null;
  }

  /**
   * 基于文件扩展名判断是否为二进制文件
   * 
   * @param filePath 文件路径
   * @returns 是否为已知的二进制文件类型
   */
  private static isBinaryByExtension(filePath: string): boolean {
    const extension = this.getFileExtension(filePath);
    return this.BINARY_EXTENSIONS.has(extension);
  }

  /**
   * 获取文件扩展名
   * 
   * @param filePath 文件路径
   * @returns 小写的文件扩展名（不包含点号）
   */
  private static getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    if (lastDot === -1 || lastDot === filePath.length - 1) {
      return '';
    }
    return filePath.substring(lastDot + 1).toLowerCase();
  }


  /**
   * 检测换行符类型
   * 
   * @param content 文件内容
   * @returns 换行符类型
   */
  static detectLineEndingType(content: string): LineEndingType {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
    const crCount = (content.match(/\r(?!\n)/g) || []).length;

    if (crlfCount > 0 && lfCount === 0 && crCount === 0) {
      return LineEndingType.CRLF;
    } else if (lfCount > 0 && crlfCount === 0 && crCount === 0) {
      return LineEndingType.LF;
    } else if (crCount > 0 && crlfCount === 0 && lfCount === 0) {
      return LineEndingType.CR;
    } else {
      return LineEndingType.MIXED;
    }
  }


  /**
   * 全面分析文件内容
   *
   * @param content 文件内容
   * @param filePath 文件路径（可选，用于更准确的二进制检测）
   * @returns 完整的文件内容分析结果
   */
  static analyzeFileContent(
    content: string | Buffer,
    filePath?: string
  ): FileContentAnalysisResult {
    // 确保内容是字符串格式（除了二进制检测）
    const stringContent = typeof content === 'string' ? content : content.toString('utf8');

    return {
      binaryDetection: this.detectBinaryContent(content, filePath),
      lineEndingType: this.detectLineEndingType(stringContent)
    };
  }

  /**
   * 快速检查是否为二进制文件
   * 只返回布尔值，用于快速判断
   * 
   * @param content 文件内容
   * @param filePath 文件路径（可选）
   * @returns 是否为二进制文件
   */
  static isBinaryContent(content: string | Buffer, filePath?: string): boolean {
    return this.detectBinaryContent(content, filePath).isBinary;
  }

}