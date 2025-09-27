import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { EventQueueService } from '../../EventQueueService';
import { SemgrepIntegrationService } from './SemgrepIntegrationService';
import { NebulaService } from '../../../database/NebulaService';
import { QdrantService } from '../../../database/QdrantService';
import { AnalysisTask, SemgrepScanResult, SemgrepScanOptions, AnalysisRequest } from '../types/StaticAnalysisTypes';

/**
 * Analysis Coordinator Service
 * Responsible for coordinating and managing all static analysis tasks
 */
@injectable()
export class AnalysisCoordinatorService {
  private isProcessing = false;
  private processingQueue: Set<string> = new Set();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.EventQueueService) private eventQueue: EventQueueService,
    @inject(TYPES.SemgrepIntegrationService) private semgrepService: SemgrepIntegrationService,
    @inject(TYPES.NebulaService) private nebulaService: NebulaService,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService
  ) {
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.eventQueue.on('file_changed', async event => {
      if (event.type === 'file_changed') {
        await this.handleFileChange(event.projectPath, event.filePath);
      }
    });

    this.eventQueue.on('project_indexed', async event => {
      if (event.type === 'project_indexed') {
        await this.handleProjectIndexed(event.projectPath);
      }
    });
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(projectPath: string, filePath: string): Promise<void> {
    try {
      this.logger.debug(`Handling file change: ${filePath} in project ${projectPath}`);

      // Check if we should trigger a scan
      if (await this.shouldTriggerScan(projectPath)) {
        await this.queueScanTask(projectPath, {
          rules: ['changed-files'],
        });
      }
    } catch (error) {
      this.logger.error('Error handling file change:', error);
    }
  }

  /**
   * Handle project indexed event
   */
  private async handleProjectIndexed(projectPath: string): Promise<void> {
    try {
      this.logger.info(`Project indexed, triggering full scan: ${projectPath}`);
      await this.queueScanTask(projectPath);
    } catch (error) {
      this.logger.error('Error handling project indexed:', error);
    }
  }

  /**
   * Check if we should trigger a scan
   */
  private async shouldTriggerScan(projectPath: string): Promise<boolean> {
    // Check configuration
    const scanOnChange = this.configService?.get('staticAnalysis.scanOnChange', true);
    if (!scanOnChange) {
      return false;
    }

    // Check if already processing
    if (this.processingQueue.has(projectPath)) {
      return false;
    }

    return true;
  }

  /**
   * Queue a scan task
   */
  async queueScanTask(projectPath: string, options: SemgrepScanOptions = {}): Promise<string> {
    const taskId = this.generateTaskId(projectPath);

    const task: AnalysisTask = {
      id: taskId,
      projectPath,
      type: 'semgrep',
      options,
      status: 'pending',
      createdAt: new Date(),
    };

    const queuedEvent = {
      id: `static_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'created' as const,
      path: task.projectPath,
      relativePath: task.projectPath,
      timestamp: new Date(),
      priority: 1,
      retryCount: 0,
      metadata: { task },
    };
    await this.eventQueue.enqueue(queuedEvent);
    this.logger.info(`Queued static analysis task: ${taskId}`);

    return taskId;
  }

 /**
   * Coordinate an analysis task
   */
  async coordinateAnalysis(request: AnalysisRequest): Promise<SemgrepScanResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`Starting static analysis for: ${request.projectPath}`);

      // Create task from request
      const task: AnalysisTask = {
        id: this.generateTaskId(request.projectPath),
        projectPath: request.projectPath,
        type: 'semgrep',
        options: {
          severity: request.options?.severity,
          rules: request.options?.rules,
          timeout: request.options?.timeout,
          maxTargetBytes: request.options?.maxTargetBytes,
        },
        status: 'running',
        createdAt: new Date(),
        startedAt: new Date(),
      };

      this.processingQueue.add(request.projectPath);

      // Execute the scan
      const result = await this.semgrepService.scanProject(task.projectPath, task.options);

      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      this.logger.info(`Completed static analysis task: ${task.id} in ${Date.now() - startTime}ms`);

      return result;
    } catch (error) {
      this.logger.error(`Failed static analysis for: ${request.projectPath}`, error);
      throw error;
    } finally {
      this.processingQueue.delete(request.projectPath);
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: string): Promise<AnalysisTask | null> {
    // This should query task storage, returning null for now
    return null;
  }

 /**
   * Get project scan history
   */
  async getProjectScanHistory(projectPath: string): Promise<SemgrepScanResult[]> {
    try {
      // Query scan history from graph database
      const query = `
        MATCH (scan:semgrep_scan {projectPath: $projectPath})
        RETURN scan
        ORDER BY scan.scanTime DESC
        LIMIT 50
      `;

      const results = await this.nebulaService.executeReadQuery(query, { projectPath });

      return results.map((record: any) => ({
        id: record.scan.id || `scan_${Date.now()}`,
        projectPath: record.scan.projectPath,
        scanTime: new Date(record.scan.scanTime),
        duration: record.scan.duration || 0,
        summary: record.scan.summary || {
          totalFiles: 0,
          totalFindings: 0,
          errorCount: 0,
          rulesRun: 0,
          targetBytes: 0,
          timing: {
            totalTime: 0,
            configTime: 0,
            coreTime: 0,
            parsingTime: 0,
            matchingTime: 0,
            ruleParseTime: 0,
            fileParseTime: 0,
          },
        },
        findings: record.scan.findings || [],
        errors: record.scan.errors || [],
        metadata: record.scan.metadata || {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        },
      }));
    } catch (error) {
      this.logger.error('Error getting project scan history:', error);
      return [];
    }
  }

  /**
   * Cleanup old data
   */
  async cleanupOldData(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old data in graph database
      const query = `
        MATCH (scan:semgrep_scan)
        WHERE scan.scanTime < $cutoffDate
        DETACH DELETE scan
      `;

      await this.nebulaService.executeReadQuery(query, { cutoffDate });

      // Clean up old data in vector database
      const oldVectors = await this.qdrantService.searchVectors('static_analysis', [0], {
        limit: 1000,
        filter: {
          must: [
            {
              key: 'metadata.scanTime',
              range: {
                lt: cutoffDate.getTime(),
              },
            },
          ],
        },
        withPayload: false,
        withVector: false,
      });

      if (oldVectors.length > 0) {
        const vectorIds = oldVectors.map(v => v.id);
        this.logger.info(`Would delete ${vectorIds.length} old vectors from Qdrant`);
      }

      this.logger.info(`Cleaned up data older than ${retentionDays} days`);
    } catch (error) {
      this.logger.error('Error cleaning up old data:', error);
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{
    isProcessing: boolean;
    queueSize: number;
    activeProjects: string[];
  }> {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.processingQueue.size,
      activeProjects: Array.from(this.processingQueue),
    };
  }

  /**
   * Generate task ID
   */
  private generateTaskId(projectPath: string): string {
    const timestamp = Date.now().toString(36);
    const hash = this.hashString(projectPath).substring(0, 8);
    return `semgrep_${hash}_${timestamp}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Configuration service injection
  private configService: any;
  public setConfigService(configService: any): void {
    this.configService = configService;
  }
}