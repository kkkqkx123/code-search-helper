/**
 * 语言权重配置接口
 */
export interface ILanguageWeights {
  syntactic: number;
  function: number;
  class: number;
  method: number;
  import: number;
  logical: number;
  comment: number;
}

/**
 * 语言权重配置管理器
 * 提供不同编程语言的权重配置，用于代码分析和分段
 */
export class LanguageWeights {
  private static readonly DEFAULT_WEIGHTS: ILanguageWeights = {
    syntactic: 0.7,
    function: 0.8,
    class: 0.8,
    method: 0.7,
    import: 0.7,
    logical: 0.6,
    comment: 0.4
  };

  private static readonly LANGUAGE_SPECIFIC_WEIGHTS: Record<string, ILanguageWeights> = {
    typescript: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.9,
      method: 0.8,
      import: 0.7,
      logical: 0.6,
      comment: 0.4
    },
    javascript: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.9,
      method: 0.8,
      import: 0.7,
      logical: 0.6,
      comment: 0.4
    },
    python: {
      syntactic: 0.7,
      function: 0.9,
      class: 0.9,
      method: 0.8,
      import: 0.8,
      logical: 0.7,
      comment: 0.5
    },
    java: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.9,
      method: 0.8,
      import: 0.8,
      logical: 0.5,
      comment: 0.4
    },
    go: {
      syntactic: 0.7,
      function: 0.9,
      class: 0.7,
      method: 0.7,
      import: 0.8,
      logical: 0.6,
      comment: 0.4
    },
    rust: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.7,
      method: 0.8,
      import: 0.7,
      logical: 0.6,
      comment: 0.4
    },
    cpp: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.9,
      method: 0.8,
      import: 0.7,
      logical: 0.6,
      comment: 0.4
    },
    c: {
      syntactic: 0.7,
      function: 0.9,
      class: 0.5,
      method: 0.7,
      import: 0.6,
      logical: 0.6,
      comment: 0.4
    },
    csharp: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.9,
      method: 0.8,
      import: 0.8,
      logical: 0.5,
      comment: 0.4
    },
    scala: {
      syntactic: 0.8,
      function: 0.9,
      class: 0.8,
      method: 0.8,
      import: 0.7,
      logical: 0.6,
      comment: 0.4
    }
  };

  /**
   * 获取指定语言的权重配置
   * @param language 编程语言名称
   * @returns 语言权重配置
   */
  static getWeights(language: string): ILanguageWeights {
    if (!language) {
      return { ...LanguageWeights.DEFAULT_WEIGHTS };
    }

    const normalizedLanguage = language.toLowerCase();
    return { 
      ...(LanguageWeights.LANGUAGE_SPECIFIC_WEIGHTS[normalizedLanguage] || 
         LanguageWeights.DEFAULT_WEIGHTS) 
    };
  }

  /**
   * 获取默认权重配置
   * @returns 默认权重配置
   */
  static getDefaultWeights(): ILanguageWeights {
    return { ...LanguageWeights.DEFAULT_WEIGHTS };
  }

  /**
   * 获取所有支持的语言权重配置
   * @returns 所有语言的权重配置
   */
  static getAllWeights(): Record<string, ILanguageWeights> {
    return { ...LanguageWeights.LANGUAGE_SPECIFIC_WEIGHTS };
  }

  /**
   * 检查指定语言是否有特定权重配置
   * @param language 编程语言名称
   * @returns 是否有特定配置
   */
  static hasSpecificWeights(language: string): boolean {
    if (!language) return false;
    
    const normalizedLanguage = language.toLowerCase();
    return normalizedLanguage in LanguageWeights.LANGUAGE_SPECIFIC_WEIGHTS;
  }

  /**
   * 添加或更新语言的权重配置
   * @param language 编程语言名称
   * @param weights 权重配置
   */
  static setWeights(language: string, weights: ILanguageWeights): void {
    if (!language || !weights) return;
    
    const normalizedLanguage = language.toLowerCase();
    LanguageWeights.LANGUAGE_SPECIFIC_WEIGHTS[normalizedLanguage] = { ...weights };
  }

  /**
   * 验证权重配置是否有效
   * @param weights 权重配置
   * @returns 是否有效
   */
  static validateWeights(weights: ILanguageWeights): boolean {
    if (!weights || typeof weights !== 'object') {
      return false;
    }

    const requiredFields: (keyof ILanguageWeights)[] = [
      'syntactic', 'function', 'class', 'method', 'import', 'logical', 'comment'
    ];

    for (const field of requiredFields) {
      if (typeof weights[field] !== 'number' || 
          weights[field] < 0 || 
          weights[field] > 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * 标准化权重配置，确保所有值在0-1范围内
   * @param weights 权重配置
   * @returns 标准化后的权重配置
   */
  static normalizeWeights(weights: ILanguageWeights): ILanguageWeights {
    if (!weights) {
      return { ...LanguageWeights.DEFAULT_WEIGHTS };
    }

    const normalized: ILanguageWeights = { ...weights };

    // 确保所有值在0-1范围内
    Object.keys(normalized).forEach(key => {
      const value = normalized[key as keyof ILanguageWeights];
      if (typeof value === 'number') {
        normalized[key as keyof ILanguageWeights] = Math.max(0, Math.min(1, value));
      }
    });

    return normalized;
  }

  /**
   * 合并两个权重配置
   * @param baseWeights 基础权重配置
   * @param overrideWeights 覆盖权重配置
   * @returns 合并后的权重配置
   */
  static mergeWeights(
    baseWeights: ILanguageWeights, 
    overrideWeights: Partial<ILanguageWeights>
  ): ILanguageWeights {
    if (!baseWeights) {
      baseWeights = { ...LanguageWeights.DEFAULT_WEIGHTS };
    }

    if (!overrideWeights) {
      return { ...baseWeights };
    }

    return {
      ...baseWeights,
      ...overrideWeights
    };
  }
}

/**
 * 语言权重配置获取器类
 * 提供更便捷的权重配置访问方式
 */
export class LanguageWeightsProvider {
  private customWeights: Record<string, ILanguageWeights> = {};

  /**
   * 获取语言权重配置
   * @param language 编程语言名称
   * @returns 权重配置
   */
  getWeights(language: string): ILanguageWeights {
    if (this.customWeights[language]) {
      return { ...this.customWeights[language] };
    }

    return LanguageWeights.getWeights(language);
  }

  /**
   * 设置自定义权重配置
   * @param language 编程语言名称
   * @param weights 权重配置
   */
  setCustomWeights(language: string, weights: ILanguageWeights): void {
    if (LanguageWeights.validateWeights(weights)) {
      this.customWeights[language] = { ...weights };
    } else {
      console.warn(`Invalid weights provided for language: ${language}`);
    }
  }

  /**
   * 清除自定义权重配置
   * @param language 编程语言名称，如果不提供则清除所有
   */
  clearCustomWeights(language?: string): void {
    if (language) {
      delete this.customWeights[language];
    } else {
      this.customWeights = {};
    }
  }

  /**
   * 获取所有自定义权重配置
   * @returns 自定义权重配置
   */
  getAllCustomWeights(): Record<string, ILanguageWeights> {
    return { ...this.customWeights };
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const languageWeightsProvider = new LanguageWeightsProvider();