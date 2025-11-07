/**
 * 性能监控装饰器
 * 用于自动收集方法执行的性能数据
 */

import { MetadataBuilder } from './MetadataBuilder';

/**
 * 性能监控装饰器工厂
 * @param target 类的原型
 * @param propertyName 方法名称
 * @param descriptor 方法描述符
 */
export function withPerformanceMonitoring<T extends any[], R>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
): TypedPropertyDescriptor<(...args: T) => Promise<R>> {
  const method = descriptor.value!;
  
  descriptor.value = async function(...args: T): Promise<R> {
    const startTime = Date.now();
    const builder = new MetadataBuilder().setProcessingStartTime(startTime);
    
    try {
      const result = await method.apply(this, args);
      
      // 记录成功的性能数据
      const performanceData = {
        processingTime: Date.now() - startTime,
        memoryUsage: builder.getMemoryUsage(),
        cacheHitRate: 0, // nodeCount 需要根据实际情况设置
        nodeCount: 0,    // cacheHitRate 需要根据实际情况设置
        phase: propertyName,
        timestamp: Date.now()
      };
      
      // 可以将性能数据存储到监控系统（如果存在）
      if (this && typeof this === 'object' && 'performanceAdapter' in this && this.performanceAdapter) {
        (this as any).performanceAdapter?.recordOperation?.(propertyName, 1, Date.now() - startTime);
      }
      
      return result;
    } catch (error: unknown) {
      // 记录错误和性能数据
      const errorForMetadata = error instanceof Error ? error : new Error(String(error));
      builder.setError(errorForMetadata, { operation: propertyName, args: args.length > 0 ? args[0] : undefined });
      throw error;
    }
  };
  
  return descriptor;
}

/**
 * 性能监控装饰器（带返回值处理）
 * 将性能元数据注入到返回的 StandardizedQueryResult 中
 */
export function withPerformanceMonitoringAndMetadata<T extends any[], R extends { metadata: any } | Array<{ metadata: any }>>(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
): TypedPropertyDescriptor<(...args: T) => Promise<R>> {
  const method = descriptor.value!;
  
  descriptor.value = async function(...args: T): Promise<R> {
    const startTime = Date.now();
    const builder = new MetadataBuilder().setProcessingStartTime(startTime);
    
    try {
      const result = await method.apply(this, args);
      
      // 计算性能数据
      const performanceData = {
        processingTime: Date.now() - startTime,
        memoryUsage: builder.getMemoryUsage(),
        cacheHitRate: 0, // 需要根据实际情况设置
        nodeCount: 0,    // 需要根据实际情况设置
        phase: propertyName,
        timestamp: Date.now()
      };
      
      // 将性能数据添加到结果的元数据中
      if (Array.isArray(result)) {
        // 如果返回的是数组，为每个元素添加性能元数据
        for (const item of result) {
          if (item && typeof item === 'object' && item.metadata) {
            const itemBuilder = MetadataBuilder.fromComplete(item.metadata);
            itemBuilder.addCustomField('performance', performanceData);
            item.metadata = itemBuilder.build();
          }
        }
      } else if (result && typeof result === 'object' && result.metadata) {
        // 如果返回的是单个对象，为该对象添加性能元数据
        const resultBuilder = MetadataBuilder.fromComplete(result.metadata);
        resultBuilder.addCustomField('performance', performanceData);
        result.metadata = resultBuilder.build();
      }
      
      // 可以将性能数据存储到监控系统（如果存在）
      if (this && typeof this === 'object' && 'performanceAdapter' in this && this.performanceAdapter) {
        (this as any).performanceAdapter?.recordOperation?.(propertyName, 1, Date.now() - startTime);
      }
      
      return result;
    } catch (error: unknown) {
      // 记录错误和性能数据
      const errorForMetadata = error instanceof Error ? error : new Error(String(error));
      builder.setError(errorForMetadata, { operation: propertyName, args: args.length > 0 ? args[0] : undefined });
      throw error;
    }
  };
  
  return descriptor;
}