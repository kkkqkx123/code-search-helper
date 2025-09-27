import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * NPM/Yarn Package Management Rule - Extracts package.json and package management patterns
 */
export class NpmYarnPackageManagementRule extends AbstractSnippetRule {
  readonly name = 'NpmYarnPackageManagementRule';
  readonly supportedNodeTypes = new Set([
    'object',
    'array',
    'string',
    'number',
    'boolean',
    'pair',
    'key',
    'value',
    'comment',
    'json_document',
  ]);

  protected snippetType = 'package_management' as const;

  // npm/yarn and package.json patterns
  private readonly npmPatterns = [
    '"name":',
    '"version":',
    '"description":',
    '"main":',
    '"module":',
    '"type": "module"',
    '"scripts":',
    '"dependencies":',
    '"devDependencies":',
    '"peerDependencies":',
    '"optionalDependencies":',
    '"bundledDependencies":',
    '"engines":',
    '"os":',
    '"cpu":',
    '"private":',
    '"workspaces":',
    '"resolutions":',
    '"packageManager":',
    '"exports":',
    '"imports":',
    '"types":',
    '"typings":',
    '"bin":',
    '"man":',
    '"files":',
    '"keywords":',
    '"author":',
    '"license":',
    '"repository":',
    '"bugs":',
    '"homepage":',
    '"funding":',
    '"config":',
    '"publishConfig":',
    '"eslintConfig":',
    '"browserslist":',
    '"browserslist-config":',
    '"jest":',
    '"prettier":',
    '"husky":',
    '"lint-staged":',
    '"commitlint":',
    '"release":',
    '"volta":',
    '"nvm":',
    '"node":',
    '"npm":',
    '"yarn"',
    '"pnpm"',
    '"start":',
    '"test":',
    '"build":',
    '"dev":',
    '"serve":',
    '"lint":',
    '"format"',
    '"deploy"',
    '"install":',
    '"postinstall":',
    '"prebuild":',
    '"postbuild":',
    '"prepare":',
    '"prepublishOnly":',
  ];

  // yarn-specific patterns
  private readonly yarnPatterns = [
    '"workspaces":',
    '"resolutions":',
    '"packageManager": "yarn',
    '"yarn":',
    '".yarnrc"',
    '".yarnrc.yml"',
    '".yarn"',
    '"plugins":',
    '"packageExtensions":',
  ];

  // npm-specific patterns
  private readonly npmSpecificPatterns = [
    '"package-lock.json"',
    '"npm-shrinkwrap.json"',
    '".npmrc"',
    '"npx":',
    '"npm audit"',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isPackageManagementPattern(nodeText);
  }

  private isPackageManagementPattern(text: string): boolean {
    // Check if it's package.json content or contains package management patterns
    const isPackageJson = text.includes('"name":') && text.includes('"version":');
    const hasPackagePatterns = this.npmPatterns.some(pattern => text.includes(pattern));
    const hasYarnPatterns = this.yarnPatterns.some(pattern => text.includes(pattern));
    const hasNpmPatterns = this.npmSpecificPatterns.some(pattern => text.includes(pattern));

    return isPackageJson || hasPackagePatterns || hasYarnPatterns || hasNpmPatterns;
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    if (
      !this.validateSnippet({
        id: '',
        content,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: node.startIndex,
        endByte: node.endIndex,
        type: 'snippet',
        imports: [],
        exports: [],
        metadata: {},
        snippetMetadata: {} as SnippetMetadata,
      })
    ) {
      return null;
    }

    // Extract package management information
    const packageInfo = this.extractPackageInfo(content);
    const complexity = this.calculatePackageComplexity(content);

    const metadata: SnippetMetadata = {
      snippetType: this.snippetType,
      contextInfo,
      languageFeatures: this.analyzeLanguageFeatures(content),
      complexity,
      isStandalone: true,
      hasSideEffects: this.hasSideEffects(content),
    };

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: metadata,
    };
  }

  private extractPackageInfo(text: string): {
    name?: string;
    version?: string;
    description?: string;
    main?: string;
    type?: string;
    private?: boolean;
    packageManager?: string;
    engines?: Record<string, string>;
  } {
    const info: any = {};

    // Extract basic package info
    const nameMatch = text.match(/"name":\s*"([^"]+)"/);
    if (nameMatch) info.name = nameMatch[1];

    const versionMatch = text.match(/"version":\s*"([^"]+)"/);
    if (versionMatch) info.version = versionMatch[1];

    const descriptionMatch = text.match(/"description":\s*"([^"]+)"/);
    if (descriptionMatch) info.description = descriptionMatch[1];

    const mainMatch = text.match(/"main":\s*"([^"]+)"/);
    if (mainMatch) info.main = mainMatch[1];

    const typeMatch = text.match(/"type":\s*"([^"]+)"/);
    if (typeMatch) info.type = typeMatch[1];

    const privateMatch = text.match(/"private":\s*(true|false)/);
    if (privateMatch) info.private = privateMatch[1] === 'true';

    const packageManagerMatch = text.match(/"packageManager":\s*"([^"]+)"/);
    if (packageManagerMatch) info.packageManager = packageManagerMatch[1];

    // Extract engines
    const enginesMatch = text.match(/"engines":\s*\{([^}]+)\}/s);
    if (enginesMatch) {
      const enginesContent = enginesMatch[1];
      const engines: Record<string, string> = {};
      const nodeMatches = enginesContent.match(/"([^"]+)":\s*"([^"]+)"/g) || [];
      nodeMatches.forEach(match => {
        const [_, key, value] = match.match(/"([^"]+)":\s*"([^"]+)"/) || [];
        if (key && value) engines[key] = value;
      });
      info.engines = engines;
    }

    return info;
  }

  private determinePackageManager(text: string): string {
    if (text.includes('"packageManager": "yarn') || text.includes('yarn.lock')) {
      return 'yarn';
    }
    if (text.includes('"packageManager": "pnpm') || text.includes('pnpm-lock.yaml')) {
      return 'pnpm';
    }
    if (text.includes('package-lock.json') || text.includes('npm-shrinkwrap.json')) {
      return 'npm';
    }
    return 'unknown';
  }

  private determinePackageType(text: string): string {
    if (text.includes('"type": "module"')) {
      return 'esm';
    }
    if (text.includes('"main":') && text.includes('"module":')) {
      return 'dual';
    }
    if (text.includes('"bin":')) {
      return 'executable';
    }
    if (text.includes('"types":') || text.includes('"typings":')) {
      return 'typescript';
    }
    return 'commonjs';
  }

  private hasWorkspaces(text: string): boolean {
    return text.includes('"workspaces":') || text.includes('"private": true');
  }

  private isMonorepo(text: string): boolean {
    return text.includes('"workspaces":') && text.includes('"private": true');
  }

  private countDependencies(text: string): number {
    const depSections = [
      '"dependencies":',
      '"devDependencies":',
      '"peerDependencies":',
      '"optionalDependencies"',
    ];
    let count = 0;

    depSections.forEach(section => {
      const sectionMatch = text.match(new RegExp(section + '\\s*\\{([^}]*)\\}', 's'));
      if (sectionMatch) {
        const depCount = (sectionMatch[1].match(/"[^"]+":/g) || []).length;
        count += depCount;
      }
    });

    return count;
  }

  private countScripts(text: string): number {
    const scriptsMatch = text.match(/"scripts":\s*\{([^}]*)\}/s);
    if (!scriptsMatch) return 0;

    return (scriptsMatch[1].match(/"[^"]+":/g) || []).length;
  }

  private hasConfigFiles(text: string): boolean {
    const configFiles = [
      '"eslintConfig":',
      '"prettier":',
      '"jest":',
      '"babel":',
      '"typescript":',
      '"browserslist":',
      '"postcss":',
      '"tailwind":',
      '"webpack":',
      '"vite":',
      '"next":',
      '"react-scripts":',
      '"vue":',
      '"angular":',
    ];

    return configFiles.some(config => text.includes(config));
  }

  private extractBuildTools(text: string): string[] {
    const tools: string[] = [];

    const buildTools = [
      'webpack',
      'vite',
      'rollup',
      'parcel',
      'esbuild',
      'babel',
      'typescript',
      'tsc',
      'swc',
      'tsx',
      'next',
      'nuxt',
      'gatsby',
      'astro',
      'sveltekit',
      'react-scripts',
      'vue-cli',
      '@angular/cli',
      'ionic',
    ];

    buildTools.forEach(tool => {
      if (text.includes(tool)) {
        tools.push(tool);
      }
    });

    return tools;
  }

  private extractTestFrameworks(text: string): string[] {
    const frameworks: string[] = [];

    const testFrameworks = [
      'jest',
      'mocha',
      'chai',
      'jasmine',
      'cypress',
      'playwright',
      'puppeteer',
      'vitest',
      'uvu',
      'ava',
      'tape',
      'qunit',
      'karma',
      'protractor',
    ];

    testFrameworks.forEach(framework => {
      if (text.includes(framework)) {
        frameworks.push(framework);
      }
    });

    return frameworks;
  }

  private extractLintTools(text: string): string[] {
    const tools: string[] = [];

    const lintTools = [
      'eslint',
      'prettier',
      'standard',
      'xo',
      'semistandard',
      'stylelint',
      'htmlhint',
      'textlint',
      'commitlint',
    ];

    lintTools.forEach(tool => {
      if (text.includes(tool)) {
        tools.push(tool);
      }
    });

    return tools;
  }

  private calculatePackageComplexity(text: string): number {
    let complexity = 1;

    // Base complexity
    complexity += text.split('\n').length * 0.2;

    // Dependency complexity
    const depCount = this.countDependencies(text);
    complexity += depCount * 0.3;

    // Script complexity
    const scriptCount = this.countScripts(text);
    complexity += scriptCount * 0.4;

    // Workspace complexity
    if (this.hasWorkspaces(text)) complexity += 2;
    if (this.isMonorepo(text)) complexity += 3;

    // Configuration complexity
    if (this.hasConfigFiles(text)) complexity += 1.5;

    // Build tool complexity
    const buildTools = this.extractBuildTools(text);
    complexity += buildTools.length * 0.5;

    // Test framework complexity
    const testFrameworks = this.extractTestFrameworks(text);
    complexity += testFrameworks.length * 0.7;

    // Lint tool complexity
    const lintTools = this.extractLintTools(text);
    complexity += lintTools.length * 0.3;

    // Export configuration complexity
    if (text.includes('"exports":')) complexity += 2;
    if (text.includes('"imports":')) complexity += 1.5;

    // TypeScript complexity
    if (text.includes('"types":') || text.includes('"typescript":')) complexity += 1.5;

    return Math.min(complexity, 100);
  }

  private generatePackageTags(text: string): string[] {
    const tags: string[] = ['package-management', 'javascript', 'nodejs'];

    // Package manager tags
    const packageManager = this.determinePackageManager(text);
    if (packageManager !== 'unknown') {
      tags.push(packageManager);
    }

    // Package type tags
    const packageType = this.determinePackageType(text);
    tags.push(packageType);

    // Architecture tags
    if (this.isMonorepo(text)) tags.push('monorepo', 'workspaces');
    if (this.hasWorkspaces(text)) tags.push('workspaces');

    // Application type tags
    if (text.includes('"bin":')) tags.push('cli', 'executable');
    if (text.includes('"main":') && text.includes('"module":')) tags.push('dual-package');
    if (text.includes('"types":')) tags.push('typescript');

    // Build tool tags
    this.extractBuildTools(text).forEach(tool => tags.push(tool));

    // Test framework tags
    this.extractTestFrameworks(text).forEach(framework => tags.push(framework, 'testing'));

    // Lint tool tags
    this.extractLintTools(text).forEach(tool => tags.push(tool, 'linting'));

    // Configuration tags
    if (text.includes('"eslintConfig":')) tags.push('eslint');
    if (text.includes('"prettier":')) tags.push('prettier');
    if (text.includes('"jest":')) tags.push('jest');
    if (text.includes('"browserslist":')) tags.push('browserslist');

    // Special purpose tags
    if (text.includes('"private": true')) tags.push('private-package');
    if (text.includes('"engines":')) tags.push('engine-constraints');
    if (text.includes('"exports":')) tags.push('es-modules');
    if (text.includes('"publishConfig":')) tags.push('publish-configuration');

    return tags;
  }

  private extractDependencies(text: string): Record<string, string[]> {
    const dependencies: Record<string, string[]> = {
      dependencies: [],
      devDependencies: [],
      peerDependencies: [],
      optionalDependencies: [],
    };

    Object.keys(dependencies).forEach(section => {
      const sectionMatch = text.match(new RegExp(`"${section}":\\s*\\{([^}]*)\\}`, 's'));
      if (sectionMatch) {
        const depMatches = sectionMatch[1].match(/"([^"]+)":\s*"([^"]+)"/g) || [];
        depMatches.forEach(match => {
          const depMatch = match.match(/"([^"]+)"/);
          if (depMatch) {
            dependencies[section].push(depMatch[1]);
          }
        });
      }
    });

    return dependencies;
  }

  private extractScripts(text: string): Record<string, string> {
    const scripts: Record<string, string> = {};

    const scriptsMatch = text.match(/"scripts":\s*\{([^}]*)\}/s);
    if (scriptsMatch) {
      const scriptMatches = scriptsMatch[1].match(/"([^"]+)":\s*"([^"]*)"/g) || [];
      scriptMatches.forEach(match => {
        const scriptMatch = match.match(/"([^"]+)":\s*"([^"]*)"/);
        if (scriptMatch) {
          scripts[scriptMatch[1]] = scriptMatch[2];
        }
      });
    }

    return scripts;
  }

  private extractExports(text: string): Record<string, any> {
    const exports: Record<string, any> = {};

    const exportsMatch = text.match(/"exports":\s*\{([^}]*)\}/s);
    if (exportsMatch) {
      try {
        // Simple export extraction
        const exportMatches = exportsMatch[1].match(/"([^"]+)":\s*"([^"]*)"/g) || [];
        exportMatches.forEach(match => {
          const exportMatch = match.match(/"([^"]+)":\s*"([^"]*)"/);
          if (exportMatch) {
            exports[exportMatch[1]] = exportMatch[2];
          }
        });
      } catch (error) {
        // If complex export syntax, just note that exports exist
        exports['has-exports'] = true;
      }
    }

    return exports;
  }

  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  // Remove duplicate generateSnippetId - use base class implementation
}
