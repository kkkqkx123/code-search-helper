import { BaseCommentAdapter } from './BaseAdapter';
import { JavaScriptCommentAdapter } from './JavaScriptCommentAdapter';

/**
 * 注释适配器工厂
 */
export class CommentAdapterFactory {
  private static adapterCache = new Map<string, BaseCommentAdapter>();

  /**
   * 获取语言特定的适配器
   */
  static getAdapter(language: string): BaseCommentAdapter {
    const normalizedLanguage = language.toLowerCase();
    
    if (this.adapterCache.has(normalizedLanguage)) {
      return this.adapterCache.get(normalizedLanguage)!;
    }

    const adapter = this.createAdapter(normalizedLanguage);
    this.adapterCache.set(normalizedLanguage, adapter);
    
    return adapter;
  }

  /**
   * 创建适配器
   */
  private static createAdapter(language: string): BaseCommentAdapter {
    // 目前所有语言使用相同的适配器
    // 未来可以根据需要添加特定实现
    return new JavaScriptCommentAdapter();
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.adapterCache.clear();
  }
}