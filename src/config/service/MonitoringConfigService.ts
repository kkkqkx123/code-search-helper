import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface MonitoringConfig {
  enabled: boolean;
  port: number;
  prometheusTargetDir: string;
}

@injectable()
export class MonitoringConfigService extends BaseConfigService<MonitoringConfig> {
  loadConfig(): MonitoringConfig {
    const rawConfig = {
      enabled: process.env.ENABLE_METRICS === 'true',
      port: parseInt(process.env.METRICS_PORT || '9090'),
      prometheusTargetDir: process.env.PROMETHEUS_TARGET_DIR || './etc/prometheus',
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): MonitoringConfig {
    const schema = Joi.object({
      enabled: Joi.boolean().default(true),
      port: Joi.number().port().default(9090),
      prometheusTargetDir: Joi.string().default('./etc/prometheus'),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Monitoring config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): MonitoringConfig {
    return {
      enabled: true,
      port: 9090,
      prometheusTargetDir: './etc/prometheus',
    };
  }
}