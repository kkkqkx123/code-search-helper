import { LanguageServerRegistry } from '../LanguageServerRegistry';

describe('LanguageServerRegistry', () => {
  beforeEach(() => {
    // Reset singleton instance
    (LanguageServerRegistry as any).instance = null;
  });

  it('should create LanguageServerRegistry instance', () => {
    const registry = LanguageServerRegistry.getInstance();
    expect(registry).toBeInstanceOf(LanguageServerRegistry);
  });

  it('should be a singleton', () => {
    const instance1 = LanguageServerRegistry.getInstance();
    const instance2 = LanguageServerRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should validate server configuration', () => {
    const registry = LanguageServerRegistry.getInstance();

    const validConfig = {
      command: 'typescript-language-server',
      args: ['--stdio'],
      extensions: ['.ts', '.js'],
      configFiles: ['tsconfig.json'],
    };

    expect(registry.validateServerConfig(validConfig)).toBe(true);
  });

  it('should reject invalid server configuration', () => {
    const registry = LanguageServerRegistry.getInstance();

    const invalidConfig = {
      command: '',
      args: ['--stdio'],
      extensions: ['.ts'],
      configFiles: ['tsconfig.json'],
    };

    expect(registry.validateServerConfig(invalidConfig)).toBe(false);
  });
});
