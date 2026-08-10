import type { GetMembersRes } from '@libs/payload'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { adminOrgKeys, adminOrgMutations, useApiClient } from '@libs/api-client'
import { MemberRole } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@libs/ui-web'

type MemberRow = GetMembersRes['list'][number]

interface UpdateMemberRoleModalProps {
  readonly member: MemberRow
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function UpdateMemberRoleModal({ member, open, onOpenChange }: UpdateMemberRoleModalProps) {
  const { t } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState(member.role)

  const updateMember = useMutation(
    adminOrgMutations.updateMember.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminOrgKeys.members(member.organizationId)
        })
        toast.success(
          t('admin:organizations.organization.members.updateRole.success', {
            defaultValue: 'Member role updated'
          })
        )
        onOpenChange(false)
      }
    })
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('admin:organizations.organization.members.updateRole.title', {
              defaultValue: 'Update member role'
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin:organizations.organization.members.updateRole.description', {
              defaultValue: 'Change the role for this member in the organization.'
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Select value={selectedRole} onValueChange={value => setSelectedRole(value as typeof selectedRole)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('role')} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(MemberRole).map(role => (
                <SelectItem key={role} value={role}>
                  {t(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              updateMember.mutate({
                orgId: member.organizationId,
                memberId: member.id,
                role: selectedRole
              })
            }
            disabled={updateMember.isPending || selectedRole === member.role}
          >
            {updateMember.isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
            {t('update', { defaultValue: 'Update' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
