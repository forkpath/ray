import { browser } from 'wxt/browser'

import { appConfig } from '~/config/app'
import { Layout, render } from '~/modules/common/layout/layout'
import { Main } from '~/modules/common/main'

browser.devtools.panels.create(appConfig.name, 'icons/128.png', 'devtools.html')

browser.devtools.panels.elements.createSidebarPane(appConfig.name, sidebar =>
  sidebar.setObject({
    name: 'DevTools'
  })
)

const DevTools = () => {
  return (
    <Layout>
      <Main filename="app/devtools" />
    </Layout>
  )
}

render('root', <DevTools />)
