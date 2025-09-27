import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../types';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';

/**
 * Go Frameworks Rule - Extracts Gin and Echo web framework patterns
 */
export class GoFrameworkRule extends AbstractSnippetRule {
  readonly name = 'GoFrameworkRule';
  readonly supportedNodeTypes = new Set([
    'import_declaration',
    'function_declaration',
    'method_declaration',
    'call_expression',
    'selector_expression',
    'return_statement',
    'assignment',
    'composite_literal',
    'slice_literal',
    'type_declaration',
    'struct_type',
    'interface_type',
    'field_declaration',
    'short_var_declaration',
  ]);

  protected snippetType = 'go_web_framework' as const;

  // Go framework patterns
  private readonly ginPatterns = [
    'gin\\.Engine',
    'gin\\.Default\\(',
    'gin\\.New\\(',
    'router\\.Group\\(',
    'GET\\(',
    'POST\\(',
    'PUT\\(',
    'DELETE\\(',
    'PATCH\\(',
    'OPTIONS\\(',
    'HEAD\\(',
    'Use\\(',
    'LoadHTMLGlob\\(',
    'LoadHTMLFiles\\(',
    'Static\\(',
    'StaticFS\\(',
    'Run\\(',
    'RunTLS\\(',
    'RunUnix\\(',
    'c\\.JSON\\(',
    'c\\.XML\\(',
    'c\\.HTML\\(',
    'c\\.String\\(',
    'c\\.Data\\(',
    'c\\.File\\(',
    'c\\.IndentedJSON\\(',
    'c\\.SecureJSON\\(',
    'c\\.PureJSON\\(',
    'c\\.AbortWithStatus\\(',
    'c\\.AbortWithStatusJSON\\(',
    'gin\\.Context',
    'gin\\.HandlerFunc',
    'gin\\.H',
    'gin\\.Mode\\(',
    'gin\\.SetMode\\(',
    'gin\\.IsDebugging\\(',
    'gin\\.DefaultWriter',
    'gin\\.DefaultErrorWriter',
  ];

  private readonly echoPatterns = [
    'echo\\.Echo',
    'echo\\.New\\(',
    'e\\.Get\\(',
    'e\\.Post\\(',
    'e\\.Put\\(',
    'e\\.Delete\\(',
    'e\\.Patch\\(',
    'e\\.Options\\(',
    'e\\.Head\\(',
    'e\\.Connect\\(',
    'e\\.Trace\\(',
    'e\\.Any\\(',
    'e\\.Match\\(',
    'e\\.Group\\(',
    'e\\.Static\\(',
    'e\\.File\\(',
    'e\\.Pre\\(',
    'e\\.Use\\(',
    'e\\.Logger',
    'e\\.Pre',
    'e\\.IP',
    'e\\.Start\\(',
    'e\\.StartTLS\\(',
    'e\\.StartAutoTLS\\(',
    'e\\.StartH2CServer\\(',
    'c\\.JSON\\(',
    'c\\.JSONPretty\\(',
    'c\\.JSONP\\(',
    'c\\.JSONBlob\\(',
    'c\\.XML\\(',
    'c\\.XMLBlob\\(',
    'c\\.String\\(',
    'c\\.HTML\\(',
    'c\\.Blob\\(',
    'c\\.Stream\\(',
    'c\\.File\\(',
    'c\\.Attachment\\(',
    'c\\.Inline\\(',
    'c\\.NoContent\\(',
    'c\\.Redirect\\(',
    'c\\.Error\\(',
    'echo\\.Context',
    'echo\\.HandlerFunc',
    'echo\\.MiddlewareFunc',
    'echo\\.Map',
    'echo\\.HTTPError',
  ];

  private readonly commonPatterns = [
    'mux\\.Router',
    'chi\\.Router',
    'fiber\\.App',
    'gorilla\\.mux\\.Router',
    'negroni\\.Negroni',
    'httprouter\\.Router',
    'logrus\\.',
    'zap\\.',
    'gorm\\.',
    'sqlx\\.',
    'pgx\\.',
    'redis\\.',
    'json\\.',
    'yaml\\.',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isGoFrameworkPattern(nodeText);
  }

  private isGoFrameworkPattern(text: string): boolean {
    const allPatterns = [...this.ginPatterns, ...this.echoPatterns, ...this.commonPatterns];
    return allPatterns.some(pattern => new RegExp(pattern, 'i').test(text));
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const nodeText = this.getNodeText(node, sourceCode);

    // Extract framework-specific information
    const frameworkInfo = this.extractFrameworkInfo(nodeText);

    // Calculate complexity based on framework patterns
    const complexity = this.calculateGoFrameworkComplexity(nodeText);

    // Create enhanced metadata for Go framework code
    const goFrameworkInfo = {
      complexity,
      tags: this.generateGoFrameworkTags(nodeText),
      framework: {
        name: frameworkInfo.framework,
        version: 'latest',
        patterns: frameworkInfo.patterns,
        features: frameworkInfo.features,
      },
      httpMethods: this.extractHttpMethods(nodeText),
      middleware: this.extractMiddleware(nodeText),
      database: this.extractDatabaseConnections(nodeText),
    };

    return {
      id: this.generateSnippetId(nodeText, node.startPosition.row + 1),
      content: nodeText,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo: {
          nestingLevel: nestingLevel,
        },
        languageFeatures: this.analyzeLanguageFeatures(nodeText),
        complexity: complexity,
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(nodeText),
        goFrameworkInfo: goFrameworkInfo,
      },
    };
  }

  private extractFrameworkInfo(text: string): {
    framework: string;
    patterns: string[];
    features: string[];
  } {
    const patterns: string[] = [];
    const features: string[] = [];
    let framework = 'unknown';

    // Detect framework
    if (this.ginPatterns.some(pattern => new RegExp(pattern, 'i').test(text))) {
      framework = 'gin';
      patterns.push('gin-framework');
      features.push('web-framework');
    } else if (this.echoPatterns.some(pattern => new RegExp(pattern, 'i').test(text))) {
      framework = 'echo';
      patterns.push('echo-framework');
      features.push('web-framework');
    } else if (this.commonPatterns.some(pattern => new RegExp(pattern, 'i').test(text))) {
      if (text.includes('mux.') || text.includes('gorilla.mux')) {
        framework = 'gorilla-mux';
        patterns.push('gorilla-mux');
      } else if (text.includes('chi.')) {
        framework = 'chi';
        patterns.push('chi-router');
      } else if (text.includes('fiber.')) {
        framework = 'fiber';
        patterns.push('fiber-framework');
      } else if (text.includes('negroni.')) {
        framework = 'negroni';
        patterns.push('negroni-middleware');
      } else if (text.includes('httprouter.')) {
        framework = 'httprouter';
        patterns.push('httprouter');
      }
      features.push('web-framework');
    }

    // Route patterns
    if (
      text.includes('GET(') ||
      text.includes('POST(') ||
      text.includes('PUT(') ||
      text.includes('DELETE(')
    ) {
      patterns.push('route-handlers');
      features.push('rest-api');
    }

    // Middleware patterns
    if (text.includes('Use(') || text.includes('Middleware')) {
      patterns.push('middleware-patterns');
      features.push('middleware');
    }

    // Static file serving
    if (text.includes('Static(') || text.includes('File(')) {
      patterns.push('static-files');
      features.push('file-serving');
    }

    // Response patterns
    if (text.includes('c.JSON(') || text.includes('c.XML(') || text.includes('c.String(')) {
      patterns.push('response-handlers');
      features.push('response-formatting');
    }

    // Server configuration
    if (text.includes('Run(') || text.includes('Start(') || text.includes('ListenAndServe')) {
      patterns.push('server-configuration');
      features.push('server-setup');
    }

    // Group patterns
    if (text.includes('Group(')) {
      patterns.push('route-groups');
      features.push('route-organization');
    }

    // Error handling
    if (text.includes('AbortWithStatus') || text.includes('Error(') || text.includes('HTTPError')) {
      patterns.push('error-handling');
      features.push('error-management');
    }

    return { framework, patterns, features };
  }

  private calculateGoFrameworkComplexity(text: string): number {
    let complexity = 1;

    // Base complexity for framework patterns
    complexity += text.split('\n').length * 0.5;

    // Increase complexity for route handlers
    const routeCount = (text.match(/(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\(/g) || []).length;
    complexity += routeCount * 2;

    // Increase complexity for middleware
    const middlewareCount = (text.match(/Use\(/g) || []).length;
    complexity += middlewareCount * 1.5;

    // Increase complexity for response handlers
    const responseCount = (text.match(/c\.(JSON|XML|String|HTML|File)\(/g) || []).length;
    complexity += responseCount;

    // Increase complexity for group routes
    const groupCount = (text.match(/Group\(/g) || []).length;
    complexity += groupCount * 1.5;

    // Increase complexity for static file serving
    if (text.includes('Static(') || text.includes('File(')) complexity += 1;

    // Increase complexity for server configuration
    if (text.includes('Run(') || text.includes('Start(')) complexity += 1;

    // Increase complexity for error handling
    if (text.includes('AbortWithStatus') || text.includes('Error(')) complexity += 1.5;

    // Increase complexity for database operations
    if (text.includes('gorm.') || text.includes('sqlx.') || text.includes('pgx.')) complexity += 2;

    // Increase complexity for logging
    if (text.includes('logrus.') || text.includes('zap.')) complexity += 1;

    return Math.min(complexity, 100);
  }

  private generateGoFrameworkTags(text: string): string[] {
    const tags: string[] = ['go', 'web-framework'];

    // Framework-specific tags
    if (this.ginPatterns.some(pattern => new RegExp(pattern, 'i').test(text))) {
      tags.push('gin');
    } else if (this.echoPatterns.some(pattern => new RegExp(pattern, 'i').test(text))) {
      tags.push('echo');
    } else if (text.includes('mux.') || text.includes('gorilla.mux')) {
      tags.push('gorilla-mux');
    } else if (text.includes('chi.')) {
      tags.push('chi');
    } else if (text.includes('fiber.')) {
      tags.push('fiber');
    } else if (text.includes('negroni.')) {
      tags.push('negroni');
    } else if (text.includes('httprouter.')) {
      tags.push('httprouter');
    }

    // HTTP method tags
    if (text.includes('GET(')) tags.push('get');
    if (text.includes('POST(')) tags.push('post');
    if (text.includes('PUT(')) tags.push('put');
    if (text.includes('DELETE(')) tags.push('delete');
    if (text.includes('PATCH(')) tags.push('patch');
    if (text.includes('OPTIONS(')) tags.push('options');
    if (text.includes('HEAD(')) tags.push('head');

    // Feature tags
    if (text.includes('Use(')) tags.push('middleware');
    if (text.includes('Static(')) tags.push('static-files');
    if (text.includes('Group(')) tags.push('route-groups');
    if (text.includes('c.JSON(')) tags.push('json-responses');
    if (text.includes('c.HTML(')) tags.push('html-templates');
    if (text.includes('c.XML(')) tags.push('xml-responses');
    if (text.includes('Run(') || text.includes('Start(')) tags.push('server');
    if (text.includes('AbortWithStatus') || text.includes('Error(')) tags.push('error-handling');

    // Database tags
    if (text.includes('gorm.')) tags.push('gorm', 'orm');
    if (text.includes('sqlx.')) tags.push('sqlx', 'database');
    if (text.includes('pgx.')) tags.push('pgx', 'postgresql');
    if (text.includes('redis.')) tags.push('redis', 'cache');

    // Logging tags
    if (text.includes('logrus.')) tags.push('logrus', 'logging');
    if (text.includes('zap.')) tags.push('zap', 'logging');

    return tags;
  }

  private extractHttpMethods(text: string): string[] {
    const methods: string[] = [];

    const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    httpMethods.forEach(method => {
      if (text.includes(`${method}(`)) {
        methods.push(method);
      }
    });

    return methods;
  }

  private extractMiddleware(text: string): string[] {
    const middleware: string[] = [];

    // Common middleware patterns
    const middlewarePatterns = [
      'Logger',
      'Recovery',
      'CORS',
      'Auth',
      'JWT',
      'Session',
      'Gzip',
      'Static',
      'Compress',
      'Secure',
      'RequestID',
      'Timeout',
      'RateLimit',
    ];

    middlewarePatterns.forEach(pattern => {
      if (text.includes(pattern)) {
        middleware.push(pattern.toLowerCase());
      }
    });

    return middleware;
  }

  private extractDatabaseConnections(text: string): string[] {
    const databases: string[] = [];

    // Database libraries
    if (text.includes('gorm.')) databases.push('gorm');
    if (text.includes('sqlx.')) databases.push('sqlx');
    if (text.includes('pgx.')) databases.push('pgx');
    if (text.includes('redis.')) databases.push('redis');
    if (text.includes('mongo.')) databases.push('mongodb');
    if (text.includes('mysql.')) databases.push('mysql');
    if (text.includes('postgres.')) databases.push('postgres');

    return databases;
  }

  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }
}
