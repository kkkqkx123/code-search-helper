import { LSPManager } from '../LSPManager';

describe('LSPManager', () => {
  it('should create LSPManager instance', () => {
    const manager = new LSPManager();
    expect(manager).toBeInstanceOf(LSPManager);
  });

  it('should be a singleton', () => {
    const instance1 = LSPManager.getInstance();
    const instance2 = LSPManager.getInstance();
    expect(instance1).toBe(instance2);
  });
});
