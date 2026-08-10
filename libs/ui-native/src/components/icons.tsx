import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Atom,
  AtSign,
  BadgeCheck,
  BadgeX,
  Bell,
  Brain,
  Building,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  CircleX,
  Copy,
  Download,
  Globe2,
  GraduationCap,
  House,
  IdCard,
  Key,
  KeyRound,
  Languages,
  ListFilter,
  Loader,
  Loader2,
  Lock,
  LogOut,
  MailPlus,
  MonitorSmartphone,
  Moon,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  ShieldCheck,
  Sun,
  SunMoon,
  ThumbsUp,
  Trash,
  Trash2,
  TrendingUp,
  Undo2,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Wallet,
  WalletCards,
  WandSparkles,
  Workflow,
  X
} from 'lucide-react-native'
import { withUniwind } from 'uniwind'

import AppleSvg from '../assets/svg/brand/apple.svg'
import GithubSvg from '../assets/svg/brand/github.svg'
import GoogleSvg from '../assets/svg/brand/google.svg'
import AndroidStrokeSvg from '../assets/svg/brand/stroke/android.svg'
import AppleStrokeSvg from '../assets/svg/brand/stroke/apple.svg'
import ChinaSvg from '../assets/svg/flag/china.svg'
import SpainSvg from '../assets/svg/flag/spain.svg'
import UnitedKingdomSvg from '../assets/svg/flag/united-kingdom.svg'
import LogoTextSvg from '../assets/svg/logo-text.svg'
import LogoSvg from '../assets/svg/logo.svg'

const icons = {
  Logo: LogoSvg,
  LogoText: LogoTextSvg,
  Google: GoogleSvg,
  Apple: AppleSvg,
  AppleStroke: AppleStrokeSvg,
  AndroidStroke: AndroidStrokeSvg,
  Github: GithubSvg,
  UnitedKingdom: UnitedKingdomSvg,
  Spain: SpainSvg,
  China: ChinaSvg,
  ArrowRight,
  ArrowLeft,
  House,
  KeyRound,
  Wallet,
  Newspaper,
  UserRound,
  Loader2,
  Check,
  Key,
  ChevronDown,
  BadgeCheck,
  BadgeX,
  ChevronUp,
  Building,
  Settings,
  Sun,
  SunMoon,
  Moon,
  CircleX,
  WandSparkles,
  ChevronsUpDown,
  Undo2,
  ArrowUp,
  Globe2,
  GraduationCap,
  Atom,
  Brain,
  Loader,
  Plus,
  MailPlus,
  ChevronRight,
  ArrowDown,
  Share2,
  Download,
  Bell,
  ThumbsUp,
  Lock,
  ChevronLeft,
  ListFilter,
  X,
  Languages,
  IdCard,
  AtSign,
  Workflow,
  LogOut,
  Trash,
  Trash2,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Copy,
  TrendingUp,
  UsersRound,
  UserRoundPlus,
  ArrowUpRight,
  MonitorSmartphone,
  WalletCards
}

const Icons = {} as {
  [K in keyof typeof icons]: (typeof icons)[K]
}

;(Object.keys(icons) as (keyof typeof icons)[]).forEach(key => {
  ;(Icons as Record<string, unknown>)[key] = withUniwind(icons[key] as React.FC<React.SVGProps<SVGElement>>)
})

export type Icon = (typeof Icons)[keyof typeof Icons]

export { Icons }
