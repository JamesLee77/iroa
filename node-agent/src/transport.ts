import type { ControlApiTransport } from './enrollment.js';

export class FetchControlApiTransport implements ControlApiTransport {
  private readonly baseUrl: URL;

  constructor(baseUrl: string, private readonly defaultHeaders: Readonly<Record<string, string>> = {}) {
    this.baseUrl = new URL(baseUrl);
    if (this.baseUrl.protocol !== 'https:' && this.baseUrl.hostname !== '127.0.0.1' && this.baseUrl.hostname !== 'localhost') {
      throw new Error('CONTROL_API_HTTPS_REQUIRED');
    }
  }

  async post<T>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    options?: { headers?: Readonly<Record<string, string>> },
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('CONTROL_API_PATH_INVALID');
    const response = await fetch(new URL(path, this.baseUrl), {
      method: 'POST',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        ...this.defaultHeaders,
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`CONTROL_API_REJECTED_${response.status}`);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
