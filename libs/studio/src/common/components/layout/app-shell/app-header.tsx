/**
 * AppHeader 组件 - 应用顶部导航栏
 *
 * 该组件提供应用顶部的工具栏功能，包括：
 * - Sidebar 折叠/展开切换按钮
 * - 搜索功能入口
 * - 语言切换下拉菜单
 * - 活动记录面板
 * - 通知下拉菜单
 *
 * 注意：用户头像已移至 Sidebar 底部，不再在 Header 中显示。
 */

import type { ReactNode } from 'react'

import { memo, useState } from 'react'

import { useTranslation } from '@libs/i18n'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons,
  Input,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SidebarTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@libs/ui-web'

// ============================================================================
// 语言切换下拉菜单
// ============================================================================

/** 支持的语言列表 */
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' }
] as const

/** LanguageDropdown 组件属性 */
interface LanguageDropdownProps {
  /** 自定义触发器 */
  readonly trigger?: ReactNode
  /** 下拉菜单对齐方式 */
  readonly align?: 'start' | 'center' | 'end'
}

/**
 * 语言切换下拉菜单组件
 *
 * 允许用户切换应用的显示语言。
 * 切换后会调用 i18n.changeLanguage 更新全局语言设置。
 */
export const LanguageDropdown = memo<LanguageDropdownProps>(({ trigger, align = 'end' }) => {
  const { i18n } = useTranslation()
  const [language, setLanguage] = useState(i18n.language)

  /** 处理语言切换 */
  const handleLanguageChange = (value: string) => {
    setLanguage(value)
    void i18n.changeLanguage(value)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon">
            <Icons.Languages className="size-5" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-50" align={align}>
        <DropdownMenuRadioGroup value={language} onValueChange={handleLanguageChange}>
          {LANGUAGES.map(lang => (
            <DropdownMenuRadioItem
              key={lang.value}
              value={lang.value}
              className="data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground pl-2 text-base [&>span]:hidden"
            >
              {lang.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

LanguageDropdown.displayName = 'LanguageDropdown'

// ============================================================================
// 活动记录面板
// ============================================================================

/** ActivitySheet 组件属性 */
interface ActivitySheetProps {
  /** 自定义触发器 */
  readonly trigger?: ReactNode
}

/**
 * 活动记录面板组件
 *
 * 以侧边抽屉的形式展示用户的活动记录，
 * 包括提及、文件共享、审批请求等。
 */
export const ActivitySheet = memo<ActivitySheetProps>(({ trigger }) => {
  const { t } = useTranslation('common')

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon">
            <Icons.Activity className="size-5" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="gap-0 sm:max-w-md [&>button]:top-2.75 [&>button>svg]:size-5">
        <SheetHeader className="border-b py-2.25">
          <SheetTitle className="text-lg leading-6">{t('activity')}</SheetTitle>
          <SheetDescription hidden />
        </SheetHeader>

        <div className="overflow-y-auto">
          {/* 活动记录项 1：用户提及 */}
          <div className="flex gap-4 px-4 py-3">
            <Avatar>
              <AvatarFallback>JL</AvatarFallback>
            </Avatar>
            <div className="flex w-full flex-col items-start gap-2.5">
              <div className="text-muted-foreground flex flex-col items-start text-sm">
                <p>
                  <span className="text-foreground font-semibold">Joe Lincoln</span>{' '}
                  {t('activity.mentionedYou', { defaultValue: 'mentioned you in last trends topic' })}
                </p>
                <p>
                  18 {t('minutes')} {t('ago')}
                </p>
              </div>
              <div className="bg-muted flex flex-col gap-4 rounded-md border px-4 py-2.5">
                <p className="text-sm font-medium">
                  @User{' '}
                  {t('activity.checkTopic', {
                    defaultValue: 'For an expert opinion, check out what Mike has to say on this topic!'
                  })}
                </p>
                <div className="relative">
                  <Input placeholder={t('reply', { defaultValue: 'Reply' })} className="peer bg-card pr-9" />
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3 peer-disabled:opacity-50">
                    <Icons.Image className="size-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 活动记录项 2：文件审阅邀请 */}
          <div className="flex gap-4 px-4 py-3">
            <Avatar>
              <AvatarFallback>JP</AvatarFallback>
            </Avatar>
            <div className="flex w-full flex-col items-start gap-2.5">
              <div className="text-muted-foreground flex flex-col items-start text-sm">
                <p>
                  <span className="text-foreground font-semibold">Jane Perez</span>{' '}
                  {t('activity.invitesReview', { defaultValue: 'invites you to review a file' })}
                </p>
                <p>
                  39 {t('minutes')} {t('ago')}
                </p>
              </div>
              <div className="bg-muted flex items-center gap-1 rounded-md px-1.5 py-1">
                <Icons.FileText className="size-4" />
                <span className="text-sm font-medium">invoices.pdf</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 活动记录项 3：设计项目查看请求 */}
          <div className="flex gap-4 px-4 py-3">
            <Avatar>
              <AvatarFallback>TH</AvatarFallback>
            </Avatar>
            <div className="flex w-full flex-col items-start gap-2.5">
              <div className="text-muted-foreground flex flex-col items-start text-sm">
                <p>
                  <span className="text-foreground font-semibold">Tyler Hero</span>{' '}
                  {t('activity.wantsView', { defaultValue: 'wants to view your design project' })}
                </p>
                <p>
                  1 {t('hour')} {t('ago')}
                </p>
              </div>
              <div className="bg-muted flex w-full items-center gap-4 rounded-md border px-4 py-2.5">
                <Icons.FileImage className="size-8" />
                <span className="text-sm font-medium">Launcher-Uikit.fig</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 活动记录项 4：设计审阅邀请 */}
          <div className="flex gap-4 px-4 py-3">
            <Avatar>
              <AvatarFallback>D</AvatarFallback>
            </Avatar>
            <div className="text-muted-foreground flex flex-col items-start text-sm">
              <p>
                <span className="text-foreground font-semibold">Denial</span>{' '}
                {t('activity.invitesReviewDesign', { defaultValue: 'invites you to review the new design' })}
              </p>
              <p>
                3 {t('hours')} {t('ago')}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})

ActivitySheet.displayName = 'ActivitySheet'

// ============================================================================
// 通知下拉菜单
// ============================================================================

/** NotificationDropdown 组件属性 */
interface NotificationDropdownProps {
  /** 自定义触发器 */
  readonly trigger?: ReactNode
  /** 下拉菜单对齐方式 */
  readonly align?: 'start' | 'center' | 'end'
}

/**
 * 通知下拉菜单组件
 *
 * 显示用户的通知列表，支持 Inbox 和 General 两个标签页。
 * 包含新消息、评论、活动申请等通知类型。
 */
export const NotificationDropdown = memo<NotificationDropdownProps>(({ trigger, align = 'end' }) => {
  const { t } = useTranslation('common')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon" className="relative">
            <Icons.Bell className="size-5" />
            {/* 未读通知指示器 */}
            <span className="bg-destructive absolute -top-0.5 -right-0.5 size-2 rounded-full" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-w-xs sm:max-w-122" align={align}>
        <Tabs defaultValue="inbox" className="gap-0">
          <DropdownMenuLabel className="flex flex-col pb-0">
            <div className="flex items-center justify-between gap-6 pb-2.5">
              <span className="text-muted-foreground text-base font-normal uppercase">{t('notifications')}</span>
              <Badge variant="secondary" className="bg-primary/10 text-primary font-normal">
                8 {t('new')}
              </Badge>
            </div>
            <div className="-mb-0.5 flex items-center justify-between gap-4">
              <TabsList className="relative h-fit rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="inbox"
                  className="data-[state=active]:border-b-primary! rounded-none border-b-2 border-b-transparent font-normal data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                >
                  {t('inbox', { defaultValue: 'Inbox' })}
                </TabsTrigger>
                <TabsTrigger
                  value="general"
                  className="data-[state=active]:border-b-primary! rounded-none border-b-2 border-b-transparent font-normal data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
                >
                  {t('general', { defaultValue: 'General' })}
                </TabsTrigger>
              </TabsList>
              <Icons.Settings className="size-5" />
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="mt-0 h-0.5" />

          {/* Inbox 标签页内容 */}
          <TabsContent value="inbox">
            <DropdownMenuItem className="gap-3 px-2 py-3 text-base">
              <Avatar className="size-9.5">
                <AvatarFallback>MB</AvatarFallback>
              </Avatar>
              <div className="flex w-full flex-col items-start">
                <span className="text-base font-medium">Mark Bush</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground text-sm">
                    12 {t('minutes')} {t('ago')}
                  </span>
                  <div className="bg-muted size-1.5 rounded-full" />
                  <span className="text-muted-foreground text-sm">
                    {t('notification.newPost', { defaultValue: 'New post' })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Icons.X className="text-foreground size-3.5" />
                <div className="bg-primary size-1.5 rounded-full" />
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-3 px-2 py-3 text-base">
              <Avatar className="size-9.5">
                <AvatarFallback>AB</AvatarFallback>
              </Avatar>
              <div className="flex w-full flex-col items-start">
                <span className="text-base font-medium">Aaron Black</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground text-sm">
                    27 {t('minutes')} {t('ago')}
                  </span>
                  <div className="bg-muted size-1.5 rounded-full" />
                  <span className="text-muted-foreground text-sm">
                    {t('notification.newComment', { defaultValue: 'New comment' })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Icons.X className="text-foreground size-3.5" />
                <div className="bg-primary size-1.5 rounded-full" />
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="items-start gap-3 px-2 py-3 text-base">
              <Avatar className="size-9.5">
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <div className="flex w-full flex-col items-start">
                <span className="text-base font-medium">
                  {t('notification.appliedCampaign', {
                    defaultValue: 'Anna has applied to create an ad for your campaign'
                  })}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground text-sm">
                    2 {t('hours')} {t('ago')}
                  </span>
                  <div className="bg-muted size-1.5 rounded-full" />
                  <span className="text-muted-foreground text-sm">
                    {t('notification.newRequest', { defaultValue: 'New request for campaign' })}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <Button variant="secondary" size="sm">
                    {t('decline')}
                  </Button>
                  <Button size="sm">{t('accept')}</Button>
                </div>
              </div>
            </DropdownMenuItem>
          </TabsContent>

          {/* General 标签页内容 */}
          <TabsContent value="general">
            <DropdownMenuItem className="gap-3 px-2 py-3 text-base">
              <Avatar className="size-9.5">
                <AvatarFallback>FC</AvatarFallback>
              </Avatar>
              <div className="flex w-full flex-col items-start">
                <span className="text-base font-medium">Fred Campbell</span>
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground text-sm">
                    39 {t('minutes')} {t('ago')}
                  </span>
                  <div className="bg-muted size-1.5 rounded-full" />
                  <span className="text-muted-foreground text-sm">
                    {t('notification.newComment', { defaultValue: 'New comment' })}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Icons.X className="text-foreground size-3.5" />
                <div className="bg-primary size-1.5 rounded-full" />
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="items-start gap-3 px-2 py-3 text-base">
              <Avatar className="size-9.5">
                <AvatarFallback>S</AvatarFallback>
              </Avatar>
              <div className="flex w-full flex-col items-start">
                <span className="text-base font-medium">
                  {t('notification.attachedFile', { defaultValue: 'Scott attached the file' })}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="text-muted-foreground text-sm">
                    3 {t('hours')} {t('ago')}
                  </span>
                  <div className="bg-muted size-1.5 rounded-full" />
                  <span className="text-muted-foreground text-sm">
                    {t('notification.attachedFiles', { defaultValue: 'Attached files' })}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <Icons.Link className="text-foreground size-4" />
                  <span className="text-sm">Work examples.com</span>
                </div>
              </div>
            </DropdownMenuItem>
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

NotificationDropdown.displayName = 'NotificationDropdown'

// ============================================================================
// AppHeader 组件
// ============================================================================

/** AppHeader 组件属性 */
interface AppHeaderProps {
  /** 切换 Sidebar 可见性的回调 */
  readonly onToggleSidebar?: () => void
  /** 是否显示 Sidebar 切换按钮 */
  readonly showSidebarToggle?: boolean
  /** Header 右侧的自定义操作按钮 */
  readonly actions?: ReactNode
}

/**
 * AppHeader 组件
 *
 * 应用的顶部导航栏，包含以下功能：
 * - Sidebar 折叠/展开按钮（当有二级导航时显示）
 * - 搜索入口
 * - 语言切换
 * - 活动记录
 * - 通知中心
 *
 * 注意：用户头像已移至 Sidebar 底部，点击后显示用户二级导航。
 */
export const AppHeader = memo<AppHeaderProps>(({ onToggleSidebar, showSidebarToggle = true, actions }) => {
  const { t } = useTranslation('common')

  return (
    <header className="bg-card sticky top-0 z-50 flex h-14 items-center justify-between gap-6 border-b px-4 sm:px-6">
      {/* 左侧区域：Sidebar 切换和搜索 */}
      <div className="flex items-center gap-4">
        {/* 移动端 Sidebar 触发器 */}
        <SidebarTrigger className="md:hidden [&_svg]:size-5!" />

        {/* 大屏 Sidebar 切换按钮（仅当有二级导航时显示） */}
        {showSidebarToggle && (
          <Button variant="ghost" size="icon" className="hidden md:flex" onClick={onToggleSidebar}>
            <Icons.PanelLeft className="size-5" />
            <span className="sr-only">{t('toggleSidebar', { defaultValue: 'Toggle sidebar' })}</span>
          </Button>
        )}

        {/* 搜索入口（大屏） */}
        <Button variant="ghost" className="hidden bg-transparent! px-1 py-0 font-normal sm:block">
          <div className="text-muted-foreground hidden items-center gap-1.5 text-sm sm:flex">
            <Icons.Search className="size-4" />
            <span>{t('search.placeholder', { defaultValue: 'Type to search...' })}</span>
          </div>
        </Button>

        {/* 搜索入口（小屏） */}
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Icons.Search className="size-5" />
          <span className="sr-only">{t('search')}</span>
        </Button>
      </div>

      {/* 右侧区域：工具按钮 */}
      <div className="flex items-center gap-1.5 sm:gap-6">
        <div className="flex items-center gap-1.5">
          <ActivitySheet />
          <NotificationDropdown />
        </div>
        {actions}
      </div>
    </header>
  )
})

AppHeader.displayName = 'AppHeader'
