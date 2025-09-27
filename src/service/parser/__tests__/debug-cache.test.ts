import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';

describe('Debug Cache', () => {
  let service: TreeSitterCoreService;

  beforeEach(() => {
    service = new TreeSitterCoreService();
  });

  it('should debug caching', async () => {
    const code = `function test() {
      return 'hello';
    }`;

    console.log('First parse');
    const result1 = await service.parseCode(code, 'javascript');
    console.log('Result1 success:', result1.success);
    console.log('Result1 fromCache:', result1.fromCache);
    console.log('Result1 error:', result1.error);

    console.log('Second parse');
    const result2 = await service.parseCode(code, 'javascript');
    console.log('Result2 success:', result2.success);
    console.log('Result2 fromCache:', result2.fromCache);
    console.log('Result2 error:', result2.error);

    console.log('Cache stats:', service.getCacheStats());
  });
});
