import React, { useEffect, useState } from 'react'

import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@libs/ui-core'

import { logos } from '~/constants/marketing/logos'

import { Container } from './container'

/* Logo 合作伙伴轮播 */
export const LogoCloud = () => {
  const { t } = useTranslation('marketing')
  const [displayedIndices, setDisplayedIndices] = useState<number[]>(() => Array.from({ length: 8 }, (_, i) => i))

  useEffect(() => {
    const interval = setInterval(() => {
      const notDisplayed = logos.map((_, i) => i).filter(i => !displayedIndices.includes(i))
      if (notDisplayed.length > 0) {
        const posToReplace = Math.floor(Math.random() * displayedIndices.length)
        const newLogoIdx = notDisplayed[Math.floor(Math.random() * notDisplayed.length)]
        setDisplayedIndices(prev => {
          const next = [...prev]
          next[posToReplace] = newLogoIdx
          return next
        })
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [displayedIndices])

  return (
    <Container className="border-divide border-x">
      <h2 className="py-8 text-center font-mono text-sm tracking-tight text-neutral-500 uppercase dark:text-gray-300">
        {t('logoCloud.trustedBy')}
      </h2>
      <div className="border-divide grid grid-cols-2 border-t md:grid-cols-4">
        {displayedIndices.map((logoIndex, position) => {
          const logo = logos[logoIndex]
          return (
            <div
              key={position}
              className={cn(
                'border-divide group relative overflow-hidden',
                'border-r md:border-r-0',
                position % 2 === 0 ? 'border-r' : '',
                position < 6 ? 'border-b md:border-b-0' : '',
                'md:border-r-0',
                position % 4 !== 3 ? 'md:border-r' : '',
                position < 4 ? 'md:border-b' : ''
              )}
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={logoIndex}
                  className="group flex min-h-32 items-center justify-center p-4 py-10 grayscale"
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ opacity: 0, y: -100 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <motion.img
                    src={logo.src}
                    alt={logo.title}
                    className={cn(
                      'h-8 w-auto object-contain transition-all duration-500 dark:invert dark:filter',
                      logo.className
                    )}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </Container>
  )
}
