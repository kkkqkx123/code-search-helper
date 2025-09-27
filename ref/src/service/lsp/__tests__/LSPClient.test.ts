import { LSPClient } from '../LSPClient';

describe('LSPClient', () => {
  it('should create LSPClient instance', () => {
    const client = new LSPClient({
      command: 'test-command',
      workspaceRoot: '/test/workspace',
    });

    expect(client).toBeInstanceOf(LSPClient);
  });

  it('should store configuration correctly', () => {
    const config = {
      command: 'test-command',
      args: ['--stdio'],
      workspaceRoot: '/test/workspace',
      timeout: 5000,
    };

    const client = new LSPClient(config);

    // @ts-ignore - accessing private property for testing
    expect(client.config).toEqual(config);
  });
});
