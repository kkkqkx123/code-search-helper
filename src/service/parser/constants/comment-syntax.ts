/**
 * 注释语法相关常量和工具函数
 * 包含各种编程语言的注释语法定义
 */

import { CommentSyntax } from '../processing/core/interfaces/IProcessingContext';
import { LanguageFamily } from './language-family';
import { LanguageClassificationUtils } from './language-classification';



/**
 * 注释语法工具函数集合
 */
export const CommentSyntaxUtils = {
  /**
   * 获取默认注释语法
   */
  getDefaultCommentSyntax(language: string): CommentSyntax {
    // 特定语言的注释语法（覆盖家族默认值）
    const languageSpecificSyntax: Record<string, CommentSyntax> = {
      csharp: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '///',
        docEnd: ''
      },
      html: {
        singleLine: [],
        multiLineStart: '<!--',
        multiLineEnd: '-->'
      },
      css: {
        singleLine: [],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      },
      sql: {
        singleLine: ['--'],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      }
    };

    // 首先检查是否有特定语言的注释语法
    const specificSyntax = languageSpecificSyntax[language.toLowerCase()];
    if (specificSyntax) {
      return specificSyntax;
    }

    // 按语言家族定义的注释语法
    const commentSyntaxByFamily: Record<LanguageFamily, CommentSyntax> = {
      [LanguageFamily.JAVASCRIPT]: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      [LanguageFamily.JAVA]: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      [LanguageFamily.C]: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      [LanguageFamily.PYTHON]: {
        singleLine: ['#', "'''", '"""'], // 添加单引号和双引号支持
        multiLineStart: '"""',
        multiLineEnd: '"""',
        docStart: '"""',
        docEnd: '"""'
      },
      [LanguageFamily.SCRIPTING]: {
        singleLine: ['#'],
        multiLineStart: '"""',
        multiLineEnd: '"""',
        docStart: '"""',
        docEnd: '"""'
      },
      [LanguageFamily.MARKUP]: {
        singleLine: [],
        multiLineStart: '<!--',
        multiLineEnd: '-->'
      },
      [LanguageFamily.STYLE]: {
        singleLine: [],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      },
      [LanguageFamily.DATA]: {
        singleLine: ['--'],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      },
      [LanguageFamily.FUNCTIONAL]: {
        singleLine: [';;'],
        multiLineStart: '#|',
        multiLineEnd: '|#'
      },
      [LanguageFamily.CONFIG]: {
        singleLine: ['#'],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      },
      [LanguageFamily.UNKNOWN]: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      }
    };

    // 然后根据语言家族获取注释语法
    const languageFamily = LanguageClassificationUtils.getLanguageFamily(language);
    const familySyntax = commentSyntaxByFamily[languageFamily];
    if (familySyntax) {
      return familySyntax;
    }

    // 最后返回默认注释语法
    return {
      singleLine: ['//'],
      multiLineStart: '/*',
      multiLineEnd: '*/'
    };
  }
};