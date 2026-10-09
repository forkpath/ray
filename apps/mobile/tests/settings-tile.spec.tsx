import { render, screen, userEvent } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import { SettingsTile } from '~/modules/common/settings-tile'

// The visual library loads optional native drawing modules. Keep its visual
// boundary small here; the application component and native Pressable are real.
jest.mock('@libs/ui-native', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const Native = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    TextClassContext: React.createContext(''),
    Spin: React.Fragment,
    Icons: { Loader2: Native.View, ChevronRight: Native.View }
  }
})

describe('SettingsTile', () => {
  it('invokes the action when pressed', async () => {
    const onPress = jest.fn()
    await render(
      <SettingsTile icon={View} onPress={onPress}>
        <Text>Account</Text>
      </SettingsTile>
    )
    await userEvent.setup().press(screen.getByRole('button', { name: 'Account' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('prevents the action while disabled', async () => {
    const onPress = jest.fn()
    await render(
      <SettingsTile icon={View} onPress={onPress} disabled>
        <Text>Account</Text>
      </SettingsTile>
    )
    expect(screen.getByRole('button', { name: 'Account' })).toBeDisabled()
    await userEvent.setup().press(screen.getByRole('button', { name: 'Account' }))
    expect(onPress).not.toHaveBeenCalled()
  })
})
