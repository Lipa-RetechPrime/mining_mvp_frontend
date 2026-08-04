'use client'

import { useRouter } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { routes } from '@/shared/config/routes'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface BackToHomeProps {
  className?: string
  label?: string
}

/** Returns to the main home (dashboard). */
export function BackToHome({
  className,
  label = 'Back to Home',
}: BackToHomeProps) {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push(routes.dashboard)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[5px] py-1.5 text-sm font-medium text-portal-purple transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple/40',
        className,
      )}
    >
      <MaterialIcon
        name="arrow_back"
        size={18}
        className="text-portal-purple"
      />
      {label}
    </button>
  )
}
