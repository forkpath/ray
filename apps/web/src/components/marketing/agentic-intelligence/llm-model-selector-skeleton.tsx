import { motion } from 'motion/react'

import { cn } from '@libs/ui-core'

import { DivideX } from '~/components/marketing/divide'
import { IntegrationsLogo } from '~/components/marketing/icons/bento-icons'
import { AnthropicLogo, MetaLogo, OpenAILogo } from '~/components/marketing/icons/general'

/* 核心功能骨架屏动画 */
export const LLMModelSelectorSkeleton = () => {
  const models = [
    {
      name: 'Claude 4 Opus',
      logo: AnthropicLogo,
      status: 'Unavailable',
      variant: 'danger'
    },
    {
      name: 'ChatGPT',
      logo: OpenAILogo,
      status: 'Connected',
      variant: 'success'
    },
    {
      name: 'Llama 3.2',
      logo: MetaLogo,
      status: 'Waiting',
      variant: 'warning'
    }
  ]
  return (
    <motion.div className="relative mx-auto mt-20 h-full max-h-70 min-h-40 w-[85%] rounded-2xl border-t border-gray-300 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 1.5 }}
        className="shadow-aceternity absolute -top-10 -right-10 z-20 flex w-40 shrink-0 flex-col items-start rounded-lg bg-white text-xs dark:bg-neutral-900"
      >
        <div className="flex w-full items-center justify-between p-2">
          <div className="flex items-center gap-2 font-medium">
            <OpenAILogo />
            Open AI
          </div>
          <p className="font-mono text-gray-600">GPT 5</p>
        </div>
        <DivideX />
        <div className="m-2 rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-blue-500 dark:bg-blue-50/10">
          Connected
        </div>
      </motion.div>
      <div className="mb-4 flex gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500"></div>
        <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
        <div className="h-3 w-3 rounded-full bg-green-500"></div>
      </div>
      <div className="mt-12 flex items-center gap-2">
        <IntegrationsLogo />
        <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">All Models</span>
        <span className="text-charcoal-700 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
          69,420
        </span>
      </div>
      <DivideX className="mt-2" />
      {models.map((model, index) => (
        <div className="relative" key={model.name + index}>
          <motion.div
            key={model.name + index}
            className="mt-4 flex items-center justify-between gap-2"
            initial={{ clipPath: 'inset(0 100% 0 0)', filter: 'blur(10px)' }}
            whileInView={{ clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)' }}
            viewport={{ once: true }}
            transition={{
              duration: 1,
              delay: index * 1,
              ease: 'easeInOut'
            }}
          >
            <div className="flex items-center gap-2">
              <model.logo className="h-4 w-4 shrink-0" />
              <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">{model.name}</span>
            </div>

            <div
              className={cn(
                'rounded-sm border px-2 py-0.5 text-xs',
                model.variant === 'success' &&
                  'border-emerald-500 bg-emerald-50 text-emerald-500 dark:bg-emerald-50/10',
                model.variant === 'warning' && 'border-yellow-500 bg-yellow-50 text-yellow-500 dark:bg-yellow-50/10',
                model.variant === 'danger' && 'border-red-500 bg-red-50 text-red-500 dark:bg-red-50/10'
              )}
            >
              {model.status}
            </div>
          </motion.div>
          <motion.div
            initial={{
              left: 0,
              opacity: 0
            }}
            whileInView={{
              left: '100%',
              opacity: [0, 1, 1, 1, 0]
            }}
            viewport={{ once: true }}
            transition={{
              left: {
                duration: 1,
                delay: index * 1,
                ease: 'easeInOut'
              },
              opacity: {
                duration: 1,
                delay: index * 1,
                ease: 'easeInOut'
              }
            }}
            className="absolute inset-y-0 left-0 h-full w-[2px] bg-gradient-to-t from-transparent via-blue-500 to-transparent"
          >
            {Array.from({ length: 8 }).map((_, sparkleIndex) => {
              const randomX = Math.random() * 100 - 50
              const randomY = Math.random() * 100 - 50
              const randomDelay = Math.random() * 0.8
              const randomDuration = 0.5 + Math.random() * 1
              const randomScale = 0.5 + Math.random() * 0.5

              return (
                <motion.div
                  key={sparkleIndex}
                  initial={{
                    opacity: 0,
                    scale: 0,
                    x: 0,
                    y: 0
                  }}
                  whileInView={{
                    opacity: [0, 1, 0],
                    scale: [0, randomScale, 0],
                    x: randomX,
                    y: randomY,
                    rotate: [0, 360]
                  }}
                  viewport={{ once: true }}
                  transition={{
                    duration: randomDuration,
                    delay: index * 1 + randomDelay,
                    ease: 'easeOut'
                  }}
                  className="absolute top-1/2 left-1/2 h-1 w-1 text-xs text-blue-400"
                >
                  <span role="img" aria-label="sparkle">
                    ✨
                  </span>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      ))}
    </motion.div>
  )
}
