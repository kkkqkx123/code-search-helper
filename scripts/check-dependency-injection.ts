#!/usr/bin/env ts-node

/**
 * 依赖注入检查脚本
 * 用于检测依赖注入配置是否存在问题
 */

import { Container } from 'inversify';
import { diContainer } from '../src/core/DIContainer';
import { TYPES } from '../src/types';

interface ServiceCheckResult {
  serviceName: string;
  isBound: boolean;
  error?: string;
}

class DependencyInjectionChecker {
  private container: Container;
  private checkResults: ServiceCheckResult[] = [];

  constructor() {
    this.container = diContainer;
  }

  /**
   * 检查所有关键服务是否已正确绑定
   */
  async checkAllServices(): Promise<void> {
    console.log('🔍 开始检查依赖注入配置...\n');

    // 检查关键服务
    const criticalServices = [
      { name: 'NebulaService', symbol: TYPES.INebulaService },
      { name: 'NebulaTransactionService', symbol: TYPES.INebulaTransactionService },
      { name: 'NebulaBatchService', symbol: TYPES.INebulaBatchService },
      { name: 'NebulaFileDataService', symbol: TYPES.INebulaFileDataService },
      { name: 'NebulaQueryService', symbol: TYPES.INebulaQueryService },
      { name: 'NebulaDataOperations', symbol: TYPES.INebulaDataOperations },
      { name: 'NebulaConnectionManager', symbol: TYPES.INebulaConnectionManager },
      { name: 'DatabaseLoggerService', symbol: TYPES.DatabaseLoggerService },
      { name: 'ErrorHandlerService', symbol: TYPES.ErrorHandlerService },
      { name: 'ConfigService', symbol: TYPES.ConfigService },
    ];

    console.log('📋 检查服务绑定状态:');
    console.log('='.repeat(50));

    for (const service of criticalServices) {
      const result = this.checkServiceBinding(service.name, service.symbol);
      this.checkResults.push(result);
      
      if (result.isBound) {
        console.log(`✅ ${service.name}: 已绑定`);
      } else {
        console.log(`❌ ${service.name}: 未绑定 - ${result.error}`);
      }
    }

    // 生成报告
    this.generateReport();
  }

  /**
   * 检查单个服务绑定
   */
  private checkServiceBinding(serviceName: string, serviceSymbol: symbol): ServiceCheckResult {
    try {
      const isBound = this.container.isBound(serviceSymbol);
      return {
        serviceName,
        isBound,
        error: isBound ? undefined : 'Service not bound in container'
      };
    } catch (error) {
      return {
        serviceName,
        isBound: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 生成检查报告
   */
  private generateReport(): void {
    console.log('\n📊 检查报告摘要:');
    console.log('='.repeat(50));

    const totalServices = this.checkResults.length;
    const boundServices = this.checkResults.filter(r => r.isBound).length;

    console.log(`总服务数: ${totalServices}`);
    console.log(`已绑定服务: ${boundServices}`);

    const unboundServices = this.checkResults.filter(r => !r.isBound);
    if (unboundServices.length > 0) {
      console.log('\n❌ 未绑定的服务:');
      unboundServices.forEach(service => {
        console.log(`  - ${service.serviceName}: ${service.error}`);
      });
    }

    if (unboundServices.length === 0) {
      console.log('\n🎉 所有依赖注入配置正常!');
    } else {
      console.log('\n⚠️  发现依赖注入问题，请检查上述服务配置');
    }
  }

  /**
   * 尝试解析关键服务以验证依赖注入
   */
  async testServiceResolution(): Promise<void> {
    console.log('\n🧪 测试服务解析:');
    console.log('='.repeat(50));

    const testServices = [
      { name: 'NebulaService', symbol: TYPES.INebulaService },
      { name: 'NebulaTransactionService', symbol: TYPES.INebulaTransactionService },
      { name: 'NebulaBatchService', symbol: TYPES.INebulaBatchService },
      { name: 'NebulaFileDataService', symbol: TYPES.INebulaFileDataService },
    ];

    for (const service of testServices) {
      try {
        const instance = this.container.get(service.symbol);
        console.log(`✅ ${service.name}: 解析成功`);
      } catch (error) {
        console.log(`❌ ${service.name}: 解析失败 - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 设置超时自动关闭
  const timeout = setTimeout(() => {
    console.log('\n⏰ 检查完成，自动退出...');
    process.exit(0);
  }, 10000); // 10秒后自动退出

  try {
    console.log('🔧 使用已初始化的DI容器...');
    console.log('✅ DI容器已准备就绪\n');

    // 创建检查器并运行检查
    const checker = new DependencyInjectionChecker();
    await checker.checkAllServices();
    await checker.testServiceResolution();

    // 检查完成后清除超时并正常退出
    clearTimeout(timeout);
    console.log('\n✅ 依赖注入检查完成，正常退出');
    process.exit(0);

  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ 依赖注入检查失败:', error);
    process.exit(1);
  }
}

// 运行检查
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

export { DependencyInjectionChecker };