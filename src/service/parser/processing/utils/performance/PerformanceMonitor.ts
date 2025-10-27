import { PerformanceMonitor as PerformanceMonitorInterface, PerformanceStats } from '../../types/splitting-types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { BasePerformanceTracker } from '../base/BasePerformanceTracker';

export class PerformanceMonitor extends BasePerformanceTracker implements PerformanceMonitorInterface {
  constructor(logger?: LoggerService) {
    super(logger);
  }
}