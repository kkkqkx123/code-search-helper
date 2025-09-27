import fs from 'fs/promises';
import path from 'path';

export class Logger {
  private logFilePath: string;
  private logStream: fs.FileHandle | null = null;
  private isNormalExit: boolean = false;

  constructor(serviceName: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFileName = `${serviceName}-${timestamp}.log`;
    this.logFilePath = path.join(process.cwd(), 'logs', logFileName);
    
    // 确保日志目录存在
    this.ensureLogDirectory();
    
    // 设置进程退出处理
    this.setupExitHandlers();
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
    // 如果日志流已关闭或不可用，只输出到控制台
    if (!this.logStream || this.isNormalExit) {
      const consoleMessage = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      console.log(`[${level}] ${consoleMessage}`);
      return;
    }
    
    const timestamp = new Date().toISOString();
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    try {
      await this.logStream.write(logLine);
    } catch (error) {
      // 文件已关闭或写入失败时，只输出到控制台
      const consoleMessage = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      console.log(`[${level}] ${consoleMessage}`);
      console.warn('Failed to write to log file:', error);
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
}