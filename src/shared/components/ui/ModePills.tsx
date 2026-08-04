import type { KeyboardEvent } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface PillOption<T extends string = string> {
    value: T
    label: string
}

export interface ModePillsProps<T extends string = string> {
    name: string
    value: T
    onChange: (value: T) => void
    options: ReadonlyArray<PillOption<T>>
    legend?: string
    className?: string
}

/** Compact pill toggle for Manual / Calculated (or similar) field modes. */
export function ModePills<T extends string = string>({
    name,
    value,
    onChange,
    options,
    legend,
    className,
}: ModePillsProps<T>) {
    // Arrow key navigation for radio group ARIA standard
    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
        let nextIndex: number | null = null

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            nextIndex = (currentIndex + 1) % options.length
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            nextIndex = (currentIndex - 1 + options.length) % options.length
        }

        if (nextIndex !== null) {
            const targetOption = options[nextIndex]
            onChange(targetOption.value)
            // Focus the newly selected button
            const targetButton = e.currentTarget.parentElement?.children[nextIndex] as HTMLButtonElement
            targetButton?.focus()
        }
    }

    return (
        <fieldset className={cn('m-0 min-w-0 border-0 p-0 relative', className)}>
            {legend && <legend className="sr-only">{legend}</legend>}

            <div
                className="inline-flex items-center rounded-full bg-gray-100 p-0.5 absolute -top-3.5 right-0"
                role="radiogroup"
                aria-label={legend || name}
                data-name={name}
            >
                {options.map((opt, index) => {
                    const active = value === opt.value

                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            tabIndex={active ? 0 : -1}
                            onClick={() => {
                                if (opt.value !== value) onChange(opt.value)
                            }}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            className={cn(
                                'inline-flex cursor-pointer items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple',
                                active
                                    ? 'bg-portal-purple text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </fieldset>
    )
}