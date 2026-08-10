import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useSetupSteps } from '~/app/(setup)/steps/_layout'
import { appConfig } from '~/config/app'
import { ScrollView } from '~/modules/common/styled'
import * as Linking from 'expo-linking'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import * as z from 'zod'

import { Trans, useTranslation } from '@libs/i18n'
import { Button, Checkbox, Field, FieldLabel, Text } from '@libs/ui-native'

export default function RequiredStep() {
  const { t } = useTranslation(['common', 'marketing'])
  const { goNext } = useSetupSteps()

  const form = useForm({
    resolver: standardSchemaResolver(
      z.object({
        data: z.boolean(),
        privacy: z.boolean()
      })
    ),
    defaultValues: {
      data: false,
      privacy: false
    }
  })

  const values = form.watch()

  return (
    <>
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} className="py-4">
        <View className="items-start gap-6">
          <View className="items-start gap-1">
            <Text className="font-sans-bold text-3xl tracking-tight">{t('setup.steps.step.required.title')}</Text>
            <Text className="text-muted-foreground leading-snug">{t('setup.steps.step.required.description')}</Text>
          </View>

          <View className="w-full gap-2">
            <Controller
              control={form.control}
              name="data"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox {...field} checked={!!field.value} onCheckedChange={field.onChange} />
                  <FieldLabel onPress={() => field.onChange(!field.value)}>
                    {t('setup.steps.step.required.fields.data')}
                  </FieldLabel>
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="privacy"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox checked={!!field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
                  <FieldLabel onPress={() => field.onChange(!field.value)}>
                    <Trans
                      i18nKey="setup.steps.step.required.fields.privacy"
                      ns="marketing"
                      components={{
                        a: (
                          <Text
                            onPress={() => Linking.openURL(`${appConfig.url}/legal/privacy-policy`)}
                            className="font-sans-medium text-primary text-sm underline hover:no-underline"
                          />
                        )
                      }}
                    />
                  </FieldLabel>
                </Field>
              )}
            />
          </View>
        </View>
      </ScrollView>

      <Button
        className="mt-auto"
        size="lg"
        onPress={() => goNext()}
        disabled={Object.values(values).some(value => !value)}
      >
        <Text>{t('continue')}</Text>
      </Button>
    </>
  )
}
