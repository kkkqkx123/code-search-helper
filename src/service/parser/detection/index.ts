// 文件检测识别模块
export { DetectionService as UnifiedDetectionService } from './DetectionService';
export { DetectionService, DetectionResult, LanguageDetectionInfo, FileFeatures } from './DetectionService';
export { FileFeatureDetector } from './FileFeatureDetector';
export { IFileFeatureDetector } from './IFileFeatureDetector';
export { BackupFileProcessor } from './BackupFileProcessor';

// 向后兼容的导出（替换core目录的功能）
export { DetectionService as LanguageDetector } from './DetectionService';