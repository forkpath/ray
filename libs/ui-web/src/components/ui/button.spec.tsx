import { buttonVariants } from './button'

describe('buttonVariants', () => {
  it('provides the default browser button contract', () => {
    const classes = buttonVariants()

    expect(classes).toContain('bg-primary')
    expect(classes).toContain('h-9')
  })

  it('applies explicit variants and sizes', () => {
    const classes = buttonVariants({ variant: 'outline', size: 'icon' })

    expect(classes).toContain('border')
    expect(classes).toContain('size-9')
  })

  it('preserves consumer classes', () => {
    expect(buttonVariants({ className: 'consumer-class' })).toContain('consumer-class')
  })
})
