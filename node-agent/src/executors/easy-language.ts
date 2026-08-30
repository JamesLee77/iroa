import { z } from 'zod';
import type { SyntheticExecutor } from '../policy.js';

const EasyLanguageInputSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  language: z.literal('ko'),
}).strict();

const FRIENDLY_TERMS = [
  ['신청인', '신청하는 분'],
  ['대상자', '도움을 받는 분'],
  ['구비서류', '준비할 서류'],
  ['해당 기관', '이 기관'],
  ['방문하여', '방문해서'],
  ['문의하시기 바랍니다', '문의해 주세요'],
  ['제출하시기 바랍니다', '제출해 주세요'],
] as const;

export const easyLanguageExecutor: SyntheticExecutor = {
  id: 'easy-language',
  async execute(input, context) {
    const request = EasyLanguageInputSchema.parse(input);
    if (context.signal.aborted) throw new Error('TASK_CANCELLED');
    let text = request.text;
    for (const [formal, friendly] of FRIENDLY_TERMS) text = text.replaceAll(formal, friendly);
    text = text.replace(/([.!?])\s*/g, '$1\n').replace(/\n{2,}/g, '\n').trim();
    return {
      language: request.language,
      originalLength: request.text.length,
      text,
      substitutions: FRIENDLY_TERMS.filter(([formal]) => request.text.includes(formal)).length,
    };
  },
};
