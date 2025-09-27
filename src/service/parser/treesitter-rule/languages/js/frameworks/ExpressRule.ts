import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Express.js Framework Rule - Identifies Express.js routes, middleware, and patterns
 */
export class ExpressRule extends AbstractSnippetRule {
  readonly name = 'ExpressRule';
  readonly supportedNodeTypes = new Set([
    // Route handlers
    'call_expression',
    'function_declaration',
    'arrow_function',
    'method_definition',
    'variable_declaration',

    // Middleware and app configuration
    'property_identifier',
    'assignment_expression',
    'expression_statement',
    'object',

    // Error handling
    'catch_clause',
    'try_statement',
  ]);

  protected readonly snippetType = 'express_route' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is Express.js-related code
    return this.isExpressCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const expressMetadata = this.extractExpressMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractExpressImports(node, sourceCode),
      exports: this.extractExpressExports(node, sourceCode),
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateExpressComplexity(content),
        isStandalone: this.isStandaloneExpressRoute(node, content),
        hasSideEffects: this.hasSideEffects(content),
        expressInfo: expressMetadata,
      },
    };
  }

  private isExpressCode(content: string): boolean {
    const expressPatterns = [
      // Express imports
      /import\s+express\s+from\s+['"]express['"]/,
      /const\s+express\s*=\s*require\s*\(\s*['"]express['"]\s*\)/,

      // Express app initialization
      /express\s*\(\s*\)/,
      /const\s+app\s*=\s*express\s*\(\s*\)/,

      // HTTP methods
      /app\.(get|post|put|delete|patch|all|head|options)\s*\(/,
      /router\.(get|post|put|delete|patch|all|head|options)\s*\(/,

      // Middleware
      /app\.use\s*\(/,
      /app\.listen\s*\(/,
      /app\.set\s*\(/,
      /app\.engine\s*\(/,

      // Express Router
      /express\.Router\s*\(\s*\)/,
      /const\s+router\s*=\s*express\.Router\s*\(\s*\)/,

      // Response methods
      /res\.(send|json|sendFile|render|redirect|status|end)\s*\(/,
      /req\.(params|query|body|headers|cookies|session)\s*\.?/,

      // Error handling
      /app\.use\s*\(\s*\(err,\s*req,\s*res,\s*next\)\s*=>/,
      /next\s*\(\s*err\s*\)/,

      // Common middleware patterns
      /bodyParser|json|urlencoded|static|cookieParser|cors/,
      /morgan|helmet|compression|session/,
    ];

    return expressPatterns.some(pattern => pattern.test(content));
  }

  private extractExpressMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    return {
      routeHandlers: this.extractRouteHandlers(content),
      middleware: this.extractMiddlewareInfo(content),
      routing: this.extractRoutingInfo(content),
      responseHandling: this.extractResponseHandlingInfo(content),
      errorHandling: this.extractErrorHandlingInfo(content),
      ecosystem: this.extractEcosystemInfo(content),
    };
  }

  private extractRouteHandlers(content: string) {
    const routeHandlers: any[] = [];

    const routePatterns = [
      {
        method: 'GET',
        pattern:
          /app\.get\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s+)?function\s*\([^)]*\)|\([^)]*\)\s*=>/g,
      },
      {
        method: 'POST',
        pattern:
          /app\.post\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s+)?function\s*\([^)]*\)|\([^)]*\)\s*=>/g,
      },
      {
        method: 'PUT',
        pattern:
          /app\.put\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s+)?function\s*\([^)]*\)|\([^)]*\)\s*=>/g,
      },
      {
        method: 'DELETE',
        pattern:
          /app\.delete\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s+)?function\s*\([^)]*\)|\([^)]*\)\s*=>/g,
      },
      {
        method: 'PATCH',
        pattern:
          /app\.patch\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s+)?function\s*\([^)]*\)|\([^)]*\)\s*=>/g,
      },
      {
        method: 'ALL',
        pattern:
          /app\.all\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s+)?function\s*\([^)]*\)|\([^)]*\)\s*=>/g,
      },
    ];

    routePatterns.forEach(({ method, pattern }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const path = match[1];
        const handlerContent = content.slice(match.index);

        routeHandlers.push({
          path,
          method: method as any,
          handlerType: this.determineHandlerType(handlerContent),
          middlewareUsed: this.extractHandlerMiddleware(handlerContent),
          parameters: this.extractRouteParameters(path, handlerContent),
        });
      }
    });

    return routeHandlers;
  }

  private determineHandlerType(
    handlerContent: string
  ): 'function' | 'async_function' | 'arrow_function' | 'class_method' {
    if (handlerContent.includes('async function')) return 'async_function';
    if (handlerContent.includes('function')) return 'function';
    if (handlerContent.includes('=>')) return 'arrow_function';
    return 'arrow_function'; // default
  }

  private extractHandlerMiddleware(handlerContent: string): string[] {
    const middleware: string[] = [];

    // Extract middleware arrays or chained middleware
    const middlewarePattern = /app\.\w+\s*\(\s*['"`][^'"`]+['"`]\s*,\s*\[?\s*([^,\)]+)/g;
    let match;
    while ((match = middlewarePattern.exec(handlerContent)) !== null) {
      const middlewareList = match[1].split(',').map(m => m.trim());
      middleware.push(...middlewareList);
    }

    return [...new Set(middleware)];
  }

  private extractRouteParameters(path: string, handlerContent: string) {
    const routeParams = path.match(/:([^/]+)/g) || [];
    const queryParams = handlerContent.match(/req\.query\.(\w+)/g) || [];
    const bodyParams = handlerContent.match(/req\.body\.(\w+)/g) || [];

    return {
      routeParams: routeParams.map(p => p.substring(1)), // Remove ':'
      queryParams: queryParams.map(p => p.split('.')[2]),
      bodyParams: bodyParams.map(p => p.split('.')[2]),
    };
  }

  private extractMiddlewareInfo(content: string) {
    const globalMiddleware = this.extractPatternMatches(content, [
      /app\.use\s*\(\s*([a-zA-Z][a-zA-Z0-9_]*)/g,
      /app\.use\s*\(\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    ]);

    const routeSpecificMiddleware = this.extractPatternMatches(content, [
      /app\.\w+\s*\(\s*['"`][^'"`]+['"`]\s*,\s*([a-zA-Z][a-zA-Z0-9_]*)/g,
    ]);

    const errorHandling = content.includes('(err, req, res, next)');
    const authentication = /authenticate|passport|jwt|bearer/i.test(content);
    const validation = /validate|joi|express-validator|body-parser/i.test(content);

    return {
      global: globalMiddleware,
      routeSpecific: routeSpecificMiddleware,
      errorHandling,
      authentication,
      validation,
    };
  }

  private extractRoutingInfo(content: string) {
    const usesExpressRouter = /express\.Router|const\s+router\s*=/.test(content);
    const nestedRoutes = /router\.\w+\s*\(/.test(content);

    const routeParameters = this.extractPatternMatches(content, [/:([a-zA-Z_][a-zA-Z0-9_]*)/g]);

    const staticFiles = /app\.use\s*\(\s*express\.static/.test(content);

    return {
      usesExpressRouter,
      nestedRoutes,
      routeParameters,
      staticFiles,
    };
  }

  private extractResponseHandlingInfo(content: string) {
    const jsonResponses = (content.match(/res\.json\s*\(/g) || []).length;
    const renderTemplates = (content.match(/res\.render\s*\(/g) || []).length;

    const statusCodes = this.extractPatternMatches(content, [
      /res\.status\s*\(\s*(\d{3})\s*\)/g,
    ]).map(code => parseInt(code));

    const streaming = /res\.pipe|stream|pipe\s*\(/.test(content);

    return {
      jsonResponses,
      renderTemplates,
      statusCodes,
      streaming,
    };
  }

  private extractErrorHandlingInfo(content: string) {
    const errorMiddleware = content.includes('(err, req, res, next)');
    const customErrorHandlers = (content.match(/app\.use\s*\(\s*\(err,/g) || []).length;
    const tryCatchBlocks = (content.match(/try\s*{/g) || []).length;
    const asyncErrorHandling = /catch\s*\(\s*err|\.catch\s*\(/.test(content);

    return {
      errorMiddleware,
      customErrorHandlers,
      tryCatchBlocks,
      asyncErrorHandling,
    };
  }

  private extractEcosystemInfo(content: string) {
    const bodyParser = /bodyParser|express\.json|express\.urlencoded/.test(content);
    const cookieParser = /cookie-parser|cookieParser/.test(content);
    const cors = /cors|@cors\/cors/.test(content);
    const session = /express-session|cookie-session|session/.test(content);

    let templateEngine: string | undefined;
    if (/ejs|pug|hbs|mustache|handlebars/.test(content)) {
      if (content.includes('ejs')) templateEngine = 'ejs';
      else if (content.includes('pug')) templateEngine = 'pug';
      else if (content.includes('hbs')) templateEngine = 'hbs';
      else if (content.includes('mustache')) templateEngine = 'mustache';
      else if (content.includes('handlebars')) templateEngine = 'handlebars';
    }

    return {
      bodyParser,
      cookieParser,
      cors,
      session,
      templateEngine,
    };
  }

  private extractPatternMatches(content: string, patterns: RegExp[]): string[] {
    const matches: string[] = [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          matches.push(match[1]);
        }
      }
    });

    return [...new Set(matches)];
  }

  private extractExpressImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (
          importText.includes('express') ||
          importText.includes('body-parser') ||
          importText.includes('cors') ||
          importText.includes('cookie-parser') ||
          importText.includes('morgan') ||
          importText.includes('helmet')
        ) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private extractExpressExports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const exports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'export_statement') {
        const exportText = this.getNodeText(n, sourceCode);
        if (
          exportText.includes('router') ||
          exportText.includes('app') ||
          exportText.includes('middleware')
        ) {
          exports.push(exportText);
        }
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return exports;
  }

  private isStandaloneExpressRoute(node: Parser.SyntaxNode, content: string): boolean {
    const routePatterns = [
      /app\.(get|post|put|delete|patch|all)\s*\(/,
      /router\.(get|post|put|delete|patch|all)\s*\(/,
      /app\.use\s*\(/,
      /module\.exports\s*=\s*router/,
    ];

    return (
      (node.type === 'call_expression' ||
        node.type === 'function_declaration' ||
        node.type === 'variable_declaration') &&
      routePatterns.some(pattern => pattern.test(content))
    );
  }

  private calculateExpressComplexity(content: string): number {
    let complexity = 0;

    // Base app complexity
    complexity += content.includes('express()') ? 2 : 0;
    complexity += content.includes('const app = express()') ? 3 : 0;

    // Route handler complexity
    complexity += (content.match(/app\.(get|post|put|delete|patch|all)\s*\(/g) || []).length * 3;
    complexity += (content.match(/router\.(get|post|put|delete|patch|all)\s*\(/g) || []).length * 3;

    // Middleware complexity
    complexity += (content.match(/app\.use\s*\(/g) || []).length * 2;
    complexity += (content.match(/router\.use\s*\(/g) || []).length * 2;

    // Parameter complexity
    complexity += (content.match(/:\w+/g) || []).length * 2;
    complexity += (content.match(/req\.(params|query|body)\./g) || []).length;

    // Response complexity
    complexity += (content.match(/res\.(json|send|render|redirect)\s*\(/g) || []).length * 2;
    complexity += (content.match(/res\.status\s*\(/g) || []).length;

    // Error handling complexity
    complexity += content.includes('(err, req, res, next)') ? 5 : 0;
    complexity += (content.match(/try\s*{/g) || []).length * 2;
    complexity += (content.match(/catch\s*\(/g) || []).length * 2;

    // Authentication and security
    complexity += (content.match(/authenticate|passport|jwt|bearer/gi) || []).length * 3;
    complexity += (content.match(/cors|helmet|helmet.js/g) || []).length * 2;

    // Database integration
    complexity += (content.match(/mongoose|sequelize|prisma|knex/gi) || []).length * 3;

    // Template engine complexity
    complexity += (content.match(/res\.render\s*\(/g) || []).length * 2;

    // Static file serving
    complexity += (content.match(/express\.static/g) || []).length * 2;

    // Session management
    complexity += (content.match(/express-session|cookie-session/g) || []).length * 3;

    return Math.max(1, complexity);
  }
}
