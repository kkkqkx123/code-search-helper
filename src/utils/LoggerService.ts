import { injectable, inject } from 'inversify';
import { Logger } from './logger';
import { TYPES } from '../types';
import { ConfigService } from '../config/ConfigService';

/**
 * 日志服务类
 * 提供结构化的日志记录功能
 */
@injectable()
export class LoggerService {
  private logger: Logger;

  constructor(@inject(TYPES.ConfigService) private configService: ConfigService) {
    const serviceName = 'code-search-helper';
    // 延迟获取日志级别，避免在配置未初始化时访问
    let logLevel: string | undefined;
    try {
      logLevel = this.configService.get('logging')?.level;
    } catch (error) {
      // 配置未初始化时使用默认级别
      logLevel = 'info';
    }
    this.logger = new Logger(serviceName, logLevel);
  }

  /**
   * 记录信息级别日志
   */
  async info(message: string, meta?: any): Promise<void> {
    await this.logger.info(message, meta || {});
  }

  /**
   * 记录错误级别日志
   */
  async error(message: string, error?: any): Promise<void> {
    await this.logger.error(message, error || {});
 }

  /**
   * 记录警告级别日志
   */
  async warn(message: string, meta?: any): Promise<void> {
    await this.logger.warn(message, meta || {});
  }

  /**
   * 记录调试级别日志
   */
  async debug(message: string, meta?: any): Promise<void> {
    await this.logger.debug(message, meta || {});
 }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logger.getLogFilePath();
  }

  /**
   * 更新日志级别
   */
  updateLogLevel(level: string): void {
    this.logger.updateLogLevel(level);
  }

  /**
   * 标记为正常退出
   */
  async markAsNormalExit(): Promise<void> {
    await this.logger.markAsNormalExit();
  }
}