import * as fs from 'fs';
import * as path from 'path';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  configFiles: string[];
  extensions: Record<string, number>;
}

export function detectLanguageSync(workspaceRoot: string): LanguageDetectionResult | null {
  try {
    const stats = {
      typescript: {
        confidence: 0,
        configFiles: [] as string[],
        extensions: {} as Record<string, number>,
      },
      javascript: {
        confidence: 0,
        configFiles: [] as string[],
        extensions: {} as Record<string, number>,
      },
      python: {
        confidence: 0,
        configFiles: [] as string[],
        extensions: {} as Record<string, number>,
      },
    };

    // 检查配置文件
    const configFiles = {
      typescript: ['tsconfig.json', 'package.json'],
      javascript: ['package.json'],
      python: ['requirements.txt', 'setup.py', 'pyproject.toml'],
    };

    for (const [lang, files] of Object.entries(configFiles)) {
      for (const configFile of files) {
        const filePath = path.join(workspaceRoot, configFile);
        if (fs.existsSync(filePath)) {
          stats[lang as keyof typeof stats].confidence += 50;
          stats[lang as keyof typeof stats].configFiles.push(configFile);
        }
      }
    }

    // 扫描文件扩展名
    const extensions = scanFileExtensionsSync(workspaceRoot);

    // 根据扩展名增加置信度
    const extensionMapping: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.py': 'python',
    };

    for (const [ext, count] of Object.entries(extensions)) {
      const lang = extensionMapping[ext];
      if (lang && stats[lang as keyof typeof stats]) {
        stats[lang as keyof typeof stats].confidence += count * 10;
        stats[lang as keyof typeof stats].extensions[ext] = count;
      }
    }

    // 找出最高置信度的语言
    let bestLanguage = '';
    let bestConfidence = 0;
    let bestConfigFiles: string[] = [];
    let bestExtensions: Record<string, number> = {};

    for (const [lang, data] of Object.entries(stats)) {
      if (data.confidence > bestConfidence) {
        bestLanguage = lang;
        bestConfidence = data.confidence;
        bestConfigFiles = data.configFiles;
        bestExtensions = data.extensions;
      }
    }

    if (bestConfidence === 0) {
      return {
        language: 'javascript',
        confidence: 10,
        configFiles: [],
        extensions: {},
      };
    }

    return {
      language: bestLanguage,
      confidence: bestConfidence,
      configFiles: bestConfigFiles,
      extensions: bestExtensions,
    };
  } catch (error) {
    console.warn('Failed to detect language:', error);
    return null;
  }
}

export function scanFileExtensionsSync(
  dir: string,
  maxDepth: number = 2,
  maxFiles: number = 100
): Record<string, number> {
  const extensions: Record<string, number> = {};
  let fileCount = 0;

  function scanDirectory(currentDir: string, depth: number) {
    if (depth > maxDepth || fileCount >= maxFiles) {
      return;
    }

    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          if (
            !item.name.startsWith('.') &&
            item.name !== 'node_modules' &&
            item.name !== '__pycache__'
          ) {
            scanDirectory(path.join(currentDir, item.name), depth + 1);
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          if (ext) {
            extensions[ext] = (extensions[ext] || 0) + 1;
            fileCount++;
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }
  }

  scanDirectory(dir, 0);
  return extensions;
}

export function findWorkspaceRoot(filePath: string): string | null {
  const resolvedPath = path.resolve(filePath);
  let currentDir = path.dirname(resolvedPath);

  // 向上查找包含配置文件的最接近目录
  while (currentDir !== path.dirname(currentDir)) {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'requirements.txt',
      'setup.py',
      'pyproject.toml',
      '.git',
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(currentDir, configFile);
      if (fs.existsSync(configPath)) {
        return currentDir;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

export function isLanguageServerAvailable(command: string): Promise<boolean> {
  try {
    const { spawn } = require('child_process');
    const process = spawn(command, ['--version'], { stdio: 'pipe' });

    return new Promise(resolve => {
      process.on('exit', (code: number) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        process.kill();
        resolve(false);
      }, 2000);
    });
  } catch (error) {
    return Promise.resolve(false);
  }
}

export function validateLSPConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { valid: false, errors };
  }

  if (config.languages && typeof config.languages !== 'object') {
    errors.push('languages must be an object');
  }

  if (config.connection_pool) {
    const pool = config.connection_pool;
    if (pool.max_connections && typeof pool.max_connections !== 'number') {
      errors.push('max_connections must be a number');
    }
    if (pool.idle_timeout && typeof pool.idle_timeout !== 'number') {
      errors.push('idle_timeout must be a number');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createLSPTimeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = 'LSP operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    }),
  ]);
}

export function sanitizeFilePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}

export function getFileLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
  };

  return languageMap[ext] || 'unknown';
}

export function formatLSPRange(range: {
  start: { line: number; character: number };
  end: { line: number; character: number };
}): string {
  const { start, end } = range;

  if (start.line === end.line) {
    return `line ${start.line + 1}, character ${start.character + 1}-${end.character + 1}`;
  } else {
    return `line ${start.line + 1}:${start.character + 1} to line ${end.line + 1}:${end.character + 1}`;
  }
}

export function createLSPRetryPolicy(
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): (attempt: number) => number {
  return (attempt: number) => {
    if (attempt >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded`);
    }

    // 指数退避
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    return delay;
  };
}
