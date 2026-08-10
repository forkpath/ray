import { memo, useCallback } from 'react'

import { useTranslation } from '@libs/i18n'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' }
] as const

export const LanguageSwitcher = memo(() => {
  const { t, i18n } = useTranslation(['common', 'auth'])

  const handleChange = useCallback(
    (value: string) => {
      void i18n.changeLanguage(value)
    },
    [i18n]
  )

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <SettingsCardTitle>{t('auth:account.language.title', { defaultValue: 'Language' })}</SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.language.description', { defaultValue: 'Choose your preferred language.' })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent>
        <Select value={i18n.language} onValueChange={handleChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(lang => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsCardContent>

      <SettingsCardFooter>
        {t('auth:account.language.info', { defaultValue: 'This changes the display language across the app.' })}
      </SettingsCardFooter>
    </SettingsCard>
  )
})

LanguageSwitcher.displayName = 'LanguageSwitcher'
