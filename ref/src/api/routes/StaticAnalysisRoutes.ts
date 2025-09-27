import { Request, Response, Router } from 'express';
import { inject, injectable } from 'inversify';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { LoggerService } from '../../core/LoggerService';
import { AnalysisCoordinatorService } from '../../services/static-analysis/core/AnalysisCoordinatorService';
import { SemgrepIntegrationService } from '../../services/static-analysis/core/SemgrepIntegrationService';
import { RuleManagerService } from '../../services/static-analysis/processing/RuleManagerService';
import {
  SemgrepScanOptions as ScanOptions,
  SemgrepRule as SecurityRule,
} from '../../models/StaticAnalysisTypes';
import { SemgrepFinding } from '../../services/static-analysis/types/StaticAnalysisTypes';

/**
 * 静态分析API路由
 * 提供静态分析相关的REST API端点
 */
@injectable()
export class StaticAnalysisRoutes {
  public router: Router = Router();
  private logger: LoggerService;
  private coordinator: AnalysisCoordinatorService;
  private scanService: SemgrepIntegrationService;
  private ruleManager: RuleManagerService;

  /**
   * Helper function to safely extract error message
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  constructor() {
    const container = DIContainer.getInstance();
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.coordinator = container.get<AnalysisCoordinatorService>(TYPES.AnalysisCoordinatorService);
    this.scanService = container.get<SemgrepIntegrationService>(TYPES.SemgrepIntegrationService);
    this.ruleManager = container.get<RuleManagerService>(TYPES.RuleManagerService);
    this.setupRoutes();
  }
  private setupRoutes(): void {
    // 项目扫描相关
    this.router.post('/scan/project', this.scanProject.bind(this));
    this.router.get('/scan/status/:taskId', this.getScanStatus.bind(this));
    this.router.get('/scan/history/:projectPath', this.getScanHistory.bind(this));

    // 规则管理相关
    this.router.get('/rules', this.getAvailableRules.bind(this));
    this.router.post('/rules/validate', this.validateRule.bind(this));
    this.router.post('/rules/custom', this.addCustomRule.bind(this));
    this.router.get('/rules/templates', this.getRuleTemplates.bind(this));

    // 结果查询相关
    this.router.get('/findings/:projectPath', this.getFindings.bind(this));
    this.router.get('/summary/:projectPath', this.getSummary.bind(this));

    // 系统状态
    this.router.get('/system/status', this.getSystemStatus.bind(this));
    this.router.post('/system/cleanup', this.cleanupOldData.bind(this));
  }

  /**
   * 扫描项目
   * POST /api/static-analysis/scan/project
   */
  private async scanProject(req: any, res: any): Promise<void> {
    try {
      const { projectPath, options } = req.body;

      if (!projectPath) {
        res.status(400).json({
          error: 'projectPath is required',
        });
        return;
      }

      const taskId = await this.coordinator.queueScanTask(projectPath, options);

      res.json({
        taskId,
        status: 'queued',
        message: 'Scan task queued successfully',
      });
    } catch (error) {
      this.logger.error('Failed to queue scan task:', error);
      res.status(500).json({
        error: 'Failed to queue scan task',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取扫描任务状态
   * GET /api/static-analysis/scan/status/:taskId
   */
  private async getScanStatus(req: any, res: any): Promise<void> {
    try {
      const { taskId } = req.params;
      const task = await this.coordinator.getTaskStatus(taskId);

      if (!task) {
        res.status(404).json({
          error: 'Task not found',
        });
        return;
      }

      res.json({
        task,
      });
    } catch (error) {
      this.logger.error('Failed to get task status:', error);
      res.status(500).json({
        error: 'Failed to get task status',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取项目扫描历史
   * GET /api/static-analysis/scan/history/:projectPath
   */
  private async getScanHistory(req: any, res: any): Promise<void> {
    try {
      const { projectPath } = req.params;
      const history = await this.coordinator.getProjectScanHistory(decodeURIComponent(projectPath));

      res.json({
        history,
        count: history.length,
      });
    } catch (error) {
      this.logger.error('Failed to get scan history:', error);
      res.status(500).json({
        error: 'Failed to get scan history',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取可用规则
   * GET /api/static-analysis/rules
   */
  private async getAvailableRules(req: any, res: any): Promise<void> {
    try {
      const rules = await this.scanService.getAvailableRules();

      res.json({
        rules,
        count: rules.length,
      });
    } catch (error) {
      this.logger.error('Failed to get available rules:', error);
      res.status(500).json({
        error: 'Failed to get available rules',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 验证规则
   * POST /api/static-analysis/rules/validate
   */
  private async validateRule(req: any, res: any): Promise<void> {
    try {
      const { rule } = req.body;

      if (!rule) {
        res.status(400).json({
          error: 'rule is required',
        });
        return;
      }

      const validation = await this.scanService.validateRule(rule);

      res.json({
        valid: validation.valid,
        errors: validation.errors,
      });
    } catch (error) {
      this.logger.error('Failed to validate rule:', error);
      res.status(500).json({
        error: 'Failed to validate rule',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 添加自定义规则
   * POST /api/static-analysis/rules/custom
   */
  private async addCustomRule(req: any, res: any): Promise<void> {
    try {
      const { rule } = req.body;

      if (!rule) {
        res.status(400).json({
          error: 'rule is required',
        });
        return;
      }

      const ruleId = await this.scanService.addCustomRule(rule);

      res.json({
        ruleId,
        message: 'Custom rule added successfully',
      });
    } catch (error) {
      this.logger.error('Failed to add custom rule:', error);
      res.status(500).json({
        error: 'Failed to add custom rule',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取规则模板
   * GET /api/static-analysis/rules/templates
   */
  private async getRuleTemplates(req: any, res: any): Promise<void> {
    try {
      const templates = this.ruleManager.generateRuleTemplates();

      res.json({
        templates,
        count: templates.length,
      });
    } catch (error) {
      this.logger.error('Failed to get rule templates:', error);
      res.status(500).json({
        error: 'Failed to get rule templates',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取项目发现的问题
   * GET /api/static-analysis/findings/:projectPath
   */
  private async getFindings(req: any, res: any): Promise<void> {
    try {
      const { projectPath } = req.params;
      const { severity, ruleId, file } = req.query;

      // 这里应该从数据库查询，暂时返回空数组
      const findings: SemgrepFinding[] = [];

      res.json({
        findings,
        count: findings.length,
      });
    } catch (error) {
      this.logger.error('Failed to get findings:', error);
      res.status(500).json({
        error: 'Failed to get findings',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取项目摘要
   * GET /api/static-analysis/summary/:projectPath
   */
  private async getSummary(req: any, res: any): Promise<void> {
    try {
      const { projectPath } = req.params;
      const history = await this.coordinator.getProjectScanHistory(decodeURIComponent(projectPath));

      if (history.length === 0) {
        res.json({
          summary: 'No scan history found',
          criticalIssues: [],
          recommendations: ['Run a scan to get started'],
        });
        return;
      }

      // 获取最新扫描结果
      const latestScan = history[0];

      res.json({
        summary: `Latest scan: ${latestScan.summary.totalFindings} findings in ${latestScan.summary.totalFiles} files`,
        criticalIssues: latestScan.findings.filter((f) => f.severity === 'ERROR'),
        recommendations: [
          'Review critical issues first',
          'Address warnings in high-impact areas',
          'Consider adding custom rules for project-specific patterns',
        ],
      });
    } catch (error) {
      this.logger.error('Failed to get summary:', error);
      res.status(500).json({
        error: 'Failed to get summary',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 获取系统状态
   * GET /api/static-analysis/system/status
   */
  private async getSystemStatus(req: any, res: any): Promise<void> {
    try {
      const status = await this.coordinator.getSystemStatus();

      res.json({
        status,
      });
    } catch (error) {
      this.logger.error('Failed to get system status:', error);
      res.status(500).json({
        error: 'Failed to get system status',
        details: this.getErrorMessage(error),
      });
    }
  }

  /**
   * 清理旧数据
   * POST /api/static-analysis/system/cleanup
   */
  private async cleanupOldData(req: any, res: any): Promise<void> {
    try {
      const { retentionDays = 30 } = req.body;

      await this.coordinator.cleanupOldData(retentionDays);

      res.json({
        message: `Cleaned up data older than ${retentionDays} days`,
      });
    } catch (error) {
      this.logger.error('Failed to cleanup old data:', error);
      res.status(500).json({
        error: 'Failed to cleanup old data',
        details: this.getErrorMessage(error),
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
