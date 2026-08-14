import type { ReactNode } from 'react'

/**
 * Keeps Latin/English fragments (dates, "5 days ago", unit strings) in
 * correct visual order inside RTL pages by isolating bidi direction.
 * Set `when={false}` to skip isolation for already-localized Arabic copy.
 */
export function LtrIsolate({
  children,
  className,
  as: Tag = 'span',
  when = true,
}: {
  children: ReactNode
  className?: string
  as?: 'span' | 'p' | 'div' | 'time'
  when?: boolean
}) {
  if (!when) {
    return className ? (
      <Tag className={className}>{children}</Tag>
    ) : (
      <>{children}</>
    )
  }
  return (
    <Tag dir="ltr" className={`ltr-isolate ${className ?? ''}`.trim()}>
      {children}
    </Tag>
  )
}

/** True when the string has no Arabic letters (safe to force LTR). */
export function isLatinFragment(text: string) {
  return !/[\u0600-\u06FF]/.test(text)
}
