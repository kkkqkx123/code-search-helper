import fs from 'fs/promises';
import path from 'path';

export class Logger {
  private logFilePath: string;
  private logStream: fs.FileHandle | null = null;
  private isNormalExit: boolean = false;

  constructor(serviceName: string) {
    const timestamp = this.getChinaTimeString().replace(/[:.]/g, '-');
    const logFileName = `${serviceName}-${timestamp}.log`;
    this.logFilePath = path.join(process.cwd(), 'logs', logFileName);
    
    // 立即初始化日志目录和流
    this.initialize().catch(error => {
      console.error('Failed to initialize logger:', error);
    });
    
    // 设置进程退出处理
    this.setupExitHandlers();
  }

  /**
   * 获取中国时区(+8)的时间字符串
   */
  private getChinaTimeString(): string {
    const now = new Date();
    // 获取UTC时间戳（毫秒）
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
    // 加上8小时的毫秒数
    const chinaTime = new Date(utcTime + (8 * 60 * 60 * 1000));
    
    // 手动格式化为ISO字符串但保持+8时区
    const year = chinaTime.getFullYear();
    const month = String(chinaTime.getMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getDate()).padStart(2, '0');
    const hours = String(chinaTime.getHours()).padStart(2, '0');
    const minutes = String(chinaTime.getMinutes()).padStart(2, '0');
    const seconds = String(chinaTime.getSeconds()).padStart(2, '0');
    const milliseconds = String(chinaTime.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
  }

  private async initialize(): Promise<void> {
    await this.ensureLogDirectory();
    await this.ensureLogStream();
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private setupExitHandlers(): void {
    // 正常退出处理
    process.on('exit', () => {
      this.cleanup(this.isNormalExit);
    });

    // 异常退出处理
    process.on('SIGINT', async () => {
      this.isNormalExit = true;
      await this.cleanup(true);
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.isNormalExit = true;
      await this.cleanup(true);
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      await this.error('Uncaught Exception:', error);
      this.isNormalExit = false;
      await this.cleanup(false);
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      await this.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.isNormalExit = false;
      await this.cleanup(false);
      process.exit(1);
    });
  }

  private async cleanup(isNormalExit: boolean): Promise<void> {
    this.isNormalExit = isNormalExit;
    
    if (this.logStream) {
      await this.logStream.close();
      this.logStream = null;
    }

    // 如果是正常退出，删除日志文件
    if (isNormalExit) {
      try {
        await fs.unlink(this.logFilePath);
      } catch (error) {
        // 忽略删除文件时的错误
      }
    }
  }

  private async ensureLogStream(): Promise<void> {
    if (!this.logStream) {
      try {
        this.logStream = await fs.open(this.logFilePath, 'a');
      } catch (error) {
        console.error('Failed to open log file:', error);
      }
    }
  }

  private async writeLog(level: string, ...args: any[]): Promise<void> {
    // 确保日志流可用
    if (!this.logStream && !this.isNormalExit) {
      await this.ensureLogStream();
    }
    
    const timestamp = this.getChinaTimeString();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    // 尝试写入文件，如果失败则只输出到控制台
    if (this.logStream && !this.isNormalExit) {
      try {
        await this.logStream.write(logLine);
      } catch (error) {
        // 文件已关闭或写入失败时，关闭流并只输出到控制台
        console.warn('Failed to write to log file, closing stream:', error);
        try {
          await this.logStream.close();
        } catch (closeError) {
          // 忽略关闭错误
        }
        this.logStream = null;
      }
    }
    
    // 同时输出到控制台
    const consoleMessage = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    console.log(`[${level}] ${consoleMessage}`);
  }

  async info(...args: any[]): Promise<void> {
    await this.writeLog('INFO', ...args);
  }

  async error(...args: any[]): Promise<void> {
    await this.writeLog('ERROR', ...args);
  }

  async warn(...args: any[]): Promise<void> {
    await this.writeLog('WARN', ...args);
  }

  async debug(...args: any[]): Promise<void> {
    await this.writeLog('DEBUG', ...args);
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  async markAsNormalExit(): Promise<void> {
    this.isNormalExit = true;
    await this.cleanup(true);
  }
}