// 文件检测识别模块
export { UnifiedDetectionService } from './UnifiedDetectionService';
export { FileFeatureDetector } from './FileFeatureDetector';
export { BackupFileProcessor } from './BackupFileProcessor';
export { LanguageDetectionService, LanguageDetectionResult } from './LanguageDetectionService';

// 向后兼容的导出（替换core目录的功能）
export { LanguageDetectionService as LanguageDetector } from './LanguageDetectionService';