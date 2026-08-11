import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface InputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'prefix'> {
  label?: string
  error?: string
  /**
   * When false, invalid styles/ARIA still apply but the message is not rendered
   * (caller shows it elsewhere, e.g. under a sibling field).
   */
  showErrorMessage?: boolean
  /**
   * When false, the error message can still render but the control keeps a neutral border
   * (e.g. Calculated lakhs expands with the message while % stays the invalid control).
   */
  showErrorBorder?: boolean
  prefix?: ReactNode | string
  suffix?: ReactNode | string
  align?: 'left' | 'center' | 'right'
  /** Extra classes on the outer field wrapper (layout / flex sizing). */
  containerClassName?: string
  /** Extra classes on the native input element. */
  inputClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      showErrorMessage = true,
      showErrorBorder = true,
      prefix,
      suffix,
      align,
      id,
      className,
      containerClassName,
      inputClassName,
      disabled,
      readOnly,
      type = 'text',
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const errorId = `${inputId}-error`
    const showInvalidStyles = Boolean(error) && showErrorBorder
    const isLakhsSuffix = typeof suffix === 'string' && suffix.toLowerCase() === 'lakhs'
    const textAlign = align ?? (isLakhsSuffix ? 'right' : 'left')
    const {
      'aria-describedby': ariaDescribedByProp,
      ...inputProps
    } = props
    const describedBy =
      error && showErrorMessage
        ? errorId
        : typeof ariaDescribedByProp === 'string'
          ? ariaDescribedByProp
          : undefined

    return (
      <div className={cn('flex w-full flex-col gap-1', className, containerClassName)}>
        {label ? (
          <label htmlFor={inputId} className="text-xs font-medium leading-none text-gray-500">
            {label}
            {required ? <span className="text-red-600"> *</span> : null}
          </label>
        ) : null}

        <div
          className={cn(
            'flex h-9 w-full items-center rounded-[4px] border border-gray-300 bg-white transition-all',
            'focus-within:border-portal-purple focus-within:ring-1 focus-within:ring-portal-purple/30',
            readOnly && 'bg-gray-50',
            disabled && 'cursor-not-allowed bg-gray-100 opacity-60',
            showInvalidStyles &&
              'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/30',
          )}
        >
          {prefix ? (
            <span className="shrink-0 self-center pl-2.5 pr-1 text-sm text-gray-400 select-none">
              {prefix}
            </span>
          ) : null}

          <input
            {...inputProps}
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={showInvalidStyles || undefined}
            aria-describedby={describedBy}
            className={cn(
              'h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm leading-none text-portal-navy placeholder:text-gray-400 outline-none',
              'read-only:text-gray-600 disabled:cursor-not-allowed',
              textAlign === 'right' && 'text-right tabular-nums placeholder-shown:text-left',
              textAlign === 'center' && 'text-center',
              prefix && 'pl-1',
              suffix && 'pr-1',
              inputClassName,
            )}
          />

          {suffix ? (
            <span
              className={cn(
                'shrink-0 self-center text-sm leading-none text-gray-400 select-none',
                isLakhsSuffix ? 'pr-3 pl-1' : 'pr-2.5',
              )}
            >
              {suffix}
            </span>
          ) : null}
        </div>

        {error && showErrorMessage ? (
          <span id={errorId} className="text-[11px] leading-tight text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'
