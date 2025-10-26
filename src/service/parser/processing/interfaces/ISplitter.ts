import { CodeChunk } from '..';

/**
 * 代码分割器基础接口
 */
export interface ISplitter {
  /**
   * 分割代码
   * @param code 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   */
  split(code: string, language: string, filePath?: string): Promise<CodeChunk[]>;

  /**
   * 设置块大小
   * @param chunkSize 块大小
   */
  setChunkSize(chunkSize: number): void;

  /**
   * 设置块重叠大小
   * @param chunkOverlap 重叠大小
   */
  setChunkOverlap(chunkOverlap: number): void;
}