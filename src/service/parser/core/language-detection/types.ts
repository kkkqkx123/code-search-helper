/**
 * 语言检测结果接口
 */
export interface LanguageDetectionResult {
  language: string | undefined;
  confidence: number;
  method: 'extension' | 'content' | 'fallback';
}