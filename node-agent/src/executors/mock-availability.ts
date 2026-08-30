import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SyntheticExecutor } from '../policy.js';

const MockAvailabilityInputSchema = z.object({
  service: z.string().trim().min(1).max(80),
  location: z.string().trim().min(1).max(80),
  date: z.iso.date(),
}).strict();

function slotSeed(...parts: string[]): number {
  return createHash('sha256').update(parts.join('\u0000')).digest().readUInt32BE(0);
}

export const mockAvailabilityExecutor: SyntheticExecutor = {
  id: 'mock-availability',
  async execute(input, context) {
    const request = MockAvailabilityInputSchema.parse(input);
    if (context.signal.aborted) throw new Error('TASK_CANCELLED');
    const seed = slotSeed(request.service, request.location, request.date);
    const hours = [9, 11, 14, 16];
    const slots = hours
      .filter((_, index) => ((seed >> index) & 1) === 1)
      .map((hour) => `${request.date}T${String(hour).padStart(2, '0')}:00:00+09:00`);
    return {
      simulation: true,
      service: request.service,
      location: request.location,
      date: request.date,
      available: slots.length > 0,
      slots,
    };
  },
};
