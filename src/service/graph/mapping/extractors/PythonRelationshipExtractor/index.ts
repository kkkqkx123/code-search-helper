import {
  Parser,
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
  ConcurrencyRelationship
} from '../types';
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

export class PythonRelationshipExtractor implements ILanguageRelationshipExtractor {
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

  constructor(
    callExtractor: CallExtractor,
    inheritanceExtractor: InheritanceExtractor,
    dependencyExtractor: DependencyExtractor,
    referenceExtractor: ReferenceExtractor,
    creationExtractor: CreationExtractor,
    annotationExtractor: AnnotationExtractor,
    dataFlowExtractor: DataFlowExtractor,
    controlFlowExtractor: ControlFlowExtractor,
    semanticExtractor: SemanticExtractor,
    lifecycleExtractor: LifecycleExtractor,
    concurrencyExtractor: ConcurrencyExtractor
  ) {
    this.callExtractor = callExtractor;
    this.inheritanceExtractor = inheritanceExtractor;
    this.dependencyExtractor = dependencyExtractor;
    this.referenceExtractor = referenceExtractor;
    this.creationExtractor = creationExtractor;
    this.annotationExtractor = annotationExtractor;
    this.dataFlowExtractor = dataFlowExtractor;
    this.controlFlowExtractor = controlFlowExtractor;
    this.semanticExtractor = semanticExtractor;
    this.lifecycleExtractor = lifecycleExtractor;
    this.concurrencyExtractor = concurrencyExtractor;
  }

  getSupportedLanguage(): string {
    return 'python';
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
    return this.callExtractor.extract(ast, filePath);
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<InheritanceRelationship[]> {
    return this.inheritanceExtractor.extract(ast, filePath);
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DependencyRelationship[]> {
    return this.dependencyExtractor.extract(ast, filePath);
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ReferenceRelationship[]> {
    return this.referenceExtractor.extract(ast, filePath);
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CreationRelationship[]> {
    return this.creationExtractor.extract(ast, filePath);
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<AnnotationRelationship[]> {
    return this.annotationExtractor.extract(ast, filePath);
  }

  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    return this.dataFlowExtractor.extract(ast, filePath);
  }

  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ControlFlowRelationship[]> {
    return this.controlFlowExtractor.extract(ast, filePath);
  }

  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<SemanticRelationship[]> {
    return this.semanticExtractor.extract(ast, filePath);
  }

  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<LifecycleRelationship[]> {
    return this.lifecycleExtractor.extract(ast, filePath);
  }

  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ConcurrencyRelationship[]> {
    return this.concurrencyExtractor.extract(ast, filePath);
  }
}