import { describe, it, expect } from 'vitest';
import { PromiseCoalescer } from '../../src/PromiseCoalescer.js';

describe('PromiseCoalescer', () => {
  it('creates a new promise on first acquire()', () => {
    const coalescer = new PromiseCoalescer();
    const result = coalescer.acquire();

    expect(result.isFirst).toBe(true);
    expect(result.promise).toBeInstanceOf(Promise);
    expect(typeof result.resolve).toBe('function');
    expect(typeof result.reject).toBe('function');
  });

  it('returns the same promise on subsequent acquire() calls', () => {
    const coalescer = new PromiseCoalescer();
    const first = coalescer.acquire();
    const second = coalescer.acquire();

    expect(second.isFirst).toBe(false);
    expect(second.promise).toBe(first.promise);
  });

  it('isPending() returns false initially', () => {
    const coalescer = new PromiseCoalescer();
    expect(coalescer.isPending()).toBe(false);
  });

  it('isPending() returns true after acquire()', () => {
    const coalescer = new PromiseCoalescer();
    coalescer.acquire();
    expect(coalescer.isPending()).toBe(true);
  });

  it('isPending() returns false after resolve()', async () => {
    const coalescer = new PromiseCoalescer();
    const { resolve, promise } = coalescer.acquire();
    resolve('done');
    await promise;
    expect(coalescer.isPending()).toBe(false);
  });

  it('resolve() delivers the value to all waiters', async () => {
    const coalescer = new PromiseCoalescer();
    const first = coalescer.acquire();
    const second = coalescer.acquire();

    first.resolve('hello');

    expect(await first.promise).toBe('hello');
    expect(await second.promise).toBe('hello');
  });

  it('reject() delivers the error to all waiters', async () => {
    const coalescer = new PromiseCoalescer();
    const first = coalescer.acquire();
    const second = coalescer.acquire();

    const error = new Error('test error');
    first.reject(error);

    await expect(first.promise).rejects.toThrow('test error');
    await expect(second.promise).rejects.toThrow('test error');
  });

  it('creates a new promise after previous one resolves', async () => {
    const coalescer = new PromiseCoalescer();

    const first = coalescer.acquire();
    first.resolve('first');
    await first.promise;

    const second = coalescer.acquire();
    expect(second.isFirst).toBe(true);
    expect(second.promise).not.toBe(first.promise);
  });

  it('creates a new promise after previous one rejects', async () => {
    const coalescer = new PromiseCoalescer();

    const first = coalescer.acquire();
    first.reject(new Error('fail'));
    await first.promise.catch(() => {}); // consume the rejection

    const second = coalescer.acquire();
    expect(second.isFirst).toBe(true);
    expect(second.promise).not.toBe(first.promise);
  });

  it('clear() resets the pending state', () => {
    const coalescer = new PromiseCoalescer();
    coalescer.acquire();
    expect(coalescer.isPending()).toBe(true);

    coalescer.clear();
    expect(coalescer.isPending()).toBe(false);
  });

  it('clear() causes next acquire() to create a new promise', () => {
    const coalescer = new PromiseCoalescer();
    const first = coalescer.acquire();
    coalescer.clear();

    const second = coalescer.acquire();
    expect(second.isFirst).toBe(true);
    expect(second.promise).not.toBe(first.promise);
  });
});
