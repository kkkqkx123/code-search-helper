import {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship,
  DataFlowRelationship,
  ControlFlowRelationship,
  SemanticRelationship,
  LifecycleRelationship,
  ConcurrencyRelationship,
  injectable
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';
import { CallExtractor } from './CallExtractor';
import { InheritanceExtractor } from './InheritanceExtractor';
import { DependencyExtractor } from './DependencyExtractor';
import { ReferenceExtractor } from './ReferenceExtractor';
import { CreationExtractor } from './CreationExtractor';
import { AnnotationExtractor } from './AnnotationExtractor';
import { DataFlowExtractor } from './DataFlowExtractor';
import { ControlFlowExtractor } from './ControlFlowExtractor';
import { SemanticExtractor } from './SemanticExtractor';
import { LifecycleExtractor } from './LifecycleExtractor';
import { ConcurrencyExtractor } from './ConcurrencyExtractor';
import Parser = require('tree-sitter');

/**
 * JavaScript语言关系提取器主类
 * 整合所有特定类型的提取器，提供统一的接口
 */
@injectable()
export class JavaScriptRelationshipExtractor extends BaseJavaScriptRelationshipExtractor implements ILanguageRelationshipExtractor {
  // 各种提取器实例
  private callExtractor: CallExtractor;
  private inheritanceExtractor: InheritanceExtractor;
  private dependencyExtractor: DependencyExtractor;
  private referenceExtractor: ReferenceExtractor;
  private creationExtractor: CreationExtractor;
  private annotationExtractor: AnnotationExtractor;
  private dataFlowExtractor: DataFlowExtractor;
  private controlFlowExtractor: ControlFlowExtractor;
  private semanticExtractor: SemanticExtractor;
  private lifecycleExtractor: LifecycleExtractor;
  private concurrencyExtractor: ConcurrencyExtractor;

  constructor() {
    super();
    this.callExtractor = new CallExtractor();
    this.inheritanceExtractor = new InheritanceExtractor();
    this.dependencyExtractor = new DependencyExtractor();
    this.referenceExtractor = new ReferenceExtractor();
    this.creationExtractor = new CreationExtractor();
    this.annotationExtractor = new AnnotationExtractor();
    this.dataFlowExtractor = new DataFlowExtractor();
    this.controlFlowExtractor = new ControlFlowExtractor();
    this.semanticExtractor = new SemanticExtractor();
    this.lifecycleExtractor = new LifecycleExtractor();
    this.concurrencyExtractor = new ConcurrencyExtractor();
  }

  getSupportedLanguage(): string {
    return 'javascript';
  }

  getSupportedRelationshipTypes(): string[] {
    return [
      'call', 'inheritance', 'dependency',
      'reference', 'creation', 'annotation',
      'data_flow', 'control_flow', 'semantic',
      'lifecycle', 'concurrency'
    ];
  }

  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CallRelationship[]> {
    return this.callExtractor.extractCallRelationships(ast, filePath);
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<InheritanceRelationship[]> {
    return this.inheritanceExtractor.extractInheritanceRelationships(ast, filePath);
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DependencyRelationship[]> {
    return this.dependencyExtractor.extractDependencyRelationships(ast, filePath);
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ReferenceRelationship[]> {
    return this.referenceExtractor.extractReferenceRelationships(ast, filePath);
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CreationRelationship[]> {
    return this.creationExtractor.extractCreationRelationships(ast, filePath);
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<AnnotationRelationship[]> {
    return this.annotationExtractor.extractAnnotationRelationships(ast, filePath);
  }

  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    return this.dataFlowExtractor.extractDataFlowRelationships(ast, filePath);
  }

  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ControlFlowRelationship[]> {
    return this.controlFlowExtractor.extractControlFlowRelationships(ast, filePath);
  }

  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<SemanticRelationship[]> {
    return this.semanticExtractor.extractSemanticRelationships(ast, filePath);
  }

  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<LifecycleRelationship[]> {
    return this.lifecycleExtractor.extractLifecycleRelationships(ast, filePath);
  }

  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ConcurrencyRelationship[]> {
    return this.concurrencyExtractor.extractConcurrencyRelationships(ast, filePath);
  }
}