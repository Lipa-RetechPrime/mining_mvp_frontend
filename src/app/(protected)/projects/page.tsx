'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { Input } from '@/shared/components/ui/Input'
import { Button } from '@/shared/components/ui/Button'
import { Loading } from '@/shared/components/ui/Loading'
import { Modal } from '@/shared/components/ui/Modal'
import { routes } from '@/shared/config/routes'
import { formatLastUpdated, sortMinesByLastUpdated } from '@/shared/utils/mineList'
import { listMines, type MineListItem } from '@/features/estimations/api/mines'
import { getMineWiseFunctionList } from '@/features/estimations/api/master'

const NO_COST_FUNCTION_MESSAGE = 'There is no cost function in the mine.'

export default function ProjectsPage() {
  const router = useRouter()
  const [mines, setMines] = useState<MineListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [openingMineId, setOpeningMineId] = useState<string | null>(null)
  const [showNoFunctionsModal, setShowNoFunctionsModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const list = await listMines()
        if (cancelled) return
        setMines(list)
      } catch (err) {
        if (cancelled) return
        setMines([])
        setError(
          err instanceof Error ? err.message : 'Failed to load projects',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const minesSorted = useMemo(() => sortMinesByLastUpdated(mines), [mines])

  const filteredMines = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return minesSorted
    return minesSorted.filter((mine) => {
      const label = mine.mine_name.toLowerCase()
      const id = mine.mine_id.toLowerCase()
      const year =
        mine.year != null ? String(mine.year).toLowerCase() : ''
      return (
        label.includes(query) || id.includes(query) || year.includes(query)
      )
    })
  }, [minesSorted, search])

  async function openProject(mine: MineListItem) {
    if (!mine.mine_id || openingMineId) return
    setOpeningMineId(mine.mine_id)
    try {
      const functions = await getMineWiseFunctionList(mine.mine_id)
      if (functions.length === 0) {
        setShowNoFunctionsModal(true)
        return
      }
      router.push(routes.projects.detail(mine.mine_id))
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'Failed to check cost functions for this mine.',
      )
    } finally {
      setOpeningMineId(null)
    }
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-portal-navy">
            Manage Existing
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Mine listing uses the dedicated mines API only.
          </p>
        </div>
        <div className="rounded-card bg-white px-6 py-8 shadow-sm ring-1 ring-amber-200/80">
          <p className="text-sm font-medium text-amber-900">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-portal-navy">Manage Existing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Select a mine/project. Ownership or Outsourcing is chosen per cost
            function. Most recently updated appears first.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <Input
            type="search"
            label="Search project"
            placeholder="Search by project name, ID, or year"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search project"
          />
        </div>
      </div>

      {minesSorted.length === 0 ? (
        <div className="rounded-card bg-white px-6 py-10 text-center shadow-sm">
          <MaterialIcon
            name="assignment_add"
            size={28}
            className="mx-auto text-portal-purple"
          />
          <h2 className="mt-3 text-base font-semibold text-portal-navy">
            No mines/projects found
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Add mines to see them here.
          </p>
        </div>
      ) : filteredMines.length === 0 ? (
        <div className="rounded-card bg-white px-6 py-10 text-center shadow-sm">
          <MaterialIcon
            name="search_off"
            size={28}
            className="mx-auto text-gray-400"
          />
          <h2 className="mt-3 text-base font-semibold text-portal-navy">
            No matching projects
          </h2>
          <p className="mt-1 text-sm text-gray-500">Try a different search term.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-portal-border bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-portal-border bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 sm:px-5">Project / Mine</th>
                <th className="px-4 py-3 sm:px-5">Year</th>
                <th className="px-4 py-3 sm:px-5">Last Updated</th>
                <th className="px-4 py-3 text-right sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMines.map((mine, index) => {
                const lastUpdated = formatLastUpdated(mine.updatedAt)
                const isOpening = openingMineId === mine.mine_id

                return (
                  <tr
                    key={mine.mine_id}
                    tabIndex={0}
                    role="button"
                    aria-busy={isOpening}
                    onClick={() => {
                      void openProject(mine)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        void openProject(mine)
                      }
                    }}
                    className="cursor-pointer transition hover:bg-gray-50/80 focus:bg-gray-50/80 focus:outline-none"
                  >
                    <td className="px-4 py-3.5 font-medium text-portal-navy sm:px-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{mine.mine_name}</span>
                        {index === 0 && search.trim() === '' && lastUpdated ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Latest
                          </span>
                        ) : null}
                        {isOpening ? <Loading compact className="inline-flex" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 sm:px-5">
                      {mine.year != null ? mine.year : '—'}
                    </td>
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

      <Modal
        open={showNoFunctionsModal}
        title="No cost function"
        onClose={() => setShowNoFunctionsModal(false)}
        backdropClassName="bg-black/30 backdrop-blur-sm"
        className="max-w-md"
        footer={
          <Button
            variant="primary"
            onClick={() => setShowNoFunctionsModal(false)}
          >
            OK
          </Button>
        }
      >
        <p className="text-sm text-portal-navy">{NO_COST_FUNCTION_MESSAGE}</p>
      </Modal>
    </div>
  )
}
