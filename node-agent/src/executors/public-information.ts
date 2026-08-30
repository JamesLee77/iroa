import { z } from 'zod';
import { boundedFetch, type SyntheticExecutor } from '../policy.js';

const PublicInformationInputSchema = z.object({
  url: z.string().url().max(2_048),
  format: z.enum(['json', 'text']),
}).strict();

const decoder = new TextDecoder('utf-8', { fatal: true });

export const publicInformationExecutor: SyntheticExecutor = {
  id: 'public-information',
  async execute(input, context) {
    const request = PublicInformationInputSchema.parse(input);
    const response = await boundedFetch({
      executorId: this.id,
      url: request.url,
      signal: context.signal,
      fetchImplementation: context.fetchImplementation,
    });
    const text = decoder.decode(response.body);
    const source = `${response.url.origin}${response.url.pathname}`;
    if (request.format === 'json') {
      return {
        source,
        contentType: response.contentType,
        data: JSON.parse(text) as unknown,
      };
    }
    return { source, contentType: response.contentType, text };
  },
};
