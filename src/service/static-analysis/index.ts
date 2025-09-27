/**
 * Static Analysis Service Integration
 *
 * This module provides the main entry point for unified static analysis services,
 * including Semgrep integration, result processing, and enhancement capabilities.
 */

// Core services
import { StaticAnalysisService } from './core/StaticAnalysisService';
import { SemgrepIntegrationService } from './core/SemgrepIntegrationService';
import { AnalysisCoordinatorService } from './core/AnalysisCoordinatorService';

// Processing services
import { ResultProcessorService } from './processing/ResultProcessorService';
import { RuleManagerService } from './processing/RuleManagerService';
import { EnhancementService } from './processing/EnhancementService';

// Types
import * as StaticAnalysisTypes from './types/StaticAnalysisTypes';

// Export services
export {
  StaticAnalysisService,
  SemgrepIntegrationService,
  AnalysisCoordinatorService,
  ResultProcessorService,
  RuleManagerService,
 EnhancementService,
};

// Export types
export { StaticAnalysisTypes };

// Export all types directly for convenience
export type {
  AnalysisRequest,
  AnalysisOptions,
  AnalysisResult,
  AnalysisContext,
  EnhancedFinding,
  SemgrepScanResult,
  SemgrepFinding,
  SemgrepRule,
  SemgrepScanOptions,
 AnalysisTask,
  ValidationResult,
} from './types/StaticAnalysisTypes';

/**
 * Service factory for dependency injection
 */
export class StaticAnalysisServiceFactory {
  static createStaticAnalysisService(
    logger: any,
    semgrepService: any,
    coordinator: any,
    processor: any,
    ruleManager: any,
    enhancer: any
  ): StaticAnalysisService {
    return new StaticAnalysisService(
      logger,
      semgrepService,
      coordinator,
      processor,
      ruleManager,
      enhancer
    );
  }

  static createSemgrepIntegrationService(
    logger: any,
    configService: any
  ): SemgrepIntegrationService {
    return new SemgrepIntegrationService(logger, configService);
  }

  static createAnalysisCoordinatorService(
    logger: any,
    eventQueue: any,
    semgrepService: any,
    nebulaService: any,
    qdrantService: any
  ): AnalysisCoordinatorService {
    return new AnalysisCoordinatorService(
      logger,
      eventQueue,
      semgrepService,
      nebulaService,
      qdrantService
    );
  }

  static createResultProcessorService(logger: any): ResultProcessorService {
    return new ResultProcessorService(logger);
  }

  static createRuleManagerService(logger: any, configService: any): RuleManagerService {
    return new RuleManagerService(logger, configService);
  }

  static createEnhancementService(logger: any): EnhancementService {
    return new EnhancementService(logger);
  }
}