import type { PasswordPayload } from '@libs/auth-contract'
import type { BottomSheetContentRef } from '@libs/ui-native'

import { useState } from 'react'

import { Alert, Share, View } from 'react-native'

import { logger } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import {
  BottomSheet,
  BottomSheetCloseTrigger,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetView,
  Button,
  Icons,
  Text,
  useBottomSheet
} from '@libs/ui-native'

import { useCopyToClipboard } from '~/modules/common/hooks/use-copy-to-clipboard'
import { RequirePassword } from '~/modules/user/settings/account/two-factor/require-password'
import { useTwoFactor } from '~/modules/user/settings/account/two-factor/use-two-factor'

import { useBackupCodes } from './use-backup-codes'

interface BackupCodesSheetProps {
  readonly ref?: React.RefObject<BottomSheetContentRef | null>
}

export const BackupCodesSheet = ({ ref: passedRef }: BackupCodesSheetProps) => {
  const { t } = useTranslation(['common', 'auth'])
  const { ref: bottomSheetRef } = useBottomSheet()
  const ref = passedRef ?? bottomSheetRef

  const { codes } = useBackupCodes()

  return (
    <BottomSheet>
      <BottomSheetContent ref={ref} name="backup-codes">
        <BottomSheetView>
          <BottomSheetHeader>
            <BottomSheetTitle>{t('account.twoFactor.backupCodes.save.title')}</BottomSheetTitle>
            <BottomSheetDescription>{t('account.twoFactor.backupCodes.save.description')}</BottomSheetDescription>
          </BottomSheetHeader>

          <View className="flex-1 gap-6">
            <View className="border-border w-full rounded-md border">
              <View className="border-border bg-muted/25 flex-row flex-wrap border-b py-1">
                {codes.map(code => (
                  <View key={code} className="w-1/2 items-center justify-center rounded p-1.5">
                    <Text className="text-center font-mono text-sm">{code}</Text>
                  </View>
                ))}
              </View>

              <View className="flex-row justify-end p-2">
                <Download />
                <Copy />
              </View>
            </View>

            <BottomSheetCloseTrigger asChild>
              <Button className="mt-auto">
                <Text>{t('continue')}</Text>
              </Button>
            </BottomSheetCloseTrigger>
          </View>
        </BottomSheetView>
      </BottomSheetContent>
    </BottomSheet>
  )
}

const Copy = () => {
  const { t } = useTranslation('common')
  const [, copy] = useCopyToClipboard()
  const [showCheck, setShowCheck] = useState(false)

  const { codes } = useBackupCodes()

  const handleCopy = async () => {
    const success = await copy(codes.join('\n'))
    if (!success) {
      return
    }

    setShowCheck(true)
    setTimeout(() => {
      setShowCheck(false)
    }, 2000)
  }

  return (
    <Button variant="ghost" className="h-auto flex-row gap-2 px-3 py-1.5" onPress={handleCopy}>
      {showCheck ? (
        <Icons.Check size={16} className="text-foreground" />
      ) : (
        <Icons.Copy size={16} className="text-foreground" />
      )}
      <Text>{t('copy')}</Text>
    </Button>
  )
}

const Download = () => {
  const { t } = useTranslation('common')
  const { codes } = useBackupCodes()

  const handleDownload = async () => {
    try {
      await Share.share({
        message: codes.join('\n')
      })
    } catch (error) {
      logger.error(error)
      Alert.alert(t('error.general'))
    }
  }

  return (
    <Button variant="ghost" className="h-auto flex-row gap-2 px-3 py-1.5" onPress={handleDownload}>
      <Icons.Download size={16} className="text-foreground" />
      <Text>{t('download')}</Text>
    </Button>
  )
}

export const BackupCodesTile = () => {
  const { t } = useTranslation(['common', 'auth'])
  const { enabled } = useTwoFactor()
  const { generate } = useBackupCodes()
  const { ref } = useBottomSheet()

  return (
    <>
      <View className="border-border flex-row items-center justify-between gap-4 rounded-md border p-4">
        <View className="flex-1">
          <Text className="font-sans-medium text-sm">{t('account.twoFactor.backupCodes.title')}</Text>
          <Text className="text-muted-foreground text-sm">{t('account.twoFactor.backupCodes.description')}</Text>
        </View>

        <RequirePassword
          onConfirm={async (data: PasswordPayload) => {
            await generate.mutateAsync(data)
            ref.current?.present()
          }}
        >
          <Button variant="outline" disabled={!enabled}>
            <Text>{t('regenerate')}</Text>
          </Button>
        </RequirePassword>
      </View>

      <BackupCodesSheet ref={ref} />
    </>
  )
}
