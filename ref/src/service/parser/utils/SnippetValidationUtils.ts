import { SnippetMetadata } from '../types';

export class SnippetValidationUtils {
  static isValidSnippet(content: string, snippetType: SnippetMetadata['snippetType']): boolean {
    if (content.length < 5) return false;
    if (content.length > 1500) return false;

    const meaningfulContent = content.replace(/[{}[\]()\s;]/g, '');
    if (meaningfulContent.length < 3) return false;

    switch (snippetType) {
      case 'control_structure':
        return /(?:if|for|while|switch|try|catch|finally)\b/.test(content);
      case 'error_handling':
        return /(?:try|catch|throw|finally)\b/.test(content);
      case 'function_call_chain':
        return /\w+\(/.test(content);
      case 'logic_block':
        return content.includes(';') || content.includes('{') || content.includes('function');
      case 'comment_marked':
        return true;
      default:
        return true;
    }
  }

  static analyzeLanguageFeatures(content: string): SnippetMetadata['languageFeatures'] {
    return {
      usesAsync: /\basync\b/.test(content) && /\bawait\b/.test(content),
      usesGenerators: /\bfunction\*\b/.test(content) || /\byield\b/.test(content),
      usesDestructuring: /[{[]\s*\w+/.test(content) || /=\s*[{[]/.test(content),
      usesSpread: /\.\.\./.test(content),
      usesTemplateLiterals: /`.*\$\{.*\}`/.test(content),
    };
  }

  static calculateComplexity(content: string): number {
    let complexity = 1;

    const controlStructures = content.match(
      /\b(?:if|else|for|while|switch|case|try|catch|finally)\b/g
    );
    complexity += controlStructures ? controlStructures.length : 0;

    const logicalOps = content.match(/&&|\|\|/g);
    complexity += logicalOps ? logicalOps.length : 0;

    const brackets = content.match(/[{}[\]()]/g);
    complexity += brackets ? brackets.length * 0.5 : 0;

    const functionCalls = content.match(/\w+\s*\(/g);
    complexity += functionCalls ? functionCalls.length * 0.3 : 0;

    return Math.round(complexity);
  }

  static isStandaloneSnippet(
    content: string,
    snippetType: SnippetMetadata['snippetType']
  ): boolean {
    switch (snippetType) {
      case 'control_structure':
      case 'error_handling':
        return content.includes('{') || content.includes(';');
      case 'function_call_chain':
        return content.endsWith(')');
      case 'expression_sequence':
        return content.includes(',');
      case 'logic_block':
        return true;
      default:
        return false;
    }
  }

  static hasSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\+\+|--/,
      /\b(?:delete|new|throw)\b/,
      /\.\w+\s*=/,
      /\b(?:console\.log|process\.exit|process\.kill)\b/,
    ];

    const hasSideEffect = sideEffectPatterns.some(pattern => pattern.test(content));

    if (!hasSideEffect && /=/.test(content)) {
      if (/\.\w+\s*=/.test(content)) {
        return true;
      }

      if (/\b(?:window|global|document|console|process|module|exports)\.\w+\s*=/.test(content)) {
        return true;
      }
    }

    return hasSideEffect;
  }
}
