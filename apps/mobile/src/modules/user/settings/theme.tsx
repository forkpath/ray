import type { ThemeConfig } from '@libs/ui-core'

import { appConfig } from '~/config/app'
import { useTheme } from '~/modules/common/hooks/use-theme'
import { SettingsTile } from '~/modules/common/settings-tile'
import { View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import {
  BottomSheet,
  BottomSheetCloseTrigger,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetOpenTrigger,
  BottomSheetTitle,
  BottomSheetView,
  Button,
  Icons,
  MODE_ICONS,
  Text,
  ThemeCustomizer
} from '@libs/ui-native'

export const ThemeSettings = () => {
  const { t } = useTranslation('common')
  const { config, setConfig, resolvedTheme } = useTheme()

  const onChange = (config: ThemeConfig) => {
    setConfig(config)
  }

  return (
    <BottomSheet>
      <BottomSheetOpenTrigger asChild>
        <SettingsTile icon={MODE_ICONS[config.mode]}>
          <Text>{t('theme.title')}</Text>

          <View className={cn('bg-primary flex size-4.5 shrink-0 items-center justify-center rounded-full')} />
        </SettingsTile>
      </BottomSheetOpenTrigger>
      <BottomSheetContent name="theme-settings">
        <BottomSheetView>
          <View className="flex-row items-start">
            <BottomSheetHeader>
              <BottomSheetTitle>{t('theme.customization.title')}</BottomSheetTitle>
              <BottomSheetDescription>{t('theme.customization.description')}</BottomSheetDescription>
            </BottomSheetHeader>

            <Button
              variant="ghost"
              size="icon"
              className="ml-auto rounded-[0.5rem]"
              onPress={() => onChange(appConfig.theme)}
            >
              <Icons.Undo2 className="text-foreground" width={20} height={20} />
            </Button>
          </View>

          <ThemeCustomizer config={config} onChange={onChange} resolvedTheme={resolvedTheme} />

          <BottomSheetCloseTrigger asChild>
            <Button>
              <Text>{t('save')}</Text>
            </Button>
          </BottomSheetCloseTrigger>
        </BottomSheetView>
      </BottomSheetContent>
    </BottomSheet>
  )
}
