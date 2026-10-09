import React, { useEffect, useState } from 'react'

import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@libs/ui-core'

import { testimonials } from '~/constants/marketing/testimonials'

import { Dot } from './common/dots'
import { Container } from './container'
import { DivideX } from './divide'

/* 客户评价轮播 */
export const Testimonials = () => {
  const { t } = useTranslation('marketing')
  const [currentIndex, setCurrentIndex] = useState(0)
  const selected = testimonials[currentIndex]

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % testimonials.length)
    }, 10000)
    return () => clearInterval(id)
  }, [currentIndex])

  return (
    <>
      <Container className="border-divide border-x">
        <h2 className="pt-20 pb-10 text-center font-mono text-sm tracking-tight text-neutral-500 uppercase dark:text-neutral-400">
          {t('testimonials.trustedBy')}
        </h2>
      </Container>
      <DivideX />
      <Container className="border-divide relative border-x">
        <Dot top left />
        <Dot top right />
        <Dot bottom left />
        <Dot bottom right />
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={selected.src}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="divide-divide grid grid-cols-1 items-stretch divide-x bg-gray-100 md:h-[28rem] md:grid-cols-4 dark:bg-neutral-800"
          >
            <div className="col-span-4 flex flex-col gap-10 px-4 py-10 md:flex-row md:py-0 lg:col-span-3">
              <img
                src={selected.avatar}
                alt={selected.name}
                className="m-4 hidden aspect-square rounded-xl object-cover md:block md:w-[200px]"
                draggable={false}
              />
              <div className="flex flex-col items-start justify-between gap-4 py-4 pr-8">
                <div>
                  <img
                    src={selected.src}
                    alt={selected.company}
                    className={cn('object-contain dark:invert dark:filter', selected.logoClassName)}
                    draggable={false}
                  />
                  <blockquote className="text-charcoal-900 mt-6 text-xl leading-relaxed dark:text-neutral-100">
                    &quot;{selected.quote}&quot;
                  </blockquote>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <img
                    src={selected.avatar}
                    alt={selected.name}
                    className="aspect-square w-10 rounded-xl object-cover md:hidden"
                  />
                  <div>
                    <p className="text-charcoal-900 font-semibold dark:text-neutral-100">{selected.name}</p>
                    <p className="text-sm text-gray-600 dark:text-neutral-400">
                      {selected.position}, {selected.company}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden flex-col justify-end px-4 pb-4 lg:col-span-1 lg:flex">
              <p className="text-charcoal-700 text-7xl font-semibold dark:text-neutral-100">{selected.sideText}</p>
              <p className="text-sm text-gray-700 dark:text-neutral-400">{selected.sideSubText}</p>
            </div>
          </motion.div>
        </AnimatePresence>
        {/* 底部 logo 选择栏 */}
        <div className="border-divide grid grid-cols-2 border-t md:grid-cols-4">
          {testimonials.slice(0, 8).map((item, index) => (
            <button
              key={item.src + index}
              className={cn(
                'border-divide group relative overflow-hidden',
                index % 2 === 0 ? 'border-r' : '',
                index < 6 ? 'border-b md:border-b-0' : '',
                index % 4 !== 3 ? 'md:border-r' : '',
                index < 4 ? 'md:border-b' : ''
              )}
              onClick={() => setCurrentIndex(index)}
            >
              <motion.div
                className="group flex min-h-32 items-center justify-center p-4 py-10 opacity-70 grayscale transition-all duration-500 hover:opacity-100"
                whileHover={{ opacity: 1 }}
              >
                <img
                  draggable={false}
                  src={item.src}
                  alt={item.company}
                  className={cn(
                    'h-8 w-auto object-contain transition-all duration-500 dark:invert dark:filter',
                    item.logoClassName
                  )}
                />
              </motion.div>
            </button>
          ))}
        </div>
      </Container>
    </>
  )
}
