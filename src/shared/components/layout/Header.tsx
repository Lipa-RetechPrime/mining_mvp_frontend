'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { logout } from '@/features/auth/model/auth-slice'
import { routes } from '@/shared/config/routes'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { useAppDispatch, useAppSelector } from '@/store/hooks'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface HeaderProps {
  onToggleSideNav?: () => void
  sideNavCollapsed?: boolean
  tenantTitle?: string
  className?: string
}

export function Header({
  onToggleSideNav,
  sideNavCollapsed = false,
  tenantTitle = 'Impcon',
  className,
}: HeaderProps) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const displayName = user?.name ?? 'Mining Admin'

  async function handleSignOut() {
    setMenuOpen(false)
    await dispatch(logout()).unwrap()
    router.replace(routes.login)
  }

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <header
      className={cn(
        'z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-gray-200 bg-portal-surface px-6 py-4 sm:px-10',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3 text-portal-navy">
        {onToggleSideNav && (
          <button
            type="button"
            aria-label={
              sideNavCollapsed
                ? 'Expand side navigation'
                : 'Collapse side navigation'
            }
            aria-expanded={!sideNavCollapsed}
            aria-controls="app-side-nav"
            onClick={onToggleSideNav}
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-portal-purple text-portal-navy transition',
              'hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple/40',
            )}
          >
            <MaterialIcon
              name="menu"
              size={24}
              className="text-portal-purple"
            />
          </button>
        )}

        <span className="hidden text-sm tracking-tight select-none sm:inline">
          <strong className="font-semibold">MCE</strong> Portal
          <br />
          <span className="text-xs text-gray-500">
            Mining Cost Estimation System
          </span>
        </span>
      </div>

      <h1 className="truncate text-lg font-bold uppercase tracking-wide text-slate-800 sm:text-2xl">
        {tenantTitle}
      </h1>

      <div className="relative justify-self-end" ref={menuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Account menu for ${displayName}`}
          onClick={() => setMenuOpen((open) => !open)}
          className={cn(
            'inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-left transition select-none',
            'hover:bg-black/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple/40',
          )}
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
            <MaterialIcon
              name="person"
              size={22}
              filled
              className="text-portal-purple"
            />
          </span>

          <span className="hidden text-sm font-medium text-slate-700 sm:inline">
            {displayName}
          </span>

          <MaterialIcon
            name={menuOpen ? 'expand_less' : 'expand_more'}
            size={18}
            className="text-gray-500"
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 min-w-[200px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            <div className="border-b border-gray-100 px-3 py-2 sm:hidden">
              <p className="truncate text-sm font-medium text-slate-800">
                {displayName}
              </p>
              {user?.email && (
                <p className="truncate text-xs text-gray-500">
                  {user.email}
                </p>
              )}
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              className="group flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:bg-red-50 focus-visible:text-red-600"
            >
              <MaterialIcon
                name="logout"
                size={18}
                className="text-gray-400 group-hover:text-red-600 group-focus-visible:text-red-600"
              />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
