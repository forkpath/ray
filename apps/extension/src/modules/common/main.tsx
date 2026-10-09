import { useQuery } from '@tanstack/react-query'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import { Icons, Skeleton } from '@libs/ui-web'

import { appConfig } from '~/config/app'
import { Message, sendMessage } from '~/lib/messaging'

interface MainProps {
  readonly className?: string
  readonly filename: string
}

export const Main = ({ className, filename }: MainProps) => {
  const { t, i18n } = useTranslation('common')
  const { data } = useQuery({
    queryKey: [Message.HELLO, filename, i18n.language],
    queryFn: () => sendMessage(Message.HELLO, filename)
  })

  return (
    <main className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <Icons.Logo className="text-primary w-20 animate-pulse" />
      {data ? (
        <p
          className="text-center leading-tight text-pretty"
          dangerouslySetInnerHTML={{
            __html: data.replace(
              '<code>',
              "<code class='inline-block rounded-sm bg-muted px-1.5 text-sm text-muted-foreground'>"
            )
          }}
        />
      ) : (
        <Skeleton className="h-5 w-64" />
      )}
      <a
        href={`${appConfig.url}/docs`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary cursor-pointer text-sm underline underline-offset-4 hover:no-underline"
      >
        {t('learnMore')}
      </a>
    </main>
  )
}
