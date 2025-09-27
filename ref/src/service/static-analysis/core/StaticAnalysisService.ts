import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { SemgrepIntegrationService } from './SemgrepIntegrationService';
import { AnalysisCoordinatorService } from './AnalysisCoordinatorService';
import { ResultProcessorService } from '../processing/ResultProcessorService';
import { RuleManagerService } from '../processing/RuleManagerService';
import { EnhancementService } from '../processing/EnhancementService';
import { AnalysisRequest, AnalysisResult, AnalysisOptions } from '../types/StaticAnalysisTypes';

/**
 * Unified Static Analysis Service
 * Main entry point for all static analysis functionality
 */
@injectable()
export class StaticAnalysisService {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.SemgrepIntegrationService) private semgrepService: SemgrepIntegrationService,
    @inject(TYPES.AnalysisCoordinatorService) private coordinator: AnalysisCoordinatorService,
    @inject(TYPES.ResultProcessorService) private processor: ResultProcessorService,
    @inject(TYPES.RuleManagerService) private ruleManager: RuleManagerService,
    @inject(TYPES.EnhancementService) private enhancer: EnhancementService
  ) {}

  /**
   * Analyze a project with the specified analysis type and options
   */
  async analyzeProject(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      this.logger.info(`Starting static analysis for ${request.projectPath}`);
      
      // Validate the request
      const validationResult = await this.validateRequest(request);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: 'Invalid analysis request',
          errors: validationResult.errors,
          findings: [],
          metrics: {},
          recommendations: []
        };
      }

      // Coordinate the analysis task
      const rawResults = await this.coordinator.coordinateAnalysis(request);

      // Process and enhance the results
      const processedResults = await this.processor.processResults(rawResults, {
        projectPath: request.projectPath,
        analysisType: request.analysisType,
        options: request.options
      });

      // Apply enhancements based on analysis type
      const enhancedResults = await this.enhancer.enhanceResults(processedResults, request);

      this.logger.info(`Static analysis completed for ${request.projectPath}`);
      
      return {
        success: true,
        message: 'Analysis completed successfully',
        findings: enhancedResults.findings,
        metrics: enhancedResults.metrics,
        recommendations: enhancedResults.recommendations,
        enhancedData: enhancedResults.enhancedData
      };
    } catch (error) {
      this.logger.error(`Static analysis failed for ${request.projectPath}:`, error);
      return {
        success: false,
        message: 'Analysis failed',
        errors: [error instanceof Error ? error.message : String(error)],
        findings: [],
        metrics: {},
        recommendations: []
      };
    }
  }

  /**
   * Validate analysis request
   */
  private async validateRequest(request: AnalysisRequest): Promise<{ isValid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    // Check if project path exists
    if (!request.projectPath) {
      errors.push('Project path is required');
    }

    // Validate analysis type
    const validTypes = ['basic', 'security', 'control-flow', 'data-flow', 'comprehensive'];
    if (!validTypes.includes(request.analysisType)) {
      errors.push(`Invalid analysis type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate options if provided
    if (request.options) {
      if (request.options.severity && !Array.isArray(request.options.severity)) {
        errors.push('Severity options must be an array');
      }
      
      if (request.options.rules && !Array.isArray(request.options.rules)) {
        errors.push('Rules options must be an array');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get available analysis rules
   */
  async getAvailableRules(): Promise<any[]> {
    return this.ruleManager.getAvailableRules();
  }

  /**
   * Add a custom rule
   */
  async addCustomRule(rule: any): Promise<void> {
    return this.ruleManager.addCustomRule(rule);
  }

  /**
   * Validate a rule
   */
  async validateRule(rule: any): Promise<any> {
    return this.ruleManager.validateRule(rule);
  }
}