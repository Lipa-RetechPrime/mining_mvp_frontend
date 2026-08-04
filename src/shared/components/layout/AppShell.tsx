'use client'

import { Suspense, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { BackToHome } from '@/shared/components/ui/BackToHome'
import { routes } from '@/shared/config/routes'

import { Header } from './Header'
import { MineSideNav } from './MineSideNav'
import { SideNav } from './SideNav'

export interface AppShellProps {
  children: ReactNode
  tenantTitle?: string
}

function isProjectDetailPath(pathname: string): boolean {
  if (
    pathname === routes.projects.list ||
    pathname === routes.projects.create
  ) {
    return false
  }
  return pathname.startsWith(`${routes.projects.list}/`)
}

export function AppShell({ children, tenantTitle }: AppShellProps) {
  const pathname = usePathname()
  const [sideNavCollapsed, setSideNavCollapsed] = useState(false)
  const showMineNav = isProjectDetailPath(pathname)
  const showBackToHome =
    pathname !== routes.dashboard && pathname !== routes.projects.list

  return (
    <div className="flex h-screen min-h-0 bg-[#F1F6FF]">
      {showMineNav ? (
        <Suspense
          fallback={
            <aside
              id="app-side-nav"
              className={`bg-portal-nav flex h-full shrink-0 overflow-hidden rounded-e-[10px] transition-[width,min-width] duration-300 ${
                sideNavCollapsed ? 'w-0 min-w-0' : 'w-[300px] min-w-[300px]'
              }`}
              aria-hidden
            />
          }
        >
          <MineSideNav collapsed={sideNavCollapsed} />
        </Suspense>
      ) : (
        <SideNav collapsed={sideNavCollapsed} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          tenantTitle={tenantTitle}
          sideNavCollapsed={sideNavCollapsed}
          onToggleSideNav={() =>
            setSideNavCollapsed((collapsed) => !collapsed)
          }
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-10 py-4">
          {showBackToHome ? (
            <div className="mb-4 shrink-0">
              <BackToHome />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
