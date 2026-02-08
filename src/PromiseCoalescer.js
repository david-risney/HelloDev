/**
 * Utility class that coalesces promise requests while a promise is still unsettled.
 * 
 * When multiple callers request the same operation concurrently, only the first request
 * creates a new promise. Subsequent requests receive the same promise until it settles.
 * Once settled, the next request will create a fresh promise.
 * 
 * Uses Promise.withResolvers() to give the caller control over resolution.
 * Create separate PromiseCoalescer instances for different operations.
 * 
 * @example
 * const authCoalescer = new PromiseCoalescer();
 * 
 * const { promise, resolve, reject, isFirst } = authCoalescer.acquire();
 * if (isFirst) {
 *   // This caller is responsible for settling the promise
 *   try {
 *     const result = await fetch('/api/data');
 *     resolve(result);
 *   } catch (err) {
 *     reject(err);
 *   }
 * }
 * // All callers await the same promise
 * const result = await promise;
 */
export class PromiseCoalescer {
  constructor() {
    /** @type {{ promise: Promise<any>, resolve: Function, reject: Function } | null} */
    this._pending = null;
  }

  /**
   * Acquire a promise, creating one if none exists.
   * 
   * @returns {{ promise: Promise<T>, resolve: (value: T) => void, reject: (reason: any) => void, isFirst: boolean }}
   *   - promise: The promise to await
   *   - resolve: Function to resolve the promise (only call if isFirst is true)
   *   - reject: Function to reject the promise (only call if isFirst is true)
   *   - isFirst: Whether this caller is responsible for settling the promise
   * @template T
   */
  acquire() {
    // If there's already a pending promise, return it
    if (this._pending) {
      return {
        promise: this._pending.promise,
        resolve: this._pending.resolve,
        reject: this._pending.reject,
        isFirst: false
      };
    }

    // Create a new promise using withResolvers
    const { promise, resolve, reject } = Promise.withResolvers();
    
    // Wrap resolve/reject to clean up when settled
    const wrappedResolve = (value) => {
      if (this._pending?.promise === promise) {
        this._pending = null;
      }
      resolve(value);
    };
    
    const wrappedReject = (reason) => {
      if (this._pending?.promise === promise) {
        this._pending = null;
      }
      reject(reason);
    };

    // Store the pending promise
    this._pending = { promise, resolve: wrappedResolve, reject: wrappedReject };

    return {
      promise,
      resolve: wrappedResolve,
      reject: wrappedReject,
      isFirst: true
    };
  }

  /**
   * Check if there's a pending promise.
   * @returns {boolean}
   */
  isPending() {
    return this._pending !== null;
  }

  /**
   * Clear the pending promise (useful for cancellation scenarios).
   */
  clear() {
    this._pending = null;
  }
}
