/**
 * DSL 词法分析器
 * 负责将 DSL 文本分解为词法单元
 */

export interface Token {
  type: TokenType;
  lexeme: string;
  literal: any;
}

export type TokenType =
  | 'RULE'
  | 'DESCRIPTION'
  | 'TARGET'
  | 'CONDITION'
  | 'ACTION'
  | 'TYPE'
  | 'PARAMETERS'
  | 'STRING'
  | 'NUMBER'
  | 'IDENTIFIER'
  | 'LEFT_BRACE'
  | 'RIGHT_BRACE'
  | 'LEFT_PAREN'
  | 'RIGHT_PAREN'
  | 'COLON'
  | 'DOT'
  | 'COMMA'
  | 'NEWLINE'
  | 'EOF';

export class DSLLexer {
  private tokens: Token[] = [];
  private current = 0;
  private source: string = '';

  tokenize(source: string): Token[] {
    this.source = source;
    this.tokens = [];
    this.current = 0;

    while (!this.isAtEnd()) {
      const char = this.advance();

      switch (char) {
        case ' ':
        case '\r':
        case '\t':
          // 忽略空白字符
          break;
        case '\n':
          this.addToken('NEWLINE');
          break;
        case '"':
          this.string();
          break;
        case '{':
          this.addToken('LEFT_BRACE');
          break;
        case '}':
          this.addToken('RIGHT_BRACE');
          break;
        case ':':
          this.addToken('COLON');
          break;
        case '.':
          this.addToken('DOT');
          break;
        case ',':
          this.addToken('COMMA');
          break;
        case '(':
          this.addToken('LEFT_PAREN');
          break;
        case ')':
          this.addToken('RIGHT_PAREN');
          break;
        default:
          if (this.isAlpha(char)) {
            this.identifier();
          } else if (this.isDigit(char)) {
            this.number();
          } else {
            throw new Error(`Unexpected character: ${char}`);
          }
      }
    }

    this.addToken('EOF');
    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    return this.source.charAt(this.current++);
  }

  private addToken(type: TokenType, literal?: any): void {
    const text = this.source.charAt(this.current - 1);
    this.tokens.push({ type, lexeme: text, literal });
  }

  private string(): void {
    let value = '';
    while (this.peek() !== '"' && !this.isAtEnd()) {
      value += this.advance();
    }

    if (this.isAtEnd()) {
      throw new Error('Unterminated string.');
    }

    // 跳过结束引号
    this.advance();

    this.tokens.push({
      type: 'STRING',
      lexeme: value,
      literal: value,
    });
  }

  private identifier(): void {
    let value = this.source.charAt(this.current - 1);
    while (this.isAlphaNumeric(this.peek()) && !this.isAtEnd()) {
      value += this.advance();
    }

    // 检查是否为关键字
    const type = this.isKeyword(value) ? (value.toUpperCase() as TokenType) : 'IDENTIFIER';

    this.tokens.push({
      type,
      lexeme: value,
      literal: value,
    });
  }

  private number(): void {
    let value = this.source.charAt(this.current - 1);
    while (this.isDigit(this.peek()) && !this.isAtEnd()) {
      value += this.advance();
    }

    this.tokens.push({
      type: 'NUMBER',
      lexeme: value,
      literal: parseFloat(value),
    });
  }

  private isAlpha(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlphaNumeric(char: string): boolean {
    return this.isAlpha(char) || this.isDigit(char);
  }

  private isKeyword(value: string): boolean {
    const keywords = ['RULE', 'DESCRIPTION', 'TARGET', 'CONDITION', 'ACTION', 'TYPE', 'PARAMETERS'];
    return keywords.includes(value.toUpperCase());
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }
}
