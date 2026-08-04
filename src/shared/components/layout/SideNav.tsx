'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { routes } from '@/shared/config/routes'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type NavChild = {
  href: string
  label: string
  exact?: boolean
}

type NavSection = {
  id: string
  label: string
  basePath: string
  children?: NavChild[]
  icon: ReactNode
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    basePath: routes.dashboard,
    icon: <MaterialIcon name="dashboard" size={22} />,
  },
  {
    id: 'projects',
    label: 'Projects',
    basePath: routes.projects.list,
    children: [
      { href: routes.projects.create, label: 'Add New' },
      { href: routes.projects.list, label: 'Manage Existing', exact: true },
    ],
    icon: <MaterialIcon name="folder" size={22} />,
  },
  {
    id: 'tenants',
    label: 'Tenants',
    basePath: routes.tenants.list,
    children: [
      { href: routes.tenants.create, label: 'Add Tenant' },
      { href: routes.tenants.list, label: 'Manage Tenants', exact: true },
    ],
    icon: <MaterialIcon name="manage_accounts" size={22} />,
  },
  {
    id: 'users',
    label: 'Users',
    basePath: routes.users.list,
    children: [
      { href: routes.users.create, label: 'Add User' },
      { href: routes.users.list, label: 'Manage Users', exact: true },
    ],
    icon: <MaterialIcon name="supervisor_account" size={22} />,
  },
]

function isChildActive(pathname: string, child: NavChild): boolean {
  if (child.exact) {
    return pathname === child.href
  }

  return pathname === child.href || pathname.startsWith(`${child.href}/`)
}

function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return (
    pathname === section.basePath ||
    pathname.startsWith(`${section.basePath}/`)
  )
}

function getInitialOpenSections(pathname: string): Record<string, boolean> {
  const open: Record<string, boolean> = {}

  for (const section of NAV_SECTIONS) {
    if (section.children?.length) {
      open[section.id] = sectionContainsPath(section, pathname)
    }
  }

  if (!Object.values(open).some(Boolean)) {
    open.projects = true
  }

  return open
}

export interface SideNavProps {
  collapsed?: boolean
  className?: string
}

/** Collapsible navigation for authenticated application routes. */
export function SideNav({ collapsed = false, className }: SideNavProps) {
  const pathname = usePathname()
  const [openById, setOpenById] = useState<Record<string, boolean>>(() =>
    getInitialOpenSections(pathname),
  )

  function toggleSection(id: string) {
    setOpenById((previous) => ({
      ...previous,
      [id]: !previous[id],
    }))
  }

  return (
    <aside
      id="app-side-nav"
      aria-hidden={collapsed}
      inert={collapsed || undefined}
      className={cn(
        'bg-portal-nav flex h-full shrink-0 flex-col overflow-hidden rounded-e-[10px] text-white transition-[width,min-width] duration-300 ease-in-out',
        collapsed ? 'w-0 min-w-0' : 'w-[300px] min-w-[300px]',
        className,
      )}
    >
      <div className="flex h-full w-[300px] flex-col">
        <div className="h-1.5 w-full shrink-0" aria-hidden="true" />

        <div className="mx-auto my-5 flex h-[75px] w-[150px] shrink-0 items-center justify-center">
          <Image
            src="/icons/logo_original_white.png"
            alt="Portal Logo"
            width={150}
            height={75}
            preload
            className="h-full w-full object-contain"
          />
        </div>

        <nav
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-8"
          aria-label="Main navigation"
        >
          {NAV_SECTIONS.map((section) => {
            const hasChildren = Boolean(section.children?.length)
            const isActiveSection = sectionContainsPath(section, pathname)
            const isOpen = isActiveSection || Boolean(openById[section.id])
            const panelId = `nav-section-${section.id}`
            const itemClassName = cn(
              'mb-1 flex w-full items-center gap-2.5 rounded-[5px] border-l-2 border-transparent px-3 py-2 text-left transition',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              isActiveSection && 'border-l-2 border-white bg-portal-nav-item-active',
            )

            return (
              <div key={section.id}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className={itemClassName}
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
                      {section.icon}
                      <span className="inline-block min-w-0 flex-1 text-[15px] font-bold leading-snug">
                        {section.label}
                      </span>
                      <MaterialIcon
                        name={isOpen ? 'expand_less' : 'expand_more'}
                        size={18}
                        className="shrink-0"
                      />
                    </span>
                  </button>
                ) : (
                  <Link
                    href={section.basePath}
                    aria-current={isActiveSection ? 'page' : undefined}
                    className={itemClassName}
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
                      {section.icon}
                      <span className="inline-block min-w-0 flex-1 text-[15px] font-bold leading-snug">
                        {section.label}
                      </span>
                    </span>
                  </Link>
                )}

                {hasChildren && isOpen ? (
                  <ul id={panelId} className="flex flex-col gap-0.5 pl-5">
                    {section.children!.map((item) => {
                      const isActiveLink = isChildActive(pathname, item)

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={isActiveLink ? 'page' : undefined}
                            className={cn(
                              'flex items-start gap-2.5 rounded-sm px-5 py-1.5 text-[14px] leading-snug transition',
                              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                              isActiveLink
                                ? 'font-medium'
                                : 'font-extralight text-white',
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
