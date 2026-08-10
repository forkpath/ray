import React, { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'

import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { cn } from '@libs/ui-core'

import { Button } from './button'
import { CloseIcon, HamburgerIcon } from './icons/general'
import { Logo } from './logo'
import { ModeToggle } from './mode-toggle'

/* 营销站导航栏（桌面 + 移动 + 浮动三态） */
export const Navbar = () => {
  const { t } = useTranslation('marketing')
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: t('nav.pricing'), href: '/pricing' },
    { label: t('nav.about'), href: '/about' },
    { label: t('nav.careers'), href: '/careers' }
  ]

  return (
    <>
      {/* 桌面导航 */}
      <nav
        className={cn(
          'border-divide fixed inset-x-0 top-0 z-50 hidden border-b bg-white/80 backdrop-blur-md lg:block dark:bg-neutral-950/80',
          isScrolled && 'shadow-sm'
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Logo />
          <div className="flex items-center gap-8">
            {navLinks.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm text-gray-600 transition-colors hover:text-black dark:text-gray-300 dark:hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
            <Button as={Link} to="/auth/login" variant="primary" className="text-sm">
              {t('cta.startUsing')}
            </Button>
          </div>
        </div>
      </nav>

      {/* 移动端导航 */}
      <nav className="border-divide fixed inset-x-0 top-0 z-50 border-b bg-white/80 backdrop-blur-md lg:hidden dark:bg-neutral-950/80">
        <div className="flex items-center justify-between px-4 py-4">
          <Logo />
          <div className="flex items-center gap-2">
            <ModeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-neutral-800"
            >
              {isOpen ? <CloseIcon className="size-5" /> : <HamburgerIcon className="size-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="flex flex-col gap-2 px-4 py-4">
                {navLinks.map(link => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="rounded-lg px-4 py-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-neutral-800"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Button as={Link} to="/auth/login" variant="primary" className="mt-2 w-full text-sm">
                  {t('cta.startUsing')}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  )
}
