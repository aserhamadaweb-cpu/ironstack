import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import {
  LegalDocument,
  LegalEmailLink,
  LegalList,
  LegalSection,
} from '@/components/legal-document'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function PrivacyPage() {
  const t = await getTranslations('legal.privacy')

  return (
    <LegalDocument title={t('title')} updated={t('updated')}>
      <LegalSection number={1} title={t('s1Title')}>
        <LegalList>
          <li>{t('s1Item1')}</li>
          <li>{t('s1Item2')}</li>
          <li>{t('s1Item3')}</li>
          <li>{t('s1Item4')}</li>
          <li>{t('s1Item5')}</li>
          <li>{t('s1Item6')}</li>
        </LegalList>
      </LegalSection>

      <LegalSection number={2} title={t('s2Title')}>
        <LegalList>
          <li>{t('s2Item1')}</li>
          <li>{t('s2Item2')}</li>
          <li>{t('s2Item3')}</li>
        </LegalList>
        <p>{t('s2Outro')}</p>
      </LegalSection>

      <LegalSection number={3} title={t('s3Title')}>
        <LegalList>
          <li>{t('s3Item1')}</li>
          <li>{t('s3Item2')}</li>
          <li>{t('s3Item3')}</li>
        </LegalList>
      </LegalSection>

      <LegalSection number={4} title={t('s4Title')}>
        <p>{t('s4Body')}</p>
      </LegalSection>

      <LegalSection number={5} title={t('s5Title')}>
        <p>{t('s5Intro')}</p>
        <LegalList>
          <li>{t('s5Item1')}</li>
          <li>{t('s5Item2')}</li>
          <li>{t('s5Item3')}</li>
          <li>{t('s5Item4')}</li>
        </LegalList>
      </LegalSection>

      <LegalSection number={6} title={t('s6Title')}>
        <p>{t('s6Body')}</p>
      </LegalSection>

      <LegalSection number={7} title={t('s7Title')}>
        <p>{t('s7Body')}</p>
      </LegalSection>

      <LegalSection number={8} title={t('s8Title')}>
        <p>
          {t.rich('s8Body', {
            email: () => <LegalEmailLink />,
          })}
        </p>
      </LegalSection>
    </LegalDocument>
  )
}
