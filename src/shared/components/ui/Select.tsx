import { useId, type ComponentPropsWithoutRef } from 'react'
import { MaterialIcon } from './MaterialIcon'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface SelectProps extends ComponentPropsWithoutRef<'select'> {
    label?: string
    error?: string
    filled?: boolean
    containerClassName?: string
}

export function Select({
    label,
    error,
    id,
    filled,
    className,
    containerClassName,
    children,
    disabled,
    value,
    defaultValue,
    ...props
}: SelectProps) {
    const generatedId = useId()
    const selectId = id ?? generatedId
    const errorId = `${selectId}-error`

    // Automatically determine filled status if value/defaultValue exists
    const isFilled = filled ?? Boolean(value || defaultValue)

    return (
        <div className={cn('flex flex-col gap-1 w-full', containerClassName)}>
            {label && (
                <label htmlFor={selectId} className="text-xs font-medium leading-none text-gray-500">
                    {label}
                </label>
            )}

            <div className="relative flex items-center">
                <select
                    id={selectId}
                    value={value}
                    defaultValue={defaultValue}
                    disabled={disabled}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    className={cn(
                        'box-border h-9 w-full min-w-0 appearance-none rounded-[4px] border border-gray-300 px-2.5 pr-8 text-[13px] leading-tight outline-none transition-colors',
                        'focus:border-portal-purple focus:ring-1 focus:ring-portal-purple/30',
                        isFilled ? 'bg-gray-100 text-gray-700 font-medium' : 'bg-white text-gray-400',
                        error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
                        disabled && 'cursor-not-allowed opacity-60 bg-gray-50',
                        className
                    )}
                    {...props}
                >
                    {children}
                </select>

                {/* Floating Chevron Icon */}
                <div className="pointer-events-none absolute right-2 flex items-center text-gray-400">
                    <MaterialIcon name="expand_more" size={18} />
                </div>
            </div>

            {error && (
                <span id={errorId} className="text-[11px] leading-tight text-red-600" role="alert">
                    {error}
                </span>
            )}
        </div>
    )
}