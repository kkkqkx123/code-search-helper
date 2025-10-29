import { DetectionResult } from '../../../detection/UnifiedDetectionService';

export interface IProcessingStrategy {
  execute(filePath: string, content: string, detection: DetectionResult): Promise<{
    chunks: any[];
    metadata?: any;
  }>;
  getName(): string;
  getDescription(): string;
}