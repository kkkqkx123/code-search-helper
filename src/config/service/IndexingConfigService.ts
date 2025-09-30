import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

export interface IndexingConfig {
  batchSize: number;
  maxConcurrency: number;
}

@injectable()
export class IndexingConfigService extends BaseConfigService<IndexingConfig> {
  loadConfig(): IndexingConfig {
    const rawConfig = {
      batchSize: parseInt(process.env.INDEXING_BATCH_SIZE || '50'),
      maxConcurrency: parseInt(process.env.INDEXING_MAX_CONCURRENCY || '3'),
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): IndexingConfig {
    const schema = Joi.object({
      batchSize: Joi.number().positive().default(50),
      maxConcurrency: Joi.number().positive().default(3),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Indexing config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): IndexingConfig {
    return {
      batchSize: 50,
      maxConcurrency: 3,
    };
  }
}