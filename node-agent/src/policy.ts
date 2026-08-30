import { isIP } from 'node:net';
import { z } from 'zod';

export const ExecutorIdSchema = z.enum([
  'public-information',
  'mock-availability',
  'easy-language',
]);

export type ExecutorId = z.infer<typeof ExecutorIdSchema>;

export const EXECUTOR_TIMEOUT_MS = 30_000;
export const EXECUTOR_RESPONSE_LIMIT_BYTES = 2 * 1024 * 1024;

export interface ExecutorNetworkPolicy {
  readonly allowedHostnames: readonly string[];
  readonly timeoutMs: number;
  readonly responseLimitBytes: number;
}

export const EXECUTOR_NETWORK_POLICIES: Readonly<Record<ExecutorId, ExecutorNetworkPolicy>> = {
  'public-information': {
    allowedHostnames: ['api.open-meteo.com', 'ko.wikipedia.org'],
    timeoutMs: EXECUTOR_TIMEOUT_MS,
    responseLimitBytes: EXECUTOR_RESPONSE_LIMIT_BYTES,
  },
  'mock-availability': {
    allowedHostnames: [],
    timeoutMs: EXECUTOR_TIMEOUT_MS,
    responseLimitBytes: EXECUTOR_RESPONSE_LIMIT_BYTES,
  },
  'easy-language': {
    allowedHostnames: [],
    timeoutMs: EXECUTOR_TIMEOUT_MS,
    responseLimitBytes: EXECUTOR_RESPONSE_LIMIT_BYTES,
  },
};

export class ExecutorPolicyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ExecutorPolicyError';
  }
}

export interface ExecutorContext {
  readonly scratchDirectory: string;
  readonly signal: AbortSignal;
  readonly fetchImplementation: typeof fetch | undefined;
}

export interface SyntheticExecutor {
  readonly id: ExecutorId;
  execute(input: unknown, context: ExecutorContext): Promise<unknown>;
}

export interface BoundedResponse {
  readonly url: URL;
  readonly status: number;
  readonly contentType: string;
  readonly body: Uint8Array;
}

function allowedNetworkUrl(executorId: ExecutorId, value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExecutorPolicyError('EXECUTOR_URL_INVALID');
  }

  const hostname = url.hostname.toLowerCase();
  const policy = EXECUTOR_NETWORK_POLICIES[executorId];
  if (url.protocol !== 'https:') throw new ExecutorPolicyError('EXECUTOR_HTTPS_REQUIRED');
  if (url.username || url.password) throw new ExecutorPolicyError('EXECUTOR_URL_CREDENTIALS_FORBIDDEN');
  if (url.port && url.port !== '443') throw new ExecutorPolicyError('EXECUTOR_PORT_FORBIDDEN');
  if (isIP(hostname) !== 0 || hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new ExecutorPolicyError('EXECUTOR_HOST_FORBIDDEN');
  }
  if (!policy.allowedHostnames.includes(hostname)) {
    throw new ExecutorPolicyError('EXECUTOR_HOST_NOT_ALLOWLISTED');
  }
  return url;
}

export async function boundedFetch(input: {
  executorId: ExecutorId;
  url: string;
  signal: AbortSignal;
  fetchImplementation: typeof fetch | undefined;
}): Promise<BoundedResponse> {
  const url = allowedNetworkUrl(input.executorId, input.url);
  const policy = EXECUTOR_NETWORK_POLICIES[input.executorId];
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(input.signal.reason);
  if (input.signal.aborted) abortFromCaller();
  else input.signal.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new ExecutorPolicyError('EXECUTOR_TIMEOUT'));
  }, policy.timeoutMs);
  timer.unref?.();

  try {
    const response = await (input.fetchImplementation ?? fetch)(url, {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: { accept: 'application/json, text/plain;q=0.9' },
    });
    if (!response.ok) throw new ExecutorPolicyError('EXECUTOR_UPSTREAM_REJECTED');

    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null) {
      const length = Number(declaredLength);
      if (!Number.isSafeInteger(length) || length < 0 || length > policy.responseLimitBytes) {
        throw new ExecutorPolicyError('EXECUTOR_RESPONSE_LIMIT_EXCEEDED');
      }
    }

    if (!response.body) {
      return {
        url,
        status: response.status,
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        body: new Uint8Array(),
      };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > policy.responseLimitBytes) {
        await reader.cancel('response limit exceeded');
        throw new ExecutorPolicyError('EXECUTOR_RESPONSE_LIMIT_EXCEEDED');
      }
      chunks.push(value);
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return {
      url,
      status: response.status,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
      body,
    };
  } catch (error) {
    if (timedOut) throw new ExecutorPolicyError('EXECUTOR_TIMEOUT');
    if (input.signal.aborted) throw new ExecutorPolicyError('TASK_CANCELLED');
    throw error;
  } finally {
    clearTimeout(timer);
    input.signal.removeEventListener('abort', abortFromCaller);
  }
}
