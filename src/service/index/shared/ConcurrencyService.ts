import { injectable } from 'inversify';

@injectable()
export class ConcurrencyService {
  /**
   * 并发处理任务
   */
  async processWithConcurrency<T>(promises: Promise<T>[], maxConcurrency: number): Promise<void> {
    const results: Promise<T>[] = [];
    const executing: Set<Promise<T>> = new Set();

    for (const promise of promises) {
      if (executing.size >= maxConcurrency) {
        await Promise.race(executing);
      }

      const p = promise.then(result => {
        executing.delete(p);
        return result;
      });

      executing.add(p);
      results.push(p);
    }

    await Promise.all(results);
  }
}