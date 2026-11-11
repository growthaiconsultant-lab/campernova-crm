'use client'

export function PreparationLink({
  target,
  children,
  chooseFile = false,
}: {
  target: string
  children: React.ReactNode
  chooseFile?: boolean
}) {
  return (
    <a
      className="inline-flex min-h-10 items-center rounded-md border bg-background px-3 text-sm font-medium text-sidebar-primary hover:underline"
      href={'#' + target}
      onClick={(event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        const element = document.getElementById(target)
        if (!element) return
        event.preventDefault()
        for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement) parent.open = true
        }
        element.scrollIntoView({ block: 'center' })
        element.focus({ preventScroll: true })
        if (chooseFile) {
          const file = element.querySelector<HTMLInputElement>('input[type=file]')
          if (file && !file.disabled) file.click()
        }
      }}
    >
      {children}
    </a>
  )
}
