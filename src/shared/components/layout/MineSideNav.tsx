'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { routes } from '@/shared/config/routes'
import { SECTOR_CATALOG } from '@/features/estimations/api/master'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface MineSideNavProps {
  collapsed?: boolean
  className?: string
}

/** Mine/project-detail navigation: Home + Cost Functions by sector. */
export function MineSideNav({ collapsed = false, className }: MineSideNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [costFunctionsOpen, setCostFunctionsOpen] = useState(true)

  const sectors = useMemo(() => SECTOR_CATALOG, [])
  const activeSectorId =
    searchParams.get('sector') || sectors[0]?.id || 'residential-buildings'

  function selectSector(sectorId: string) {
    const next = new URLSearchParams(searchParams.toString())
    next.set('sector', sectorId)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
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
          aria-label="Mine"
        >
          <button
            type="button"
            onClick={() => router.push(routes.projects.list)}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[14px] leading-snug transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <MaterialIcon name="home" size={22} className="shrink-0" />
            <span className="text-[15px] font-bold leading-snug">Home</span>
          </button>

          <div>
            <button
              type="button"
              className="mb-1 flex w-full items-center gap-2.5 rounded-[10px] border-l-2 border-white bg-portal-nav-item-active px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-expanded={costFunctionsOpen}
              aria-controls="nav-section-cost-functions"
              aria-current="page"
              onClick={() => setCostFunctionsOpen((open) => !open)}
            >
              <span className="flex min-w-0 flex-1 items-center justify-start gap-2">
                <MaterialIcon name="calculate" size={22} />
                <span className="inline-block min-w-0 flex-1 text-[15px] font-bold leading-snug">
                  Cost Functions
                </span>
                <MaterialIcon
                  name={costFunctionsOpen ? 'expand_less' : 'expand_more'}
                  size={18}
                  className="shrink-0"
                />
              </span>
            </button>

            {costFunctionsOpen ? (
              <ul
                id="nav-section-cost-functions"
                className="flex flex-col gap-0.5 pl-5"
              >
                {sectors.map((sector) => {
                  const isActive = sector.id === activeSectorId
                  return (
                    <li key={sector.id}>
                      <button
                        type="button"
                        onClick={() => selectSector(sector.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[14px] leading-snug transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                          isActive
                            ? 'font-medium text-white'
                            : 'hover:text-white font-extralight',
                        )}  
                      >
                        Estimated Investment: {sector.name}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </nav>
      </div>
    </aside>
  )
}
