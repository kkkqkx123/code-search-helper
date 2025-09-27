import { Logger } from './logger';

/**
 * 日志服务类
 * 提供结构化的日志记录功能
 */
export class LoggerService {
  private logger: Logger;

  constructor(component?: string) {
    const serviceName = component || 'codebase-index-mcp';
    this.logger = new Logger(serviceName);
  }

  /**
   * 记录信息级别日志
   */
  async info(message: string, meta?: any): Promise<void> {
    if (meta) {
      await this.logger.info(message, meta);
    } else {
      await this.logger.info(message);
    }
  }

  /**
   * 记录错误级别日志
   */
  async error(message: string, error?: any): Promise<void> {
    if (error) {
      await this.logger.error(message, error);
    } else {
      await this.logger.error(message);
    }
  }

  /**
   * 记录警告级别日志
   */
  async warn(message: string, meta?: any): Promise<void> {
    if (meta) {
      await this.logger.warn(message, meta);
    } else {
      await this.logger.warn(message);
    }
  }

  /**
   * 记录调试级别日志
   */
  async debug(message: string, meta?: any): Promise<void> {
    if (meta) {
      await this.logger.debug(message, meta);
    } else {
      await this.logger.debug(message);
    }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logger.getLogFilePath();
  }

  /**
   * 标记为正常退出
   */
  async markAsNormalExit(): Promise<void> {
    await this.logger.markAsNormalExit();
  }
}