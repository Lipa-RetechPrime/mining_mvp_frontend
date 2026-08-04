import type { ReactNode } from 'react'

export function EntityTabs({
  tabs,
  activeId,
  onChange,
  actions,
}: {
  tabs: Array<{ id: string; code: string }>
  activeId: string
  onChange: (id: string) => void
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2.5" role="tablist" aria-label="Entity">
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`rounded-full px-7 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple ${
                active
                  ? 'bg-portal-purple text-white'
                    : 'bg-portal-inactive text-[--text-color] hover:bg-gray-300 border border-[--separator]'
              }`}
            >
              {tab.code}
            </button>
          )
        })}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
