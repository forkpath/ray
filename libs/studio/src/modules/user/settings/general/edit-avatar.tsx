import type { Area } from 'react-easy-crop'

import { memo, useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import Cropper from 'react-easy-crop'
import { toast } from 'sonner'

import { storageMutations, useApiClient } from '@libs/api-client'
import { useTranslation } from '@libs/i18n'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icons,
  Slider
} from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { user } from '../../lib/api'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const ACCEPTED_EXTENSIONS = '.jpg,.jpeg,.png,.webp'
const OUTPUT_SIZE = 256

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', error => reject(error))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable')

  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  ctx.drawImage(image, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Blob failed'))), 'image/webp', 0.85)
  })
}

interface EditAvatarProps {
  readonly user: { id: string; name: string | null; image: string | null }
}

export const EditAvatar = memo<EditAvatarProps>(({ user: userData }) => {
  const api = useApiClient()
  const { t } = useTranslation(['common', 'auth'])
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(userData.image ?? null)

  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const updateUser = useMutation({
    ...user.mutations.update,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auth'] })
    }
  })

  const upload = useMutation({
    mutationKey: ['avatar', 'upload'],
    mutationFn: async (blob: Blob) => {
      const uuid = crypto.randomUUID()
      const path = `avatars/${userData.id}-${uuid}.webp`

      const { url: uploadUrl } = await storageMutations.uploadUrl.fn(api, { path })

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/webp' }
      })

      if (!uploadRes.ok) throw new Error('Upload failed')

      const { url: publicUrl } = await storageMutations.publicUrl.fn(api, { path })

      return { publicUrl, oldImage: userData.image }
    },
    onSuccess: async ({ publicUrl, oldImage }) => {
      await updateUser.mutateAsync({ image: publicUrl })

      if (oldImage) {
        const oldPath = oldImage.split('/').pop()
        if (oldPath) {
          try {
            const { url: deleteUrl } = await storageMutations.deleteUrl.fn(api, { path: `avatars/${oldPath}` })
            void fetch(deleteUrl, { method: 'DELETE' })
          } catch {
            /* best effort cleanup */
          }
        }
      }

      setPreviewUrl(publicUrl)
      toast.success(
        t('auth:account.avatar.update.success', {
          defaultValue: 'Avatar updated'
        })
      )
    },
    onError: () => {
      setPreviewUrl(userData.image ?? null)
      toast.error(
        t('common:error.general', {
          defaultValue: 'Something went wrong'
        })
      )
    }
  })

  const remove = useMutation({
    mutationKey: ['avatar', 'remove'],
    mutationFn: async () => {
      await updateUser.mutateAsync({ image: '' })

      if (userData.image) {
        const oldPath = userData.image.split('/').pop()
        if (oldPath) {
          try {
            const { url: deleteUrl } = await storageMutations.deleteUrl.fn(api, { path: `avatars/${oldPath}` })
            void fetch(deleteUrl, { method: 'DELETE' })
          } catch {
            /* best effort cleanup */
          }
        }
      }
    },
    onSuccess: () => {
      setPreviewUrl(null)
      toast.success(
        t('auth:account.avatar.remove.success', {
          defaultValue: 'Avatar removed'
        })
      )
    }
  })

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (file.size > MAX_FILE_SIZE) {
        toast.error(
          t('auth:account.avatar.error.tooLarge', {
            defaultValue: 'File is too large. Maximum 5MB.'
          })
        )
        return
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(
          t('auth:account.avatar.error.type', {
            defaultValue: 'Only JPEG, PNG, and WebP images are accepted.'
          })
        )
        return
      }

      const objectUrl = URL.createObjectURL(file)
      setImageSrc(objectUrl)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setCroppedAreaPixels(null)
      setCropDialogOpen(true)

      e.target.value = ''
    },
    [t]
  )

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx)
  }, [])

  const handleCropConfirm = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return

    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels)
      setCropDialogOpen(false)

      if (imageSrc) URL.revokeObjectURL(imageSrc)
      setImageSrc(null)

      const tempPreview = URL.createObjectURL(blob)
      setPreviewUrl(tempPreview)
      upload.mutate(blob)
    } catch {
      toast.error(
        t('common:error.general', {
          defaultValue: 'Something went wrong'
        })
      )
    }
  }, [imageSrc, croppedAreaPixels, upload, t])

  const handleCropCancel = useCallback(() => {
    setCropDialogOpen(false)
    if (imageSrc) URL.revokeObjectURL(imageSrc)
    setImageSrc(null)
  }, [imageSrc])

  const isPending = upload.isPending || remove.isPending || updateUser.isPending

  return (
    <>
      <SettingsCard>
        <SettingsCardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <SettingsCardTitle>{t('common:avatar')}</SettingsCardTitle>
              <SettingsCardDescription>
                {t('auth:account.avatar.description', {
                  defaultValue: 'This is your avatar.\nClick on the avatar to upload a custom one from your files.'
                })}
              </SettingsCardDescription>
            </div>

            <div className="relative">
              <label className={isPending ? 'cursor-wait' : 'cursor-pointer'}>
                <Avatar className="ring-border hover:ring-primary/50 size-20 ring-2 ring-offset-2 transition-all">
                  {previewUrl && <AvatarImage src={previewUrl} alt={userData.name ?? ''} />}
                  {isPending && (
                    <div className="bg-background/60 absolute inset-0 flex items-center justify-center rounded-full backdrop-blur-sm">
                      <Icons.Loader2 className="text-muted-foreground size-7 animate-spin" />
                    </div>
                  )}
                  <AvatarFallback className="text-lg">{userData.name?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isPending}
                />
              </label>

              {previewUrl && !isPending && (
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-background dark:bg-background hover:bg-muted absolute -top-1 -right-1 size-6 rounded-full"
                  onClick={() => remove.mutate()}
                  disabled={isPending}
                >
                  <Icons.X className="size-3.5" />
                  <span className="sr-only">{t('common:remove', { defaultValue: 'Remove' })}</span>
                </Button>
              )}
            </div>
          </div>
        </SettingsCardHeader>

        <SettingsCardFooter>
          {t('auth:account.avatar.info', {
            defaultValue: 'An avatar is optional but strongly recommended.'
          })}
        </SettingsCardFooter>
      </SettingsCard>

      <Dialog open={cropDialogOpen} onOpenChange={handleCropCancel}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('auth:account.avatar.crop.title', {
                defaultValue: 'Crop Avatar'
              })}
            </DialogTitle>
            <DialogDescription>
              {t('auth:account.avatar.crop.description', {
                defaultValue: 'Drag to reposition, scroll to zoom. The circular area will be your avatar.'
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-lg">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="flex items-center gap-3 px-1">
            <Icons.ZoomOut className="text-muted-foreground size-4 shrink-0" />
            <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={([v]) => setZoom(v)} className="flex-1" />
            <Icons.ZoomIn className="text-muted-foreground size-4 shrink-0" />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCropCancel}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button onClick={handleCropConfirm}>{t('common:save', { defaultValue: 'Save' })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
})

EditAvatar.displayName = 'EditAvatar'
