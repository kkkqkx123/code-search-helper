import { LSPErrorHandler } from '../LSPErrorHandler';

describe('LSPErrorHandler', () => {
  let errorHandler: LSPErrorHandler;

  beforeEach(() => {
    errorHandler = new LSPErrorHandler();
  });

  it('should create LSPErrorHandler instance', () => {
    expect(errorHandler).toBeInstanceOf(LSPErrorHandler);
  });

  it('should handle errors gracefully', () => {
    const error = new Error('Test error');
    const context = {
      error,
      workspaceRoot: '/test/workspace',
      language: 'typescript',
      type: 'connection' as const,
      timestamp: new Date(),
    };

    expect(() => {
      errorHandler.handleError(context);
    }).not.toThrow();
  });

  it('should track error metrics', () => {
    const error = new Error('Test error');
    const context = {
      error,
      workspaceRoot: '/test/workspace',
      language: 'typescript',
      type: 'connection' as const,
      timestamp: new Date(),
    };

    errorHandler.handleError(context);

    const metrics = errorHandler.getMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics.totalErrors).toBe('number');
  });

  it('should reset metrics', () => {
    const error = new Error('Test error');
    const context = {
      error,
      workspaceRoot: '/test/workspace',
      language: 'typescript',
      type: 'connection' as const,
      timestamp: new Date(),
    };

    errorHandler.handleError(context);
    errorHandler.resetMetrics();

    const metrics = errorHandler.getMetrics();
    expect(metrics.totalErrors).toBe(0);
  });
});
