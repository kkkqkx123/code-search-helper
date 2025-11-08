import { PerformanceStats } from '../../strategies/types/SegmentationTypes';
import { LoggerService } from '../../../../../utils/LoggerService';
import { BasePerformanceTracker } from '../base/BasePerformanceTracker';

export class PerformanceMonitor extends BasePerformanceTracker {
  constructor(logger?: LoggerService) {
    super(logger);
  }
}