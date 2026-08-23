import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { retryRequest } from './apiRetry'

describe('retryRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns the response immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue({ data: { ok: true } })
    const promise = retryRequest(fn)
    await vi.runAllTimersAsync()
    const res = await promise
    expect(res.data.ok).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries retryable server errors and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValueOnce({ data: { ok: true } })
    const promise = retryRequest(fn, { initialDelay: 10 })
    await vi.advanceTimersByTimeAsync(500)
    const res = await promise
    expect(res.data.ok).toBe(true)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry client errors like 404', async () => {
    const err = { response: { status: 404 } }
    const fn = vi.fn().mockRejectedValue(err)
    await expect(retryRequest(fn)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry auth failures like 401', async () => {
    const err = { response: { status: 401 } }
    const fn = vi.fn().mockRejectedValue(err)
    await expect(retryRequest(fn)).rejects.toBe(err)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('gives up after max retries on persistent network errors', async () => {
    const err = { code: 'ECONNABORTED' }
    const fn = vi.fn().mockRejectedValue(err)
    const promise = retryRequest(fn, { maxRetries: 2, initialDelay: 5 })
    promise.catch(() => {})
    await vi.runAllTimersAsync()
    await expect(promise).rejects.toBe(err)
    // initial attempt + 2 retries
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
