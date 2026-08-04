'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { Input } from '@/shared/components/ui/Input'
import { routes } from '@/shared/config/routes'
import { formatLastUpdated, sortMinesByLastUpdated } from '@/shared/utils/mineList'
import {
  DeliveryModeModal,
  getStoredDeliveryMode,
  setStoredDeliveryMode,
  type DeliveryModeCode,
} from '@/features/projects'

type ProjectListItem = {
  mine_id: string
  siteSubtitle: string
  lifeOfMine?: string | null
  updatedAt?: string
}

function mineKey(m: ProjectListItem): string {
  return m.mine_id || ''
}

const listOfProjects: ProjectListItem[] = [
  {
    mine_id: '1',
    siteSubtitle: 'Chuperbhita Simlong OCP',
    lifeOfMine: '25 years',
    updatedAt: '2026-07-27T10:00:00.000Z',
  },
  {
    mine_id: '2',
    siteSubtitle: 'Project 2',
    lifeOfMine: '18 years',
    updatedAt: '2026-07-20T08:00:00.000Z',
  },
  {
    mine_id: '3',
    siteSubtitle: 'Project 3',
    lifeOfMine: '30 years',
    updatedAt: '2026-07-25T14:30:00.000Z',
  },
  {
    mine_id: '4',
    siteSubtitle: 'Project 4',
    lifeOfMine: '12 years',
    updatedAt: '2026-06-15T09:00:00.000Z',
  },
  {
    mine_id: '5',
    siteSubtitle: 'Project 5',
    lifeOfMine: '22 years',
    updatedAt: '2026-07-26T18:00:00.000Z',
  },
  {
    mine_id: '6',
    siteSubtitle: 'Project 6',
    lifeOfMine: '15 years',
    updatedAt: '2026-05-01T12:00:00.000Z',
  },
]

export default function ProjectsPage() {
  const router = useRouter()
  const [mines] = useState(() => listOfProjects)
  const [loading] = useState(false)
  const [error] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [pendingMine, setPendingMine] = useState<(typeof listOfProjects)[number] | null>(null)

  const minesSorted = useMemo(() => sortMinesByLastUpdated(mines), [mines])

  const filteredMines = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return minesSorted
    return minesSorted.filter((mine) => {
      const label = (mine.siteSubtitle || '').toLowerCase()
      const id = (mine.mine_id || '').toLowerCase()
      const lom = (mine.lifeOfMine || '').toLowerCase()
      return label.includes(query) || id.includes(query) || lom.includes(query)
    })
  }, [minesSorted, search])

  function openProject(mine: (typeof listOfProjects)[number]) {
    const key = mineKey(mine)
    if (!key) return
    const existing = getStoredDeliveryMode(key)
    if (existing) {
      router.push(routes.projects.detail(key))
      return
    }
    setPendingMine(mine)
  }

  function handleModalClose() {
    setPendingMine(null)
  }

  function handleModalConfirm(mode: DeliveryModeCode) {
    if (!pendingMine) return
    const key = mineKey(pendingMine)
    setStoredDeliveryMode(key, mode)
    setPendingMine(null)
    router.push(routes.projects.detail(key))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <svg
          className="h-10 w-10 animate-spin text-portal-purple"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="mt-4 text-sm text-gray-500">Loading projects…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-card bg-white px-6 py-8 shadow-sm">
        <p className="text-sm font-medium text-red-600">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-portal-navy">Manage Existing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Select a mine/project to choose delivery mode. Most recently updated appears first.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <Input
            type="search"
            label="Search project"
            placeholder="Search by project name, ID, or life of mine"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search project"
          />
        </div>
      </div>

      {minesSorted.length === 0 ? (
        <div className="rounded-card bg-white px-6 py-10 text-center shadow-sm">
          <MaterialIcon name="assignment_add" size={28} className="mx-auto text-portal-purple" />
          <h2 className="mt-3 text-base font-semibold text-portal-navy">
            No mines/projects found
          </h2>
          <p className="mt-1 text-sm text-gray-500">Add cost estimations to see them here.</p>
        </div>
      ) : filteredMines.length === 0 ? (
        <div className="rounded-card bg-white px-6 py-10 text-center shadow-sm">
          <MaterialIcon name="search_off" size={28} className="mx-auto text-gray-400" />
          <h2 className="mt-3 text-base font-semibold text-portal-navy">No matching projects</h2>
          <p className="mt-1 text-sm text-gray-500">Try a different search term.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-portal-border bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-portal-border bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 sm:px-5">Project / Mine</th>
                <th className="px-4 py-3 sm:px-5">Life of mine</th>
                <th className="px-4 py-3 sm:px-5">Last Updated</th>
                <th className="px-4 py-3 text-right sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMines.map((mine, index) => {
                const key = mineKey(mine)
                const label = mine.siteSubtitle || 'Untitled mine'
                const lastUpdated = formatLastUpdated(mine.updatedAt)
                const lom = (mine.lifeOfMine || '').trim()

                return (
                  <tr
                    key={key}
                    tabIndex={0}
                    role="button"
                    onClick={() => openProject(mine)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openProject(mine)
                      }
                    }}
                    className="cursor-pointer transition hover:bg-gray-50/80 focus:bg-gray-50/80 focus:outline-none"
                  >
                    <td className="px-4 py-3.5 font-medium text-portal-navy sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{label}</span>
                        {index === 0 && search.trim() === '' && lastUpdated ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Latest
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 sm:px-5">{lom || '—'}</td>
                    <td className="px-4 py-3.5 text-gray-600 sm:px-5">
                      {lastUpdated ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right sm:px-5">
                      <MaterialIcon
                        name="chevron_right"
                        size={20}
                        className="inline text-portal-purple"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <DeliveryModeModal
        open={Boolean(pendingMine)}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
      />
    </div>
  )
}
