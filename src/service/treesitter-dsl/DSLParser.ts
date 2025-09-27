import { DSLLexer, Token, TokenType } from './DSLLexer';
import { CustomRuleDefinition, RuleCondition, RuleAction } from '../../models/CustomRuleTypes';

/**
 * DSL 语法分析器
 * 负责解析 DSL 语法结构
 */
export class DSLParser {
  private tokens: Token[] = [];
  private current = 0;

  parse(source: string): CustomRuleDefinition {
    const lexer = new DSLLexer();
    this.tokens = lexer.tokenize(source);
    this.current = 0;

    // Skip NEWLINE tokens at the beginning
    while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
      this.current++;
    }

    return this.parseRule();
  }

  private parseRule(): CustomRuleDefinition {
    this.consume('RULE', 'Expected "rule" keyword.');
    const name = this.consume('STRING', 'Expected rule name.').literal;
    this.consume('LEFT_BRACE', 'Expected "{" after rule name.');

    const description = this.parseDescription();
    const targetType = this.parseTarget();
    const conditions = this.parseConditions();
    const actions = this.parseMultipleActions();

    this.consume('RIGHT_BRACE', 'Expected "}" after rule definition.');

    return {
      name,
      description,
      targetType,
      pattern: '', // 将在编译时生成
      conditions,
      actions,
    };
  }

  private parseDescription(): string {
    this.consume('DESCRIPTION', 'Expected "description" keyword.');
    this.consume('COLON', 'Expected ":" after "description".');
    const token = this.consume('STRING', 'Expected description value.');
    return token.literal;
  }

  private parseTarget(): string {
    this.consume('TARGET', 'Expected "target" keyword.');
    this.consume('COLON', 'Expected ":" after "target".');
    const token = this.consume('STRING', 'Expected target value.');
    return token.literal;
  }

  private parseConditions(): RuleCondition[] {
    const conditions: RuleCondition[] = [];

    this.consume('CONDITION', 'Expected "condition" keyword.');
    this.consume('LEFT_BRACE', 'Expected "{" after "condition".');

    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      // Skip NEWLINE tokens
      while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
        this.current++;
      }

      // If we've reached the end or the right brace, break
      if (this.check('RIGHT_BRACE') || this.isAtEnd()) {
        break;
      }

      conditions.push(this.parseCondition());
    }

    this.consume('RIGHT_BRACE', 'Expected "}" after conditions.');
    return conditions;
  }

  private parseCondition(): RuleCondition {
    const typeToken = this.consume('IDENTIFIER', 'Expected condition type.');
    const type = this.mapConditionType(typeToken.lexeme);

    this.consume('COLON', 'Expected ":" after condition type.');

    let value: string;
    let operator: RuleCondition['operator'] = 'equals';

    if (this.check('IDENTIFIER')) {
      // 处理如 greaterThan(5) 这样的表达式
      const funcName = this.advance().lexeme;
      operator = this.mapOperator(funcName);

      this.consume('LEFT_PAREN', 'Expected "(" after function name.');
      const valueToken = this.consume(['STRING', 'NUMBER'], 'Expected value.');
      value = valueToken.literal.toString();
      this.consume('RIGHT_PAREN', 'Expected ")" after value.');
    } else {
      // 处理简单的值
      const valueToken = this.consume(['STRING', 'NUMBER'], 'Expected condition value.');
      value = valueToken.literal.toString();
    }

    return { type, value, operator };
  }

  private parseMultipleActions(): RuleAction[] {
    const actions: RuleAction[] = [];

    // Skip NEWLINE tokens before checking for ACTION
    while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
      this.current++;
    }

    while (this.check('ACTION') && !this.isAtEnd()) {
      const blockActions = this.parseActionBlock();
      actions.push(...blockActions);

      // Skip NEWLINE tokens between action blocks
      while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
        this.current++;
      }
    }

    return actions;
  }

  private parseActionBlock(): RuleAction[] {
    this.consume('ACTION', 'Expected "action" keyword.');
    this.consume('LEFT_BRACE', 'Expected "{" after "action".');

    // Skip NEWLINE tokens
    while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
      this.current++;
    }

    const action = this.parseAction();

    this.consume('RIGHT_BRACE', 'Expected "}" after action.');
    return [action];
  }

  private parseAction(): RuleAction {
    this.consume('TYPE', 'Expected "type" keyword.');
    this.consume('COLON', 'Expected ":" after "type".');
    const typeToken = this.consume('IDENTIFIER', 'Expected action type.');
    const type = typeToken.lexeme as 'extract' | 'highlight' | 'report';

    // 解析参数（如果存在）
    let parameters: Record<string, any> = {};

    // Skip NEWLINE tokens before checking for PARAMETERS
    while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
      this.current++;
    }

    if (this.check('PARAMETERS')) {
      this.advance(); // 消费 PARAMETERS
      this.consume('COLON', 'Expected ":" after "parameters".');
      this.consume('LEFT_BRACE', 'Expected "{" after "parameters".');

      parameters = this.parseParameters();

      this.consume('RIGHT_BRACE', 'Expected "}" after parameters.');
    }

    return { type, parameters };
  }

  private parseParameters(): Record<string, any> {
    const parameters: Record<string, any> = {};

    while (!this.check('RIGHT_BRACE') && !this.isAtEnd()) {
      // Skip NEWLINE tokens
      while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
        this.current++;
      }

      // If we've reached the right brace, break
      if (this.check('RIGHT_BRACE')) {
        break;
      }

      const key = this.consume('IDENTIFIER', 'Expected parameter key.').lexeme;
      this.consume('COLON', 'Expected ":" after parameter key.');

      let value: any;
      if (this.check('STRING')) {
        value = this.advance().literal;
      } else if (this.check('NUMBER')) {
        value = this.advance().literal;
      } else if (this.check('IDENTIFIER')) {
        const ident = this.advance().lexeme;
        // 处理布尔值
        if (ident.toLowerCase() === 'true') {
          value = true;
        } else if (ident.toLowerCase() === 'false') {
          value = false;
        } else {
          value = ident;
        }
      } else {
        throw new Error(`Unexpected token in parameters: ${this.peek()?.type}`);
      }

      parameters[key] = value;

      // 如果有逗号，消费它
      if (this.check('COMMA')) {
        this.advance();
      }
    }

    return parameters;
  }

  private mapConditionType(lexeme: string): RuleCondition['type'] {
    switch (lexeme.toLowerCase()) {
      case 'nodetype':
        return 'nodeType';
      case 'contentpattern':
        return 'contentPattern';
      case 'complexity':
        return 'complexity';
      case 'languagefeature':
        return 'languageFeature';
      default:
        throw new Error(`Unknown condition type: ${lexeme}`);
    }
  }

  private mapOperator(funcName: string): RuleCondition['operator'] {
    switch (funcName.toLowerCase()) {
      case 'equals':
        return 'equals';
      case 'contains':
        return 'contains';
      case 'matches':
        return 'matches';
      case 'greaterthan':
        return 'greaterThan';
      case 'lessthan':
        return 'lessThan';
      default:
        throw new Error(`Unknown operator: ${funcName}`);
    }
  }

  private consume(expected: TokenType | TokenType[], errorMessage: string): Token {
    // Skip NEWLINE tokens
    while (!this.isAtEnd() && this.tokens[this.current].type === 'NEWLINE') {
      this.current++;
    }

    if (Array.isArray(expected)) {
      for (const type of expected) {
        if (this.check(type)) {
          return this.advance();
        }
      }
    } else {
      if (this.check(expected)) {
        return this.advance();
      }
    }

    throw new Error(errorMessage);
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.tokens[this.current].type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  private peek(): Token | null {
    if (this.isAtEnd()) return null;
    return this.tokens[this.current];
  }

  private isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.tokens[this.current].type === 'EOF';
  }
}
