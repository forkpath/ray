import type { useMotionValue } from 'motion/react'

import { motion, useTransform } from 'motion/react'

import { cn } from '@libs/ui-core'

import { ForkIcon } from '~/components/marketing/icons/general'

/* 单个部署卡片的动画容器（将 useTransform 提取到组件级别以遵循 Hooks 规则） */
export const DeployCardMotion = ({
  y,
  index,
  offset,
  itemHeight,
  card
}: {
  y: ReturnType<typeof useMotionValue<number>>
  index: number
  offset: number
  itemHeight: number
  card: { variant?: 'default' | 'danger' | 'success' | 'warning'; title: string; subtitle: string; branch: string }
}) => {
  const scale = useTransform(
    y,
    [
      offset + (index - 2) * -itemHeight,
      offset + (index - 1) * -itemHeight,
      offset + index * -itemHeight,
      offset + (index + 1) * -itemHeight,
      offset + (index + 2) * -itemHeight
    ],
    [0.85, 0.95, 1.1, 0.95, 0.85]
  )
  const background = useTransform(
    y,
    [offset + (index - 1) * -itemHeight, offset + index * -itemHeight, offset + (index + 1) * -itemHeight],
    ['#FFFFFF', '#f17463', '#FFFFFF']
  )
  const borderColor = useTransform(
    y,
    [offset + (index - 1) * -itemHeight, offset + index * -itemHeight, offset + (index + 1) * -itemHeight],
    ['#FFFFFF', '#f17463', '#FFFFFF']
  )

  return (
    <motion.div
      className="mx-auto mt-4 w-full max-w-sm shrink-0 rounded-2xl shadow-xl"
      style={{ scale, background, borderColor }}
    >
      <DeployCard variant={card.variant} title={card.title} subtitle={card.subtitle} branch={card.branch} />
    </motion.div>
  )
}

const DeployCard = ({
  variant = 'default',
  title,
  subtitle,
  branch
}: {
  variant?: 'default' | 'danger' | 'success' | 'warning'
  title: string
  subtitle: string
  branch: string
}) => {
  return (
    <div className="mx-auto flex w-full max-w-sm items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md',
            variant === 'default' && 'bg-gray-200',
            variant === 'danger' && 'bg-red-200',
            variant === 'success' && 'bg-green-200',
            variant === 'warning' && 'bg-yellow-200'
          )}
        >
          <ForkIcon
            className={cn(
              'h-4 w-4',
              variant === 'default' && 'text-gray-500',
              variant === 'danger' && 'text-red-500',
              variant === 'success' && 'text-green-500',
              variant === 'warning' && 'text-yellow-500'
            )}
          />
        </div>
        <span className="text-charcoal-700 text-xs font-medium sm:text-sm">{title}</span>
      </div>
      <div className="ml-2 flex flex-row items-center gap-2">
        <span className="text-charcoal-700 text-xs font-normal">{subtitle}</span>
        <div className="size-1 rounded-full bg-gray-400"></div>
        <span className="text-charcoal-700 text-xs font-normal">{branch}</span>
      </div>
    </div>
  )
}
