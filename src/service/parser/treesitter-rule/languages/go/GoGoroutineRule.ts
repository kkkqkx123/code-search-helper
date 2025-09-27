import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';
import { SnippetChunk } from '../../../types';

/**
 * Go Goroutine Rule - Identifies Go goroutine and concurrency patterns
 */
export class GoGoroutineRule extends AbstractSnippetRule {
  readonly name = 'GoGoroutineRule';
  readonly supportedNodeTypes = new Set([
    'go_statement',
    'channel_expression',
    'send_statement',
    'receive_statement',
    'select_statement',
    'range_clause',
  ]);
  protected readonly snippetType = 'go_goroutine' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for Go concurrency patterns
    return this.containsGoConcurrencyPattern(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const concurrencyFeatures = this.analyzeGoConcurrencyFeatures(content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: {
          ...this.analyzeLanguageFeatures(content),
          ...concurrencyFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        goConcurrencyInfo: this.extractGoConcurrencyInfo(content),
      },
    };
  }

  private containsGoConcurrencyPattern(content: string): boolean {
    const concurrencyPatterns = [
      // Goroutines
      /go\s+\w+\s*\(/,
      /go\s+func\s*\(\)/,
      // Channels
      /make\s*\(\s*chan/,
      /<-\w+/,
      /\w+\s*<-\w+/,
      // Select statements
      /select\s*\{/,
      // Range over channels
      /range\s+\w+/,
      // Sync primitives
      /sync\./,
      /mutex\./,
      /WaitGroup/,
    ];

    return concurrencyPatterns.some(pattern => pattern.test(content));
  }

  private analyzeGoConcurrencyFeatures(content: string): {
    usesGoroutines?: boolean;
    usesChannels?: boolean;
    usesSelect?: boolean;
    usesSyncPrimitives?: boolean;
    concurrencyComplexity?: number;
  } {
    const goroutineCount = (content.match(/go\s+/g) || []).length;
    const channelCount = (content.match(/make\s*\(\s*chan/g) || []).length;
    const selectCount = (content.match(/select\s*\{/g) || []).length;
    const syncCount = (content.match(/sync\./g) || []).length;

    return {
      usesGoroutines: goroutineCount > 0,
      usesChannels: channelCount > 0 || /<-\w+/.test(content),
      usesSelect: selectCount > 0,
      usesSyncPrimitives: syncCount > 0 || /mutex\./.test(content),
      concurrencyComplexity: goroutineCount + channelCount + selectCount + syncCount,
    };
  }

  private extractGoConcurrencyInfo(content: string): {
    goroutines: number;
    channels: string[];
    usesSelect: boolean;
    usesWaitGroup: boolean;
    usesMutex: boolean;
    communicationPatterns: string[];
    purpose?: string;
  } {
    const goroutines = (content.match(/go\s+/g) || []).length;
    const channels: string[] = [];
    const communicationPatterns: string[] = [];

    // Extract channel names
    const channelRegex = /make\s*\(\s*chan\s+([a-zA-Z_]\w*)/g;
    let match;
    while ((match = channelRegex.exec(content)) !== null) {
      channels.push(match[1]);
    }

    // Extract communication patterns
    if (content.includes('<-') && content.includes('select')) {
      communicationPatterns.push('select_based_communication');
    }
    if (content.includes('range') && channels.some(ch => content.includes(ch))) {
      communicationPatterns.push('channel_iteration');
    }
    if (content.includes('go') && channels.length > 0) {
      communicationPatterns.push('goroutine_communication');
    }

    const usesSelect = /select\s*\{/.test(content);
    const usesWaitGroup = /WaitGroup/.test(content);
    const usesMutex = /mutex\./i.test(content) || /sync\.Mutex/.test(content);
    const purpose = this.inferConcurrencyPurpose(content, goroutines, channels.length);

    return {
      goroutines,
      channels: [...new Set(channels)],
      usesSelect,
      usesWaitGroup,
      usesMutex,
      communicationPatterns: [...new Set(communicationPatterns)],
      purpose,
    };
  }

  private inferConcurrencyPurpose(content: string, goroutines: number, channels: number): string {
    if (goroutines > 0 && channels > 0) {
      return 'concurrent_processing_with_communication';
    }
    if (goroutines > 0) {
      return 'concurrent_processing';
    }
    if (channels > 0) {
      return 'channel_communication';
    }
    if (content.includes('select')) {
      return 'multiplexed_communication';
    }
    if (content.includes('WaitGroup')) {
      return 'synchronization';
    }
    return 'general_concurrency';
  }

  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const concurrencyComplexity = this.calculateGoConcurrencyComplexity(content);

    return baseComplexity + concurrencyComplexity;
  }

  private calculateGoConcurrencyComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for goroutines
    complexity += (content.match(/go\s+/g) || []).length * 3;

    // Add complexity for channels
    complexity += (content.match(/make\s*\(\s*chan/g) || []).length * 2;
    complexity += (content.match(/<-\w+/g) || []).length;
    complexity += (content.match(/\w+\s*<-\w+/g) || []).length;

    // Add complexity for select statements
    complexity += (content.match(/select\s*\{/g) || []).length * 4;

    // Add complexity for sync primitives
    complexity += (content.match(/sync\./g) || []).length * 2;
    complexity += (content.match(/WaitGroup/g) || []).length * 3;
    complexity += (content.match(/mutex\./i) || []).length * 2;

    // Add complexity for communication patterns
    if (content.includes('select') && content.includes('<-')) {
      complexity += 5;
    }
    if (content.includes('range') && content.includes('chan')) {
      complexity += 3;
    }

    return complexity;
  }
}
