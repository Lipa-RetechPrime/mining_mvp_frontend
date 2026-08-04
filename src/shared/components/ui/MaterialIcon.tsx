import type { ComponentPropsWithoutRef } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface MaterialIconProps extends ComponentPropsWithoutRef<'span'> {
  /** Material Symbols glyph name */
  name: string
  /** Pixel size for both width and font-size; defaults to 20 */
  size?: number
  /** Fill state; defaults to false */
  filled?: boolean
  /** Font weight variation; defaults to 400 */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700
}

/** Google Material Symbols Outlined / Filled ligature icon component. */
export function MaterialIcon({
  name,
  size = 20,
  filled = false,
  weight = 400,
  className,
  style,
  ...props
}: MaterialIconProps) {
  return (
    <span
      className={cn('material-symbols-outlined select-none inline-block leading-none', className)}
      style={{
        fontSize: size,
        width: size,
        height: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${Math.min(Math.max(size, 20), 48)}`,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  )
}