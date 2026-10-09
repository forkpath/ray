import { useEffect, useState } from 'react'

import { motion } from 'motion/react'

import { DivideX } from '~/components/marketing/divide'
import { IntegrationsLogo } from '~/components/marketing/icons/bento-icons'
import { AnthropicLogo, OpenAILogo } from '~/components/marketing/icons/general'
import { LogoSVG } from '~/components/marketing/logo'
import { Scale } from '~/components/marketing/scale'

export const ConnectYourTooklsSkeleton = () => {
  const text = `Write the first and second rule of it using Claude and ChatGPT.`
  const [mounted, setMounted] = useState(false)
  // 仅在客户端挂载后渲染，随机值不参与 SSR 输出
  const [randomWidth] = useState(() => Math.random() * 100)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative flex h-full w-full items-center justify-between">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative h-70 w-60 -translate-x-2 rounded-2xl border-t border-gray-300 bg-white p-4 shadow-2xl md:translate-x-0 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="absolute -top-4 -right-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white shadow-xl">
          <Scale />
          <OpenAILogo className="relative z-20 h-8 w-8" />
        </div>
        <div className="mt-12 flex items-center gap-2">
          <IntegrationsLogo />
          <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">Tasks</span>
        </div>
        <DivideX className="mt-2" />

        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-charcoal-700 text-[10px] leading-loose font-normal md:text-xs dark:text-neutral-200">
              {text.split(/(\s+)/).map((word, index) => (
                <motion.span
                  key={index}
                  initial={{
                    opacity: 0
                  }}
                  animate={{
                    opacity: 1
                  }}
                  transition={{
                    duration: 0.2,
                    delay: index * 0.02,
                    ease: 'linear'
                  }}
                  className="inline-block"
                >
                  {word === ' ' ? '\u00A0' : word}
                </motion.span>
              ))}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-col">
          {[...Array(2)].map((_, index) => (
            <motion.div
              key={`width-bar-right-${index}`}
              initial={{
                width: '0%'
              }}
              animate={{
                width: `${randomWidth}%`
              }}
              transition={{
                duration: 4,
                delay: index * 0.2,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="mt-2 h-4 w-full rounded-full bg-gray-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1 }}
        className="absolute inset-x-0 z-30 hidden items-center justify-center md:flex"
      >
        <div className="size-3 rounded-full border-2 border-blue-500 bg-white dark:bg-neutral-800" />
        <div className="h-[2px] w-38 bg-blue-500" />
        <div className="size-3 rounded-full border-2 border-blue-500 bg-white dark:bg-neutral-800" />
      </motion.div>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
        className="relative h-70 w-60 translate-x-10 rounded-2xl border-t border-gray-300 bg-white p-4 shadow-2xl md:translate-x-0 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="absolute -top-4 -left-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white shadow-xl dark:bg-neutral-800">
          <Scale />
          <LogoSVG className="relative z-20 h-8 w-8" />
        </div>
        <div className="mt-12 flex items-center gap-2">
          <IntegrationsLogo className="dark:text-neutral-200" />
          <span className="text-charcoal-700 text-xs font-medium md:text-sm dark:text-neutral-200">Integrations</span>
          <span className="text-charcoal-700 rounded-lg border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
            200
          </span>
        </div>
        <DivideX className="mt-2" />
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <OpenAILogo className="h-4 w-4 shrink-0" />
            <span className="text-charcoal-700 text-xs font-medium md:text-sm dark:text-neutral-200">ChatGPT</span>
          </div>

          <div className="rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs text-blue-500">
            Connected
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AnthropicLogo className="h-4 w-4 shrink-0" />
            <span className="text-charcoal-700 text-xs font-medium md:text-sm dark:text-neutral-200">
              Claude 4 Opus
            </span>
          </div>

          <div className="rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs text-blue-500">
            Connected
          </div>
        </div>
        <div className="mt-2 flex flex-col">
          {[...Array(3)].map((_, index) => (
            <motion.div
              key={`width-bar-right-${index}`}
              initial={{
                width: `${20 + Math.random() * 20}%`
              }}
              animate={{
                width: `${70 + Math.random() * 30}%`
              }}
              transition={{
                duration: 4,
                delay: index * 0.2,
                ease: 'easeInOut',
                repeat: Infinity,
                repeatType: 'reverse'
              }}
              className="mt-2 h-4 w-full rounded-full bg-gray-200 dark:bg-neutral-800"
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
