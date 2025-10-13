import { strategyFactory } from './SplitStrategyFactory';
import { FunctionSplitter } from '../strategies/FunctionSplitter';
import { ClassSplitter } from '../strategies/ClassSplitter';
import { ImportSplitter } from '../strategies/ImportSplitter';
import { SyntaxAwareSplitter } from '../strategies/SyntaxAwareSplitter';
import { IntelligentSplitter } from '../strategies/IntelligentSplitter';

/**
 * 注册默认的分割策略
 * 这个函数应该在应用初始化时调用
 */
export function registerDefaultStrategies(logger?: any): void {
  try {
    // 注册函数分割策略
    strategyFactory.registerStrategy('FunctionSplitter', FunctionSplitter);
    logger?.info('FunctionSplitter strategy registered');
    
    // 注册类分割策略
    strategyFactory.registerStrategy('ClassSplitter', ClassSplitter);
    logger?.info('ClassSplitter strategy registered');
    
    // 注册导入分割策略
    strategyFactory.registerStrategy('ImportSplitter', ImportSplitter);
    logger?.info('ImportSplitter strategy registered');
    
    // 注册语法感知分割策略
    strategyFactory.registerStrategy('SyntaxAwareSplitter', SyntaxAwareSplitter);
    logger?.info('SyntaxAwareSplitter strategy registered');
    
    // 注册智能分割策略
    strategyFactory.registerStrategy('IntelligentSplitter', IntelligentSplitter);
    logger?.info('IntelligentSplitter strategy registered');
    
    // 验证注册结果
    const registeredStrategies = strategyFactory.getAvailableStrategies();
    logger?.info(`Successfully registered ${registeredStrategies.length} strategies: ${registeredStrategies.join(', ')}`);
    
    // 输出工厂统计信息
    const stats = strategyFactory.getFactoryStats();
    logger?.info('Strategy factory stats:', stats);
    
  } catch (error) {
    logger?.error('Failed to register default strategies:', error);
    throw new Error(`Strategy registration failed: ${error instanceof Error ? error.message : String(error)}`);
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
 * 验证策略是否正确注册
 */
export function validateStrategyRegistration(expectedStrategies: string[] = [
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
 * 自动注册策略的辅助函数
 * 如果策略未注册，则自动注册默认策略
 */
export function ensureStrategiesRegistered(logger?: any): void {
  const validation = validateStrategyRegistration();
  
  if (!validation.success) {
    logger?.warn(`Missing strategies detected: ${validation.missingStrategies.join(', ')}`);
    logger?.info('Auto-registering default strategies...');
    
    try {
      registerDefaultStrategies(logger);
      logger?.info('Auto-registration completed successfully');
    } catch (error) {
      logger?.error('Auto-registration failed:', error);
      throw error;
    }
  } else {
    logger?.debug('All required strategies are already registered');
  }
}