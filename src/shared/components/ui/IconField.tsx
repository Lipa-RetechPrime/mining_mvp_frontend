import {
    forwardRef,
    useId,
    type ComponentPropsWithoutRef,
    type MouseEvent,
} from 'react'
import { MaterialIcon } from './MaterialIcon'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

function RequiredLabel({ children, required }: { children: string; required?: boolean }) {
    return (
        <span className="text-sm font-semibold text-slate-800">
            {children}
            {required && <span className="text-red-500"> *</span>}
        </span>
    )
}

// Base shared props
interface BaseIconFieldProps {
    icon: string
    trailingIcon?: string
    onTrailingIconClick?: (e: MouseEvent<HTMLButtonElement>) => void
    label: string
    showRequiredMark?: boolean
    error?: string
    containerClassName?: string
}

// Discriminated union for Input vs Textarea props
export type IconFieldProps = BaseIconFieldProps &
    (
        | ({ as?: 'input' } & ComponentPropsWithoutRef<'input'>)
        | ({ as: 'textarea' } & ComponentPropsWithoutRef<'textarea'>)
    )

export const IconField = forwardRef<
    HTMLInputElement | HTMLTextAreaElement,
    IconFieldProps
>((props, ref) => {
    const {
        id,
        label,
        icon,
        trailingIcon,
        onTrailingIconClick,
        as = 'input',
        showRequiredMark,
        error,
        className,
        containerClassName,
        required,
        disabled,
        ...restProps
    } = props

    const generatedId = useId()
    const fieldId = id ?? generatedId
    const errorId = `${fieldId}-error`
    const markRequired = showRequiredMark ?? Boolean(required)

    const sharedClasses = cn(
        'box-border w-full rounded-[6px] border bg-white pl-10 text-sm text-portal-navy placeholder:text-gray-400 outline-none transition-colors',
        'focus:border-portal-purple focus:ring-1 focus:ring-portal-purple/30',
        trailingIcon ? 'pr-10' : 'pr-3',
        error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : 'border-gray-300',
        disabled && 'cursor-not-allowed bg-gray-100 opacity-60',
        className
    )

    return (
        <div className={cn('flex flex-col gap-1.5 w-full', containerClassName)}>
            <label htmlFor={fieldId}>
                <RequiredLabel required={markRequired}>{label}</RequiredLabel>
            </label>

            <div className={`relative flex ${as === 'textarea' ? 'flex-col leading-snug' : 'items-center'}`}>
                {/* Leading Icon */}
                <MaterialIcon
                    name={icon}
                    size={18}
                    className={`pointer-events-none absolute ${as === 'textarea' ? 'top-3' : ''} left-3 36text-portal-purple select-none`}
                />

                {/* Input / Textarea Element */}
                {as === 'textarea' ? (
                    <textarea
                        {...(restProps as ComponentPropsWithoutRef<'textarea'>)}
                        ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
                        id={fieldId}
                        rows={3}
                        required={required}
                        disabled={disabled}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        className={cn(sharedClasses, 'min-h-[5.5rem] resize-y py-2.5 leading-snug')}
                    />
                ) : (
                    <input
                        {...(restProps as ComponentPropsWithoutRef<'input'>)}
                        ref={ref as React.ForwardedRef<HTMLInputElement>}
                        id={fieldId}
                        required={required}
                        disabled={disabled}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? errorId : undefined}
                        className={cn(sharedClasses, 'h-10 leading-none')}
                    />
                )}

                {/* Trailing Icon (Button or Static) */}
                {trailingIcon &&
                    (onTrailingIconClick ? (
                        <button
                            type="button"
                            onClick={onTrailingIconClick}
                            disabled={disabled}
                            className="absolute right-2.5 flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple"
                            aria-label="Action"
                        >
                            <MaterialIcon name={trailingIcon} size={18} />
                        </button>
                    ) : (
                        <MaterialIcon
                            name={trailingIcon}
                            size={18}
                            className="pointer-events-none absolute right-3 text-gray-400 select-none"
                        />
                    ))}
            </div>

            {error && (
                <span id={errorId} className="text-[11px] leading-tight text-red-600" role="alert">
                    {error}
                </span>
            )}
        </div>
    )
})

IconField.displayName = 'IconField'