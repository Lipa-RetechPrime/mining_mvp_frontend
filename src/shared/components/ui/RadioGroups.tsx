import { useId } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface RadioOption<T extends string = string> {
    value: T
    label: string
    disabled?: boolean
}

export interface RadioGroupProps<T extends string = string> {
    name: string
    value: T
    onChange: (value: T) => void
    options: ReadonlyArray<RadioOption<T>>
    legend?: string
    orientation?: 'horizontal' | 'vertical'
    className?: string
}

export function RadioGroup<T extends string = string>({
    name,
    value,
    onChange,
    options,
    legend,
    orientation = 'horizontal',
    className,
}: RadioGroupProps<T>) {
    const baseId = useId()

    return (
        <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
            {legend ? (
                <legend className="mb-1.5 text-xs font-medium leading-none text-gray-500">
                    {legend}
                </legend>
            ) : (
                <legend className="sr-only">{name}</legend>
            )}

            <div
                className={cn(
                    'flex flex-wrap text-xs',
                    orientation === 'horizontal' ? 'flex-row items-center gap-x-4 gap-y-1.5' : 'flex-col gap-2'
                )}
            >
                {options.map((opt, idx) => {
                    const inputId = `${baseId}-${opt.value}-${idx}`
                    const isChecked = value === opt.value

                    return (
                        <label
                            key={opt.value}
                            htmlFor={inputId}
                            className={cn(
                                'inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-gray-700 select-none transition-colors',
                                opt.disabled && 'cursor-not-allowed opacity-50'
                            )}
                        >
                            <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                                <input
                                    id={inputId}
                                    type="radio"
                                    name={name}
                                    value={opt.value}
                                    checked={isChecked}
                                    disabled={opt.disabled}
                                    onChange={() => onChange(opt.value)}
                                    className="peer h-3.5 w-3.5 appearance-none rounded-full border border-gray-300 bg-white checked:border-portal-purple checked:bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-portal-purple from-0% to-transparent to-45% focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple/40 disabled:cursor-not-allowed"
                                />
                            </span>
                            <span className="leading-none">{opt.label}</span>
                        </label>
                    )
                })}
            </div>
        </fieldset>
    )
}