import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { useTranslation } from '@libs/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Icons,
  Input
} from '@libs/ui-web'

import { pathsConfig } from '../../config/paths'
import { organization } from './lib/api'

const createOrganizationSchema = z.object({
  name: z.string().min(2).max(32),
  slug: z.string().min(2).max(32).optional()
})

type CreateOrganizationFormValues = z.infer<typeof createOrganizationSchema>

interface CreateOrganizationModalProps {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const CreateOrganizationModal = ({ trigger, open: openProp, onOpenChange }: CreateOrganizationModalProps) => {
  const { t } = useTranslation('organization')
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )
  const queryClient = useQueryClient()

  const form = useForm<CreateOrganizationFormValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: ''
    }
  })

  const mutation = useMutation({
    ...organization.mutations.create,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      setOpen(false)
      form.reset()
      if (data?.slug) {
        window.location.href = pathsConfig.crm.index
      }
    }
  })

  const onSubmit = (values: CreateOrganizationFormValues) => {
    mutation.mutate({
      name: values.name,
      slug: values.slug?.trim() || slugify(values.name)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogDescription>{t('create.description')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('slug')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('slugPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Icons.Loader className="mr-2 size-4 animate-spin" />}
                {t('create.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
