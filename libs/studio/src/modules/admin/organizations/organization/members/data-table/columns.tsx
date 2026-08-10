import type { ColumnDef } from '@tanstack/react-table'
import type { GetMembersRes } from '@libs/payload'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { toast } from 'sonner'

import { adminOrgKeys, adminOrgMutations, adminUserKeys, useApiClient } from '@libs/api-client'
import { MemberRole } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons
} from '@libs/ui-web'

import { pathsConfig } from '../../../../../../config/paths'
import { authClient } from '../../../../../../lib/auth/client'
import { UpdateMemberRoleModal } from '../update-member-role'

type MemberRow = GetMembersRes['list'][number]

function MemberActions({ member }: { member: MemberRow }) {
  const { t } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [roleModalOpen, setRoleModalOpen] = useState(false)

  const removeMember = useMutation(
    adminOrgMutations.deleteMember.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminOrgKeys.members(member.organizationId)
        })
        await queryClient.invalidateQueries({
          queryKey: adminUserKeys.memberships(member.userId)
        })
        toast.success(
          t('admin:organizations.organization.members.remove.success', {
            defaultValue: 'Member removed'
          })
        )
      }
    })
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <span className="sr-only">{t('actions')}</span>
            <Icons.Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setRoleModalOpen(true)}>
            {t('admin:organizations.organization.members.updateRole', {
              defaultValue: 'Update role'
            })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() =>
              removeMember.mutate({
                orgId: member.organizationId,
                memberId: member.id
              })
            }
            disabled={removeMember.isPending}
          >
            {t('remove', { defaultValue: 'Remove' })}
            {removeMember.isPending && <Icons.Loader2 className="ml-auto size-3 animate-spin" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UpdateMemberRoleModal member={member} open={roleModalOpen} onOpenChange={setRoleModalOpen} />
    </>
  )
}

export const useColumns = (): ColumnDef<MemberRow>[] => {
  const { t, i18n } = useTranslation('common')
  const session = authClient.useSession()

  return [
    {
      id: 'q',
      accessorKey: 'q',
      meta: {
        placeholder: `${t('search')}...`,
        variant: 'text'
      },
      enableHiding: false,
      enableColumnFilter: true
    },
    {
      id: 'user',
      accessorFn: row => row.user.name,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('name')} />,
      cell: ({ row }) => (
        <Link to={pathsConfig.admin.users.user(row.original.userId)} className="group flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={row.original.user.image ?? undefined} alt={row.original.user.name} />
            <AvatarFallback>
              <Icons.UserRound className="w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <span className="group-hover:text-primary truncate font-medium underline underline-offset-4">
              {row.original.user.name}
            </span>
            {row.original.userId === session.data?.user.id && <Badge variant="outline">{t('you')}</Badge>}
          </div>
        </Link>
      ),
      enableHiding: false
    },
    {
      id: 'user.email',
      accessorKey: 'user.email',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('email')} />,
      meta: {
        label: t('email')
      }
    },
    {
      id: 'role',
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('role')} />,
      cell: ({ row }) => <Badge variant="outline">{t(row.original.role)}</Badge>,
      meta: {
        label: t('role'),
        variant: 'multiSelect',
        options: Object.values(MemberRole).map(role => ({
          label: t(role),
          value: role
        }))
      },
      enableColumnFilter: true
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <div className="ml-auto w-fit">
          <DataTableColumnHeader column={column} title={t('joinedAt')} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-auto text-right">{new Date(row.original.createdAt).toLocaleDateString(i18n.language)}</div>
      ),
      meta: {
        label: t('joinedAt'),
        variant: 'dateRange'
      },
      enableColumnFilter: true
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="ml-auto w-fit">
          <MemberActions member={row.original} />
        </div>
      ),
      enableHiding: false
    }
  ]
}
