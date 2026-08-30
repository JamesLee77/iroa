import type { TranslationKey } from './i18n';

export type FixtureId = 'public-information' | 'mock-availability' | 'easy-language';

export interface TaskFixture {
  id: FixtureId;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  capabilityScope: readonly string[];
  inputCiphertextRef: `iroa-blob://${string}`;
  expectedResultSchema: `iroa-schema://${string}`;
}

export const taskFixtures: readonly TaskFixture[] = [
  {
    id: 'public-information',
    titleKey: 'publicInfoTitle',
    descriptionKey: 'publicInfoDescription',
    capabilityScope: ['synthetic:public-information'],
    inputCiphertextRef: 'iroa-blob://synthetic/public-information-v1',
    expectedResultSchema: 'iroa-schema://synthetic/public-information-v1',
  },
  {
    id: 'mock-availability',
    titleKey: 'availabilityTitle',
    descriptionKey: 'availabilityDescription',
    capabilityScope: ['synthetic:mock-availability'],
    inputCiphertextRef: 'iroa-blob://synthetic/mock-availability-v1',
    expectedResultSchema: 'iroa-schema://synthetic/mock-availability-v1',
  },
  {
    id: 'easy-language',
    titleKey: 'easyLanguageTitle',
    descriptionKey: 'easyLanguageDescription',
    capabilityScope: ['synthetic:easy-language'],
    inputCiphertextRef: 'iroa-blob://synthetic/easy-language-v1',
    expectedResultSchema: 'iroa-schema://synthetic/easy-language-v1',
  },
] as const;

export function findFixtureByCapability(scope: readonly string[]): TaskFixture | undefined {
  return taskFixtures.find((fixture) => scope.includes(fixture.capabilityScope[0] ?? ''));
}
