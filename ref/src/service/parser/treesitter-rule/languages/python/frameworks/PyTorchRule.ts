import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * PyTorch Framework Rule - Identifies PyTorch neural networks, training loops, and ML patterns
 */
export class PyTorchRule extends AbstractSnippetRule {
  readonly name = 'PyTorchRule';
  readonly supportedNodeTypes = new Set([
    // Neural network definitions
    'class_definition',
    'function_definition',

    // PyTorch specific patterns
    'assignment',
    'call_expression',
    'attribute',

    // Import statements
    'import_statement',
    'import_from_statement',

    // Control flow for training
    'for_statement',
    'while_statement',
    'if_statement',
  ]);

  protected readonly snippetType = 'pytorch_neural_network' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is PyTorch-related code
    return this.isPyTorchCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const pytorchMetadata = this.extractPyTorchMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractPyTorchImports(node, sourceCode),
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculatePyTorchComplexity(content),
        isStandalone: this.isStandalonePyTorchComponent(node, content),
        hasSideEffects: this.hasSideEffects(content),
        pytorchInfo: pytorchMetadata,
      },
    };
  }

  private isPyTorchCode(content: string): boolean {
    const pytorchPatterns = [
      // PyTorch imports
      /import\s+torch/,
      /from\s+torch\s+import/,
      /import\s+torch\.nn/,
      /from\s+torch\.nn\s+import/,
      /import\s+torch\.optim/,
      /from\s+torch\.optim\s+import/,
      /import\s+torch\.utils\.data/,
      /from\s+torch\.utils\.data\s+import/,

      // Neural network patterns
      /class\s+\w+\s*\(\s*nn\.Module\s*\)/,
      /class\s+\w+\s*\(\s*torch\.nn\.Module\s*\)/,

      // Layer definitions
      /self\.\w+\s*=\s*nn\.Linear\(/,
      /self\.\w+\s*=\s*nn\.Conv2d\(/,
      /self\.\w+\s*=\s*nn\.Conv1d\(/,
      /self\.\w+\s*=\s*nn\.MaxPool2d\(/,
      /self\.\w+\s*=\s*nn\.AvgPool2d\(/,
      /self\.\w+\s*=\s*nn\.LSTM\(/,
      /self\.\w+\s*=\s*nn\.GRU\(/,
      /self\.\w+\s*=\s*nn\.RNN\(/,
      /self\.\w+\s*=\s*nn\.Transformer\(/,
      /self\.\w+\s*=\s*nn\.TransformerEncoder\(/,
      /self\.\w+\s*=\s*nn\.TransformerDecoder\(/,
      /self\.\w+\s*=\s*nn\.Embedding\(/,
      /self\.\w+\s*=\s*nn\.Dropout\(/,
      /self\.\w+\s*=\s*nn\.BatchNorm2d\(/,
      /self\.\w+\s*=\s*nn\.ReLU\(/,
      /self\.\w+\s*=\s*nn\.Sigmoid\(/,
      /self\.\w+\s*=\s*nn\.Tanh\(/,
      /self\.\w+\s*=\s*nn\.Softmax\(/,

      // Training loop patterns
      /model\.train\(\)/,
      /model\.eval\(\)/,
      /optimizer\.zero_grad\(\)/,
      /loss\.backward\(\)/,
      /optimizer\.step\(\)/,
      /for\s+epoch\s+in\s+range\s*\(/,

      // Tensor operations
      /torch\.tensor\(/,
      /torch\.zeros\(/,
      /torch\.ones\(/,
      /torch\.randn\(/,
      /torch\.empty\(/,
      /torch\.from_numpy\(/,
      /\.to\s*\([^)]+\)/,
      /\.cuda\(\)/,
      /\.cpu\(\)/,

      // Loss functions
      /nn\.MSELoss\(/,
      /nn\.CrossEntropyLoss\(/,
      /nn\.BCELoss\(/,
      /nn\.NLLLoss\(/,

      // Optimizers
      /torch\.optim\.Adam\(/,
      /torch\.optim\.SGD\(/,
      /torch\.optim\.RMSprop\(/,
      /torch\.optim\.Adagrad\(/,

      // Data loading
      /DataLoader\(/,
      /Dataset\s*\(/,
      /TensorDataset\(/,

      // Forward and backward
      /def\s+forward\(/,
      /def\s+backward\(/,

      // Common ML patterns
      /with\s+torch\.no_grad\(\)/,
      /torch\.save\(/,
      /torch\.load\(/,

      // Device management
      /device\s*=\s*torch\.device/,
      /\.to\(device\)/,

      // Autograd
      /requires_grad\s*=\s*True/,
      /with\s+torch\.set_grad_enabled\(/,

      // Distributed training
      /torch\.distributed/,
      /torch\.nn\.parallel\.DistributedDataParallel/,

      // Mixed precision
      /torch\.cuda\.amp/,
      /autocast\(/,
      /GradScaler\(/,

      // Gradient clipping
      /torch\.nn\.utils\.clip_grad_norm_/,
      /torch\.nn\.utils\.clip_grad_value_/,

      // Learning rate scheduling
      /torch\.optim\.lr_scheduler/,
      /StepLR\(/,
      /ReduceLROnPlateau\(/,

      // Model evaluation
      /with\s+torch\.no_grad\(\)/,
      /model\.eval\(\)/,
      /accuracy\s*=/,
      /precision\s*=/,
      /recall\s*=/,
    ];

    return pytorchPatterns.some(pattern => pattern.test(content));
  }

  private extractPyTorchMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    return {
      neuralNetwork: this.extractNeuralNetworkInfo(node, content),
      training: this.extractTrainingInfo(content),
      data: this.extractDataInfo(content),
      performance: this.extractPerformanceInfo(content),
      patterns: this.extractPatternInfo(content),
    };
  }

  private extractNeuralNetworkInfo(node: Parser.SyntaxNode, content: string) {
    const className = this.extractClassName(node, content);
    const layers = this.extractLayers(content);
    const { totalParameters, trainableParameters } = this.extractParameterInfo(content);

    return {
      className: className || 'Unknown',
      layers,
      totalParameters,
      trainableParameters,
    };
  }

  private extractClassName(node: Parser.SyntaxNode, content: string): string | undefined {
    if (node.type === 'class_definition') {
      const classPattern = /class\s+(\w+)\s*\(/;
      const match = content.match(classPattern);
      return match ? match[1] : undefined;
    }
    return undefined;
  }

  private extractLayers(content: string) {
    const layers: any[] = [];

    const layerPatterns = [
      {
        type: 'Linear',
        pattern: /self\.(\w+)\s*=\s*nn\.Linear\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g,
        extractor: (match: RegExpMatchArray) => ({
          inputSize: parseInt(match[2]),
          outputSize: parseInt(match[3]),
          parameters: { in_features: parseInt(match[2]), out_features: parseInt(match[3]) },
        }),
      },
      {
        type: 'Conv2d',
        pattern: /self\.(\w+)\s*=\s*nn\.Conv2d\s*\(\s*(\d+)\s*,\s*(\d+)\s*,[^)]*\)/g,
        extractor: (match: RegExpMatchArray) => ({
          inputSize: parseInt(match[2]),
          outputSize: parseInt(match[3]),
          parameters: { in_channels: parseInt(match[2]), out_channels: parseInt(match[3]) },
        }),
      },
      {
        type: 'LSTM',
        pattern: /self\.(\w+)\s*=\s*nn\.LSTM\s*\(\s*(\d+)\s*,\s*(\d+)\s*[^)]*\)/g,
        extractor: (match: RegExpMatchArray) => ({
          inputSize: parseInt(match[2]),
          outputSize: parseInt(match[3]),
          parameters: { input_size: parseInt(match[2]), hidden_size: parseInt(match[3]) },
        }),
      },
      {
        type: 'Embedding',
        pattern: /self\.(\w+)\s*=\s*nn\.Embedding\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g,
        extractor: (match: RegExpMatchArray) => ({
          inputSize: parseInt(match[2]),
          outputSize: parseInt(match[3]),
          parameters: { num_embeddings: parseInt(match[2]), embedding_dim: parseInt(match[3]) },
        }),
      },
    ];

    layerPatterns.forEach(({ type, pattern, extractor }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const layerInfo = extractor(match);
        layers.push({
          type,
          ...layerInfo,
        });
      }
    });

    return layers;
  }

  private extractParameterInfo(content: string) {
    // Estimate parameters based on layer configurations
    let totalParameters = 0;
    let trainableParameters = 0;

    // Linear layers: input_size * output_size + output_size (bias)
    const linearMatches = content.match(/nn\.Linear\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g) || [];
    linearMatches.forEach(match => {
      const [, inputSize, outputSize] = match.match(/(\d+)/g) || [];
      const inSize = parseInt(inputSize);
      const outSize = parseInt(outputSize);
      const params = inSize * outSize + outSize; // weights + bias
      totalParameters += params;
      trainableParameters += params;
    });

    // Conv2d layers: in_channels * out_channels * kernel_size^2 + out_channels (bias)
    const convMatches = content.match(/nn\.Conv2d\s*\(\s*(\d+)\s*,\s*(\d+)\s*[^)]*\)/g) || [];
    convMatches.forEach(match => {
      const [, inChannels, outChannels] = match.match(/(\d+)/g) || [];
      const inCh = parseInt(inChannels);
      const outCh = parseInt(outChannels);
      // Simplified calculation assuming 3x3 kernel
      const params = inCh * outCh * 9 + outCh;
      totalParameters += params;
      trainableParameters += params;
    });

    return { totalParameters, trainableParameters };
  }

  private extractTrainingInfo(content: string) {
    const epochs = this.extractEpochs(content);
    const batchSize = this.extractBatchSize(content);
    const optimizer = this.extractOptimizer(content);
    const lossFunction = this.extractLossFunction(content);
    const learningRate = this.extractLearningRate(content);
    const device = this.extractDevice(content);

    return {
      epochs,
      batchSize,
      optimizer,
      lossFunction,
      learningRate,
      device,
    };
  }

  private extractEpochs(content: string): number {
    const epochPattern = /for\s+epoch\s+in\s+range\s*\(\s*(\d+)\s*\)/;
    const match = content.match(epochPattern);
    return match ? parseInt(match[1]) : 0;
  }

  private extractBatchSize(content: string): number {
    const batchPattern = /batch_size\s*=\s*(\d+)/;
    const match = content.match(batchPattern);
    return match ? parseInt(match[1]) : 32; // Default batch size
  }

  private extractOptimizer(content: string): string {
    const optimizerPatterns = [
      { name: 'Adam', pattern: /optim\.Adam\s*\(/ },
      { name: 'SGD', pattern: /optim\.SGD\s*\(/ },
      { name: 'RMSprop', pattern: /optim\.RMSprop\s*\(/ },
      { name: 'Adagrad', pattern: /optim\.Adagrad\s*\(/ },
    ];

    for (const { name, pattern } of optimizerPatterns) {
      if (pattern.test(content)) {
        return name;
      }
    }
    return 'Unknown';
  }

  private extractLossFunction(content: string): string {
    const lossPatterns = [
      { name: 'MSELoss', pattern: /nn\.MSELoss\s*\(/ },
      { name: 'CrossEntropyLoss', pattern: /nn\.CrossEntropyLoss\s*\(/ },
      { name: 'BCELoss', pattern: /nn\.BCELoss\s*\(/ },
      { name: 'NLLLoss', pattern: /nn\.NLLLoss\s*\(/ },
    ];

    for (const { name, pattern } of lossPatterns) {
      if (pattern.test(content)) {
        return name;
      }
    }
    return 'Unknown';
  }

  private extractLearningRate(content: string): number {
    const lrPatterns = [
      /lr\s*=\s*([\d.]+)/,
      /learning_rate\s*=\s*([\d.]+)/,
      /optim\.\w+\s*\([^)]*lr\s*=\s*([\d.]+)[^)]*\)/,
    ];

    for (const pattern of lrPatterns) {
      const match = content.match(pattern);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return 0.001; // Default learning rate
  }

  private extractDevice(content: string): 'cpu' | 'cuda' | 'mps' {
    if (content.includes('.cuda()') || content.includes('device\s*=\s*.*cuda')) {
      return 'cuda';
    }
    if (content.includes('device\s*=\s*.*mps') || content.includes(".to('mps')")) {
      return 'mps';
    }
    return 'cpu';
  }

  private extractDataInfo(content: string) {
    const inputShape = this.extractInputShape(content);
    const outputShape = this.extractOutputShape(content);
    const datasetSize = this.extractDatasetSize(content);
    const dataLoaders = this.extractDataLoaders(content);
    const augmentation = this.hasDataAugmentation(content);

    return {
      inputShape,
      outputShape,
      datasetSize,
      dataLoaders,
      augmentation,
    };
  }

  private extractInputShape(content: string): number[] {
    const shapePatterns = [
      /input_shape\s*=\s*\[([^\]]+)\]/,
      /shape\s*=\s*\[([^\]]+)\].*input/,
      /x\.shape\s*=\s*\[([^\]]+)\]/,
    ];

    for (const pattern of shapePatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1]
          .split(',')
          .map(dim => parseInt(dim.trim()))
          .filter(dim => !isNaN(dim));
      }
    }
    return [];
  }

  private extractOutputShape(content: string): number[] {
    const shapePatterns = [
      /output_shape\s*=\s*\[([^\]]+)\]/,
      /shape\s*=\s*\[([^\]]+)\].*output/,
      /y\.shape\s*=\s*\[([^\]]+)\]/,
    ];

    for (const pattern of shapePatterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1]
          .split(',')
          .map(dim => parseInt(dim.trim()))
          .filter(dim => !isNaN(dim));
      }
    }
    return [];
  }

  private extractDatasetSize(content: string): number {
    const sizePatterns = [
      /len\s*\(\s*dataset\s*\)\s*=\s*(\d+)/,
      /dataset_size\s*=\s*(\d+)/,
      /size\s*=\s*(\d+)/,
    ];

    for (const pattern of sizePatterns) {
      const match = content.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    return 0;
  }

  private extractDataLoaders(content: string): string[] {
    const dataLoaders: string[] = [];

    const dataloaderPattern = /(\w+)\s*=\s*DataLoader\s*\(/g;
    let match;

    while ((match = dataloaderPattern.exec(content)) !== null) {
      dataLoaders.push(match[1]);
    }

    return dataLoaders;
  }

  private hasDataAugmentation(content: string): boolean {
    const augmentationPatterns = [
      /transforms\.RandomHorizontalFlip\(/,
      /transforms\.RandomRotation\(/,
      /transforms\.RandomCrop\(/,
      /transforms\.ColorJitter\(/,
      /transforms\.RandomResizedCrop\(/,
      /transforms\.Normalize\(/,
      /albumentations\./,
      /imgaug\./,
    ];

    return augmentationPatterns.some(pattern => pattern.test(content));
  }

  private extractPerformanceInfo(content: string) {
    const gpuAcceleration = this.hasGPUAcceleration(content);
    const mixedPrecision = this.hasMixedPrecision(content);
    const gradientClipping = this.hasGradientClipping(content);
    const checkpointing = this.hasCheckpointing(content);

    return {
      gpuAcceleration,
      mixedPrecision,
      gradientClipping,
      checkpointing,
    };
  }

  private hasGPUAcceleration(content: string): boolean {
    return (
      content.includes('.cuda()') ||
      content.includes('torch.cuda') ||
      content.includes('device.*cuda')
    );
  }

  private hasMixedPrecision(content: string): boolean {
    return (
      content.includes('autocast') ||
      content.includes('GradScaler') ||
      content.includes('torch.cuda.amp')
    );
  }

  private hasGradientClipping(content: string): boolean {
    return content.includes('clip_grad_norm') || content.includes('clip_grad_value');
  }

  private hasCheckpointing(content: string): boolean {
    return content.includes('torch.utils.checkpoint') || content.includes('checkpoint_sequential');
  }

  private extractPatternInfo(content: string) {
    return {
      usesDistributed: this.hasDistributedTraining(content),
      usesCustomLoss: this.hasCustomLoss(content),
      usesScheduler: this.hasScheduler(content),
      usesEarlyStopping: this.hasEarlyStopping(content),
    };
  }

  private hasDistributedTraining(content: string): boolean {
    return (
      content.includes('torch.distributed') ||
      content.includes('DistributedDataParallel') ||
      content.includes('distributed.init_process_group')
    );
  }

  private hasCustomLoss(content: string): boolean {
    return (
      content.includes('def custom_loss') ||
      content.includes('class CustomLoss') ||
      (content.includes('def') && content.includes('loss') && content.includes('return'))
    );
  }

  private hasScheduler(content: string): boolean {
    return (
      content.includes('lr_scheduler') ||
      content.includes('StepLR') ||
      content.includes('ReduceLROnPlateau') ||
      content.includes('scheduler.step')
    );
  }

  private hasEarlyStopping(content: string): boolean {
    return (
      content.includes('early_stopping') ||
      content.includes('EarlyStopping') ||
      (content.includes('patience') && content.includes('validation'))
    );
  }

  private extractPyTorchImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement' || n.type === 'import_from_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (importText.includes('torch')) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private isStandalonePyTorchComponent(node: Parser.SyntaxNode, content: string): boolean {
    return (
      (node.type === 'class_definition' && content.includes('nn.Module')) ||
      (content.includes('def forward(') && content.includes('return')) ||
      (content.includes('model.train()') && content.includes('optimizer.step()'))
    );
  }

  private calculatePyTorchComplexity(content: string): number {
    let complexity = 0;

    // Neural network complexity
    complexity += content.match(/class\s+\w+\s*\(\s*nn\.Module\s*\)/g)?.length || 0;
    complexity += (content.match(/self\.\w+\s*=\s*nn\.\w+\s*\(/g) || []).length * 2;

    // Training complexity
    complexity += content.includes('for epoch in range') ? 5 : 0;
    complexity += (content.match(/optimizer\.step\(\)/g) || []).length * 3;
    complexity += (content.match(/loss\.backward\(\)/g) || []).length * 2;
    complexity += (content.match(/model\.train\(\)/g) || []).length;
    complexity += (content.match(/model\.eval\(\)/g) || []).length;

    // Data handling complexity
    complexity += (content.match(/DataLoader\s*\(/g) || []).length * 2;
    complexity += (content.match(/Dataset\s*\(/g) || []).length;

    // Advanced features complexity
    complexity += content.includes('torch.distributed') ? 10 : 0;
    complexity += content.includes('autocast') ? 5 : 0;
    complexity += content.includes('GradScaler') ? 3 : 0;
    complexity += content.includes('lr_scheduler') ? 3 : 0;

    // Model architecture complexity
    complexity += (content.match(/nn\.Linear\s*\(/g) || []).length;
    complexity += (content.match(/nn\.Conv\d+d\s*\(/g) || []).length * 2;
    complexity += (content.match(/nn\.LSTM\s*\(/g) || []).length * 3;
    complexity += (content.match(/nn\.Transformer\s*\(/g) || []).length * 4;

    // Custom implementation complexity
    complexity += content.includes('def forward(') ? 3 : 0;
    complexity += content.includes('def custom_loss') ? 5 : 0;

    return Math.max(1, complexity);
  }
}
