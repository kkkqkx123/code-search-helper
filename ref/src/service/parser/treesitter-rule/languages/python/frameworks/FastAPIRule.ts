import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * FastAPI Framework Rule - Extracts FastAPI route, dependency injection, and data validation patterns
 */
export class FastAPIRule extends AbstractSnippetRule {
  readonly name = 'FastAPIRule';
  readonly supportedNodeTypes = new Set([
    'import_statement',
    'function_definition',
    'decorated_definition',
    'decorator',
    'call_expression',
    'assignment',
    'class_definition',
    'type_parameter',
    'parameter',
    'return_statement',
    'expression_statement',
  ]);

  protected snippetType = 'fastapi_route' as const;

  // Override the snippetType property to ensure compatibility
  get snippetTypeValue(): 'fastapi_route' {
    return 'fastapi_route' as const;
  }

  // FastAPI-specific patterns
  private readonly fastapiPatterns = [
    'from fastapi import',
    'from pydantic import',
    '@app\\.(get|post|put|delete|patch|head|options)\\(',
    '@app\\.(websocket)\\(',
    '@app\\.(include_router)\\(',
    'FastAPI\\(',
    'APIRouter\\(',
    'HTTPException\\(',
    'Request\\(',
    'Response\\(',
    'BackgroundTasks\\(',
    'Depends\\(',
    'Cookie\\(',
    'Header\\(',
    'Path\\(',
    'Query\\(',
    'Body\\(',
    'Form\\(',
    'File\\(',
    'UploadFile\\(',
    'status_code=',
    'response_model=',
    'response_description=',
    'tags=',
    'summary=',
    'description=',
    'BaseModel\\(',
    'Field\\(',
    'validator\\(',
    'root_validator\\(',
    'Config\\.',
    'Schema\\.',
    'OAuth2PasswordBearer\\(',
    'OAuth2PasswordRequestForm\\(',
    'JWT\\.',
    'websocket\\(',
    'WebSocketDisconnect\\(',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isFastAPIPattern(nodeText);
  }

  private isFastAPIPattern(text: string): boolean {
    return this.fastapiPatterns.some(pattern => new RegExp(pattern, 'i').test(text));
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

    const fastapiInfo = this.extractFastAPIInfo(content);
    const complexity = this.calculateFastAPIComplexity(content);

    const metadata: SnippetMetadata = {
      snippetType: 'fastapi_route',
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

  private extractFastAPIInfo(text: string): {
    patterns: string[];
    features: string[];
  } {
    const patterns: string[] = [];
    const features: string[] = [];

    // Route patterns
    if (
      text.includes('@app.get(') ||
      text.includes('@app.post(') ||
      text.includes('@app.put(') ||
      text.includes('@app.delete(')
    ) {
      patterns.push('route-decorator');
      features.push('rest-api');
    }

    // WebSocket patterns
    if (text.includes('@app.websocket(')) {
      patterns.push('websocket-decorator');
      features.push('websocket');
    }

    // Router patterns
    if (text.includes('APIRouter(') || text.includes('@app.include_router(')) {
      patterns.push('router-pattern');
      features.push('modular-routing');
    }

    // Pydantic model patterns
    if (text.includes('BaseModel(') || text.includes('from pydantic import')) {
      patterns.push('pydantic-model');
      features.push('data-validation');
    }

    // Dependency injection patterns
    if (text.includes('Depends(')) {
      patterns.push('dependency-injection');
      features.push('di-container');
    }

    // Request parameter patterns
    const paramPatterns = ['Path(', 'Query(', 'Body(', 'Form(', 'File(', 'Header(', 'Cookie('];
    paramPatterns.forEach(pattern => {
      if (text.includes(pattern)) {
        patterns.push('parameter-decorator');
        features.push('parameter-handling');
      }
    });

    // Response patterns
    if (text.includes('response_model=') || text.includes('Response(')) {
      patterns.push('response-handling');
      features.push('response-typing');
    }

    // Error handling patterns
    if (text.includes('HTTPException(')) {
      patterns.push('error-handling');
      features.push('http-errors');
    }

    // Background tasks
    if (text.includes('BackgroundTasks(')) {
      patterns.push('background-tasks');
      features.push('async-tasks');
    }

    // Authentication patterns
    if (text.includes('OAuth2') || text.includes('JWT') || text.includes('security')) {
      patterns.push('authentication');
      features.push('security');
    }

    // Validation patterns
    if (text.includes('Field(') || text.includes('validator(')) {
      patterns.push('field-validation');
      features.push('validation');
    }

    // Documentation patterns
    if (text.includes('summary=') || text.includes('description=') || text.includes('tags=')) {
      patterns.push('openapi-documentation');
      features.push('api-docs');
    }

    return { patterns, features };
  }

  private calculateFastAPIComplexity(text: string): number {
    let complexity = 1;

    // Base complexity for FastAPI patterns
    complexity += text.split('\n').length * 0.5;

    // Increase complexity for route decorators
    const routeCount = (text.match(/@app\.(get|post|put|delete|patch|head|options)\(/g) || [])
      .length;
    complexity += routeCount * 2;

    // Increase complexity for parameter decorators
    const paramDecorators = ['Path(', 'Query(', 'Body(', 'Form(', 'File(', 'Header(', 'Cookie('];
    const paramCount = paramDecorators.reduce((count, decorator) => {
      return count + (text.match(new RegExp(decorator, 'g')) || []).length;
    }, 0);
    complexity += paramCount * 1.5;

    // Increase complexity for pydantic models
    const modelCount = (text.match(/BaseModel\(/g) || []).length;
    complexity += modelCount * 3;

    // Increase complexity for dependency injection
    const depsCount = (text.match(/Depends\(/g) || []).length;
    complexity += depsCount * 2;

    // Increase complexity for async operations
    const asyncCount = (text.match(/async def /g) || []).length;
    complexity += asyncCount * 1.5;

    // Increase complexity for response handling
    if (text.includes('response_model=')) complexity += 1;
    if (text.includes('HTTPException')) complexity += 2;

    // Increase complexity for background tasks
    if (text.includes('BackgroundTasks')) complexity += 2;

    // Increase complexity for authentication
    if (text.includes('OAuth2') || text.includes('JWT')) complexity += 3;

    return Math.min(complexity, 100);
  }

  private generateFastAPITags(text: string): string[] {
    const tags: string[] = ['fastapi', 'python', 'async'];

    // API tags
    if (text.includes('@app.get(')) tags.push('get-endpoint');
    if (text.includes('@app.post(')) tags.push('post-endpoint');
    if (text.includes('@app.put(')) tags.push('put-endpoint');
    if (text.includes('@app.delete(')) tags.push('delete-endpoint');
    if (text.includes('@app.websocket(')) tags.push('websocket');

    // Feature tags
    if (text.includes('BaseModel')) tags.push('pydantic', 'validation');
    if (text.includes('Depends(')) tags.push('dependency-injection');
    if (text.includes('Path(')) tags.push('path-parameters');
    if (text.includes('Query(')) tags.push('query-parameters');
    if (text.includes('Body(')) tags.push('request-body');
    if (text.includes('File(') || text.includes('UploadFile')) tags.push('file-upload');
    if (text.includes('HTTPException')) tags.push('error-handling');
    if (text.includes('BackgroundTasks')) tags.push('background-tasks');
    if (text.includes('OAuth2') || text.includes('JWT')) tags.push('authentication');

    // Architecture tags
    if (text.includes('APIRouter')) tags.push('router', 'modular');
    if (text.includes('response_model')) tags.push('typed-responses');
    if (text.includes('Field(') || text.includes('validator')) tags.push('validation');
    if (text.includes('summary=') || text.includes('description=')) tags.push('openapi');

    return tags;
  }

  private extractEndpointInfo(text: string): {
    method?: string;
    path?: string;
    responseModel?: string;
    statusCode?: string;
  } {
    const info: any = {};

    // Extract HTTP method and path
    const routeMatch = text.match(
      /@app\.(get|post|put|delete|patch|head|options)\(["']([^"']+)["']/
    );
    if (routeMatch) {
      info.method = routeMatch[1].toUpperCase();
      info.path = routeMatch[2];
    }

    // Extract response model
    const responseModelMatch = text.match(/response_model=([^,\n]+)/);
    if (responseModelMatch) {
      info.responseModel = responseModelMatch[1].trim();
    }

    // Extract status code
    const statusCodeMatch = text.match(/status_code=(\d+)/);
    if (statusCodeMatch) {
      info.statusCode = statusCodeMatch[1];
    }

    return info;
  }

  private extractDataModels(text: string): string[] {
    const models: string[] = [];

    // Extract BaseModel class names
    const baseModelMatches = text.match(/class\s+(\w+)\(BaseModel\):/g) || [];
    baseModelMatches.forEach(match => {
      const className = match.match(/class\s+(\w+)/)?.[1];
      if (className) models.push(className);
    });

    // Extract response model references
    const responseModelMatches = text.match(/response_model=(\w+)/g) || [];
    responseModelMatches.forEach(match => {
      const model = match.match(/response_model=(\w+)/)?.[1];
      if (model && !models.includes(model)) models.push(model);
    });

    return models;
  }

  private extractDependencies(text: string): string[] {
    const dependencies: string[] = [];

    // Extract Depends() arguments
    const dependsMatches = text.match(/Depends\(([^)]+)\)/g) || [];
    dependsMatches.forEach(match => {
      const dep = match.match(/Depends\(([^)]+)\)/)?.[1];
      if (dep) {
        dependencies.push(dep.trim());
      }
    });

    return dependencies;
  }

  private extractAuthentication(text: string): {
    type?: string;
    scheme?: string;
  } {
    const auth: any = {};

    if (text.includes('OAuth2PasswordBearer')) {
      auth.type = 'oauth2';
      auth.scheme = 'bearer';
    } else if (text.includes('JWT')) {
      auth.type = 'jwt';
    } else if (text.includes('security') || text.includes('Security')) {
      auth.type = 'custom';
    }

    return auth;
  }
}
