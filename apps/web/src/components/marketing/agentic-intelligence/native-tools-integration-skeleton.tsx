import type React from 'react'

import { motion } from 'motion/react'

import { IconBlock } from '~/components/marketing/common/icon-block'
import { CodeIcon, PhoneIcon, WindowIcon } from '~/components/marketing/icons/bento-icons'
import { LinearLogo, NotionLogo, OpenAILogo, SlackLogo, SupabaseLogo } from '~/components/marketing/icons/general'
import { LogoSVG } from '~/components/marketing/logo'

import { BottomSVG, MiddleSVG, RightSideSVG, TopSVG, VerticalLine } from './native-tool-connectors'

export const NativeToolsIntegrationSkeleton = () => {
  return (
    <>
      <div className="relative mx-auto my-24 h-full w-full scale-[2] sm:scale-[1.5] md:scale-[1.2] lg:hidden">
        <img
          src="/marketing/illustrations/native-tools-integration.svg"
          alt="Native Tools Integration"
          style={{ width: 1200, height: 1200 }}
          className="dark:invert dark:filter"
        />
      </div>
      <motion.div className="relative mx-auto my-12 hidden h-full max-h-70 min-h-80 max-w-[67rem] grid-cols-2 p-4 lg:grid">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-10">
            <TextIconBlock icon={<WindowIcon />} text="Meeting Summarizer">
              <TopSVG className="absolute top-2 -right-84" />
            </TextIconBlock>
            <TextIconBlock icon={<CodeIcon />} text="Code Reviewer">
              <MiddleSVG className="absolute top-2 -right-84" />
            </TextIconBlock>
            <TextIconBlock icon={<PhoneIcon />} text="Customer Support">
              <BottomSVG className="absolute -right-84 bottom-2" />
            </TextIconBlock>
          </div>
          <div className="relative h-16 w-16 overflow-hidden rounded-md bg-gray-200 p-px shadow-xl dark:bg-neutral-700">
            <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full bg-conic [background-image:conic-gradient(at_center,transparent,var(--color-blue-500)_20%,transparent_30%)] [animation-duration:2s]"></div>
            <div className="absolute inset-0 scale-[1.4] animate-spin rounded-full [background-image:conic-gradient(at_center,transparent,var(--color-brand)_20%,transparent_30%)] [animation-delay:1s] [animation-duration:2s]"></div>
            <div className="relative z-20 flex h-full w-full items-center justify-center rounded-[5px] bg-white dark:bg-neutral-900">
              <LogoSVG className="text-black dark:text-white" />
            </div>
          </div>
        </div>
        <div className="relative flex h-full w-full items-center justify-start">
          <RightSideSVG />
          <div className="relative flex flex-col items-center gap-2">
            <span className="relative z-20 rounded-sm border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs text-blue-500 dark:bg-blue-900 dark:text-white">
              Connected
            </span>
            <div className="absolute inset-x-0 -top-30 flex h-full flex-col items-center">
              <IconBlock icon={<NotionLogo className="size-6" />} />
              <VerticalLine />
              <VerticalLine />
              <IconBlock icon={<LinearLogo className="size-6" />} />
            </div>
          </div>
          <div className="2 absolute -top-4 right-30 flex h-full flex-col items-center">
            <IconBlock icon={<SupabaseLogo className="size-6" />} />
            <VerticalLine />
            <IconBlock icon={<SlackLogo className="size-6" />} />
          </div>
          <RightSideSVG />
          <IconBlock icon={<OpenAILogo className="size-6" />} />
        </div>
      </motion.div>
    </>
  )
}

const TextIconBlock = ({
  icon,
  text,
  children
}: {
  icon: React.ReactNode
  text: string
  children?: React.ReactNode
}) => {
  return (
    <div className="relative flex items-center gap-2">
      {icon}
      <span className="text-charcoal-700 text-sm font-medium dark:text-neutral-200">{text}</span>
      {children}
    </div>
  )
}
