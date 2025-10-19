import { injectable, inject } from 'inversify';
import { ConfigService } from '../ConfigService';
import { FaultToleranceOptions } from '../../utils/FaultToleranceHandler';
import { TYPES } from '../../types';

@injectable()
export class GraphConfigService {
  private configService: ConfigService;
  
  constructor(@inject(TYPES.ConfigService) configService: ConfigService) {
    this.configService = configService;
  }
  
  getFaultToleranceOptions(): FaultToleranceOptions {
    // 直接返回默认的容错配置选项，因为 AppConfig 中没有专门的图形容错配置
    return {
      maxRetries: 3,
      retryDelay: 1000,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      circuitBreakerFailureThreshold: 5,
      circuitBreakerTimeout: 3000,
      fallbackStrategy: 'cache'
    };
  }
}