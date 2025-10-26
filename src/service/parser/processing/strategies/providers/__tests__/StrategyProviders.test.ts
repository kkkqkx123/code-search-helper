import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from '../../../../../../types';
import { diContainer } from '../../../../../../core/DIContainer';
import { ImportStrategyProvider } from '../ImportStrategyProvider';
import { SyntaxAwareStrategyProvider } from '../SyntaxAwareStrategyProvider';
import { IntelligentStrategyProvider } from '../IntelligentStrategyProvider';
import { StructureAwareStrategyProvider } from '../StructureAwareStrategyProvider';
import { SemanticStrategyProvider } from '../SemanticStrategyProvider';
import { TreeSitterService } from '../../../../../../service/parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../../../../utils/LoggerService';

describe('Strategy Providers Test', () => {
  let container: Container;

  beforeEach(() => {
    container = diContainer;
  });

  test('should register ImportStrategyProvider in container', () => {
    const provider = container.get<ImportStrategyProvider>(TYPES.ImportStrategyProvider);
    expect(provider).toBeDefined();
    expect(provider.getName()).toBe('import_provider');
    expect(provider.getPriority()).toBe(3);
 });

  test('should register SyntaxAwareStrategyProvider in container', () => {
    const provider = container.get<SyntaxAwareStrategyProvider>(TYPES.SyntaxAwareStrategyProvider);
    expect(provider).toBeDefined();
    expect(provider.getName()).toBe('syntax_aware_provider');
    expect(provider.getPriority()).toBe(1);
  });

  test('should register IntelligentStrategyProvider in container', () => {
    const provider = container.get<IntelligentStrategyProvider>(TYPES.IntelligentStrategyProvider);
    expect(provider).toBeDefined();
    expect(provider.getName()).toBe('intelligent_provider');
    expect(provider.getPriority()).toBe(4);
 });

  test('should register StructureAwareStrategyProvider in container', () => {
    const provider = container.get<StructureAwareStrategyProvider>(TYPES.StructureAwareStrategyProvider);
    expect(provider).toBeDefined();
    expect(provider.getName()).toBe('structure_aware_provider');
    expect(provider.getPriority()).toBe(1);
  });

  test('should register SemanticStrategyProvider in container', () => {
    const provider = container.get<SemanticStrategyProvider>(TYPES.SemanticStrategyProvider);
    expect(provider).toBeDefined();
    expect(provider.getName()).toBe('semantic_provider');
    expect(provider.getPriority()).toBe(5);
  });

  test('should create strategies with proper dependencies', () => {
    const importProvider = container.get<ImportStrategyProvider>(TYPES.ImportStrategyProvider);
    const syntaxProvider = container.get<SyntaxAwareStrategyProvider>(TYPES.SyntaxAwareStrategyProvider);
    const intelligentProvider = container.get<IntelligentStrategyProvider>(TYPES.IntelligentStrategyProvider);
    const structureProvider = container.get<StructureAwareStrategyProvider>(TYPES.StructureAwareStrategyProvider);
    const semanticProvider = container.get<SemanticStrategyProvider>(TYPES.SemanticStrategyProvider);

    // 检查是否能成功创建策略实例
    const importStrategy = importProvider.createStrategy();
    const syntaxStrategy = syntaxProvider.createStrategy();
    const intelligentStrategy = intelligentProvider.createStrategy();
    const structureStrategy = structureProvider.createStrategy();
    const semanticStrategy = semanticProvider.createStrategy();

    expect(importStrategy).toBeDefined();
    expect(syntaxStrategy).toBeDefined();
    expect(intelligentStrategy).toBeDefined();
    expect(structureStrategy).toBeDefined();
    expect(semanticStrategy).toBeDefined();
  });
});