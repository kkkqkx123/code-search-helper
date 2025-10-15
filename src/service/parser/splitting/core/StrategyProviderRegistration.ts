import { strategyFactory } from './SplitStrategyFactory';
import { FunctionSplitterProvider } from '../providers/FunctionSplitterProvider';
import { ClassSplitterProvider } from '../providers/ClassSplitterProvider';
import { ImportSplitterProvider } from '../providers/ImportSplitterProvider';
import { SyntaxAwareSplitterProvider } from '../providers/SyntaxAwareSplitterProvider';
import { IntelligentSplitterProvider } from '../providers/IntelligentSplitterProvider';

/**
 * 注册默认的策略提供者
 * 这个函数应该在应用初始化时调用
 */
export function registerDefaultStrategyProviders(logger?: any): void {
  try {
    // 注册函数分割策略提供者
    strategyFactory.registerProvider(new FunctionSplitterProvider());
    logger?.info('FunctionSplitterProvider registered');
    
    // 注册类分割策略提供者
    strategyFactory.registerProvider(new ClassSplitterProvider());
    logger?.info('ClassSplitterProvider registered');
    
    // 注册导入分割策略提供者
    strategyFactory.registerProvider(new ImportSplitterProvider());
    logger?.info('ImportSplitterProvider registered');
    
    // 注册语法感知分割策略提供者
    strategyFactory.registerProvider(new SyntaxAwareSplitterProvider());
    logger?.info('SyntaxAwareSplitterProvider registered');
    
    // 注册智能分割策略提供者
    strategyFactory.registerProvider(new IntelligentSplitterProvider());
    logger?.info('IntelligentSplitterProvider registered');
    
    // 验证注册结果
    const registeredStrategies = strategyFactory.getAvailableStrategies();
    logger?.info(`Successfully registered ${registeredStrategies.length} strategy providers: ${registeredStrategies.join(', ')}`);
    
    // 输出工厂统计信息
    const stats = strategyFactory.getFactoryStats();
    logger?.info('Strategy factory stats:', stats);
    
  } catch (error) {
    logger?.error('Failed to register default strategy providers:', error);
    throw new Error(`Strategy provider registration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取策略工厂的调试信息
 */
export function getStrategyFactoryDebugInfo(): {
  availableStrategies: string[];
  strategyDetails: Map<string, any>;
  factoryStats: any;
} {
  const availableStrategies = strategyFactory.getAvailableStrategies();
  const strategyDetails = strategyFactory.getAllStrategiesInfo();
  const factoryStats = strategyFactory.getFactoryStats();
  
  return {
    availableStrategies,
    strategyDetails,
    factoryStats
  };
}

/**
 * 清理策略工厂状态
 * 主要用于测试和重置
 */
export function cleanupStrategyFactory(): void {
  strategyFactory.clear();
}

/**
 * 验证策略提供者是否正确注册
 */
export function validateStrategyProviderRegistration(expectedStrategies: string[] = [
  'FunctionSplitter',
  'ClassSplitter', 
  'ImportSplitter',
  'SyntaxAwareSplitter',
  'IntelligentSplitter'
]): {
  success: boolean;
  missingStrategies: string[];
  registeredStrategies: string[];
} {
  const availableStrategies = strategyFactory.getAvailableStrategies();
  const missingStrategies = expectedStrategies.filter(strategy => 
    !availableStrategies.includes(strategy)
  );
  
  return {
    success: missingStrategies.length === 0,
    missingStrategies,
    registeredStrategies: availableStrategies
  };
}

/**
 * 自动注册策略提供者的辅助函数
 * 如果策略未注册，则自动注册默认策略提供者
 */
export function ensureStrategyProvidersRegistered(logger?: any): void {
  const validation = validateStrategyProviderRegistration();
  
  if (!validation.success) {
    logger?.warn(`Missing strategy providers detected: ${validation.missingStrategies.join(', ')}`);
    logger?.info('Auto-registering default strategy providers...');
    
    try {
      registerDefaultStrategyProviders(logger);
      logger?.info('Auto-registration completed successfully');
    } catch (error) {
      logger?.error('Auto-registration failed:', error);
      throw error;
    }
  } else {
    logger?.debug('All required strategy providers are already registered');
  }
}