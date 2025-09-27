import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore - js-yaml缺少类型定义
const yaml: any = require('js-yaml');

export interface LanguageServerConfig {
  language: string;
  enabled: boolean;
  server: string;
  command: string;
  args?: string[];
  timeout?: number;
  config_files?: string[];
  file_extensions?: string[];
}

export interface ProjectLanguage {
  language: string;
  confidence: number;
  config_files: string[];
}

export class LanguageServerRegistry {
  detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    
    for (const [language, config] of this.config) {
      if (config.file_extensions?.includes(ext)) {
        return language;
      }
    }
    
    return null;
  }

  detectLanguageFromConfig(filePath: string): string | null {
    const dir = path.dirname(filePath);
    
    for (const [language, config] of this.config) {
      if (config.config_files) {
        for (const configFile of config.config_files) {
          const configPath = path.join(dir, configFile);
          if (fs.existsSync(configPath)) {
            return language;
          }
        }
      }
    }
    
    return null;
  }

  findWorkspaceRoot(filePath: string): string | null {
    let currentDir = path.dirname(filePath);
    
    while (currentDir !== path.dirname(currentDir)) {
      for (const config of this.config.values()) {
        if (config.config_files) {
          for (const configFile of config.config_files) {
            const configPath = path.join(currentDir, configFile);
            if (fs.existsSync(configPath)) {
              return currentDir;
            }
          }
        }
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
  validateServerConfig(config: {
    command: string;
    args: string[];
    extensions: string[];
    configFiles: string[];
  }): boolean {
    if (!config.command || typeof config.command !== 'string') {
      return false;
    }

    if (!Array.isArray(config.args) || !config.args.every(arg => typeof arg === 'string')) {
      return false;
    }

    if (
      !Array.isArray(config.extensions) ||
      !config.extensions.every(ext => typeof ext === 'string')
    ) {
      return false;
    }

    if (
      !Array.isArray(config.configFiles) ||
      !config.configFiles.every(file => typeof file === 'string')
    ) {
      return false;
    }

    return true;
  }
  private static instance: LanguageServerRegistry;
  private config: Map<string, LanguageServerConfig> = new Map();
  private projectCache = new Map<string, ProjectLanguage>();

  private constructor() {
    this.loadConfig();
  }

  static getInstance(): LanguageServerRegistry {
    if (!LanguageServerRegistry.instance) {
      LanguageServerRegistry.instance = new LanguageServerRegistry();
    }
    return LanguageServerRegistry.instance;
  }

  private loadConfig(): void {
    try {
      const configPath = path.join(process.cwd(), 'config', 'lsp-config.yml');

      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const parsed = yaml.load(configContent) as any;

        if (parsed?.lsp?.languages) {
          Object.entries(parsed.lsp.languages).forEach(([lang, config]: [string, any]) => {
            const serverConfig: LanguageServerConfig = {
              language: lang,
              enabled: config.enabled || false,
              server: config.server || lang,
              command: config.command || config.server || lang,
              args: config.args || [],
              timeout: config.timeout || 30000,
              config_files: config.config_files || [],
              file_extensions: this.getDefaultExtensions(lang),
            };

            this.config.set(lang, serverConfig);
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load LSP config, using defaults:', error);
      this.loadDefaultConfig();
    }
  }

  private loadDefaultConfig(): void {
    const defaults: LanguageServerConfig[] = [
      {
        language: 'typescript',
        enabled: true,
        server: 'typescript-language-server',
        command: 'npx',
        args: ['typescript-language-server', '--stdio'],
        timeout: 30000,
        config_files: ['tsconfig.json', 'package.json'],
        file_extensions: ['.ts', '.tsx'],
      },
      {
        language: 'javascript',
        enabled: true,
        server: 'typescript-language-server',
        command: 'npx',
        args: ['typescript-language-server', '--stdio'],
        timeout: 30000,
        config_files: ['package.json'],
        file_extensions: ['.js', '.jsx', '.mjs'],
      },
      {
        language: 'python',
        enabled: false,
        server: 'pylsp',
        command: 'pylsp',
        timeout: 15000,
        config_files: ['requirements.txt', 'setup.py', 'pyproject.toml'],
        file_extensions: ['.py'],
      },
    ];

    defaults.forEach(config => {
      this.config.set(config.language, config);
    });
  }

  private getDefaultExtensions(language: string): string[] {
    const extensions: Record<string, string[]> = {
      typescript: ['.ts', '.tsx'],
      javascript: ['.js', '.jsx', '.mjs'],
      python: ['.py'],
      java: ['.java'],
      go: ['.go'],
      rust: ['.rs'],
    };

    return extensions[language] || [];
  }

  getServerConfig(workspaceRoot: string): LanguageServerConfig | null {
    const language = this.detectProjectLanguage(workspaceRoot);

    if (!language) {
      return null;
    }

    const config = this.config.get(language.language);

    if (!config || !config.enabled) {
      return null;
    }

    return config;
  }

  detectProjectLanguage(workspaceRoot: string): ProjectLanguage | null {
    // 检查缓存
    if (this.projectCache.has(workspaceRoot)) {
      return this.projectCache.get(workspaceRoot)!;
    }

    try {
      const detected = this.performLanguageDetection(workspaceRoot);
      this.projectCache.set(workspaceRoot, detected);
      return detected;
    } catch (error) {
      console.warn(`Failed to detect language for ${workspaceRoot}:`, error);
      return null;
    }
  }

  private performLanguageDetection(workspaceRoot: string): ProjectLanguage {
    const stats: Record<string, { confidence: number; config_files: string[] }> = {
      typescript: { confidence: 0, config_files: [] },
      javascript: { confidence: 0, config_files: [] },
      python: { confidence: 0, config_files: [] },
    };

    // 检查配置文件
    this.config.forEach((config, lang) => {
      if (config.config_files) {
        config.config_files.forEach(configFile => {
          const filePath = path.join(workspaceRoot, configFile);
          if (fs.existsSync(filePath)) {
            stats[lang as keyof typeof stats].confidence += 50;
            stats[lang as keyof typeof stats].config_files.push(configFile);
          }
        });
      }
    });

    // 检查文件扩展名
    const fileExtensions = this.scanFileExtensions(workspaceRoot);

    this.config.forEach((config, lang) => {
      if (config.file_extensions) {
        config.file_extensions.forEach(ext => {
          if (fileExtensions[ext] > 0) {
            stats[lang as keyof typeof stats].confidence += 10 * fileExtensions[ext];
          }
        });
      }
    });

    // 找出最高置信度的语言
    let bestLanguage = '';
    let bestConfidence = 0;
    let bestConfigFiles: string[] = [];

    Object.entries(stats).forEach(([lang, data]) => {
      if (data.confidence > bestConfidence) {
        bestLanguage = lang;
        bestConfidence = data.confidence;
        bestConfigFiles = data.config_files;
      }
    });

    if (bestConfidence === 0) {
      return {
        language: 'javascript',
        confidence: 10,
        config_files: [],
      };
    }

    return {
      language: bestLanguage,
      confidence: bestConfidence,
      config_files: bestConfigFiles,
    };
  }

  private scanFileExtensions(workspaceRoot: string): Record<string, number> {
    const extensions: Record<string, number> = {};

    try {
      this.scanDirectory(workspaceRoot, extensions, 0, 3);
    } catch (error) {
      console.warn('Failed to scan directory:', error);
    }

    return extensions;
  }

  private scanDirectory(
    dir: string,
    extensions: Record<string, number>,
    depth: number,
    maxDepth: number
  ): void {
    if (depth > maxDepth) return;

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          if (!item.name.startsWith('.') && item.name !== 'node_modules') {
            this.scanDirectory(path.join(dir, item.name), extensions, depth + 1, maxDepth);
          }
        } else if (item.isFile()) {
          const ext = path.extname(item.name).toLowerCase();
          extensions[ext] = (extensions[ext] || 0) + 1;
        }
      }
    } catch (error) {
      // 忽略无法访问的目录
    }
  }

  getSupportedLanguages(): string[] {
    const languages: string[] = [];
    this.config.forEach((config, lang) => {
      if (config?.enabled) {
        languages.push(lang);
      }
    });
    return languages;
  }

  isLanguageSupported(language: string): boolean {
    const config = this.config.get(language);
    return config?.enabled || false;
  }

  getConfig(language: string): LanguageServerConfig | undefined {
    return this.config.get(language);
  }

  refreshConfig(): void {
    this.config.clear();
    this.projectCache.clear();
    this.loadConfig();
  }

  getLanguageStats(): Record<
    string,
    {
      enabled: boolean;
      config_files: string[];
      file_extensions: string[];
    }
  > {
    const stats: Record<string, any> = {};

    this.config.forEach((config, lang) => {
      stats[lang] = {
        enabled: config.enabled,
        config_files: config.config_files || [],
        file_extensions: config.file_extensions || [],
      };
    });

    return stats;
  }

  static getServerConfig(workspaceRoot: string): LanguageServerConfig | null {
    return LanguageServerRegistry.getInstance().getServerConfig(workspaceRoot);
  }

  static detectProjectLanguage(workspaceRoot: string): ProjectLanguage | null {
    return LanguageServerRegistry.getInstance().detectProjectLanguage(workspaceRoot);
  }
}

// 向后兼容的静态方法
export const getServerConfig = LanguageServerRegistry.getServerConfig;
export const detectProjectLanguage = LanguageServerRegistry.detectProjectLanguage;
