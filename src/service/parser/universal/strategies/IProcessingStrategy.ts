import { DetectionResult } from '../UnifiedDetectionCenter';

export interface IProcessingStrategy {
  execute(filePath: string, content: string, detection: DetectionResult): Promise<{
    chunks: any[];
    metadata?: any;
  }>;
  getName(): string;
  getDescription(): string;
}