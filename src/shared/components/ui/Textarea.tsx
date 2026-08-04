'use client'

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const LINE_HEIGHT = 20
const VERT_PAD = 16

export interface TextareaProps extends ComponentPropsWithoutRef<'textarea'> {
  label?: string
  error?: string
  minRows?: number
  maxRows?: number
  /** Single-line when idle; expands only while focused (typing / click). */
  collapseWhenBlurred?: boolean
  containerClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      id,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      minRows = 1,
      maxRows = 12,
      collapseWhenBlurred = false,
      className,
      containerClassName,
      disabled,
      rows: _rows,
      title,
      ...props
    },
    forwardedRef,
  ) => {
    void _rows
    const internalRef = useRef<HTMLTextAreaElement | null>(null)
    const [editing, setEditing] = useState(false)
    const generatedId = useId()

    const textareaId = id ?? generatedId
    const errorId = `${textareaId}-error`
    const expanded = !collapseWhenBlurred || editing
    const stringValue = value == null ? '' : String(value)
    // Hover shows full text via native tooltip; field itself stays collapsed.
    const hoverTitle =
      title ??
      (collapseWhenBlurred && !editing && stringValue.trim()
        ? stringValue
        : undefined)

    useImperativeHandle(forwardedRef, () => internalRef.current as HTMLTextAreaElement)

    useEffect(() => {
      const el = internalRef.current
      if (!el) return

      const minHeight = minRows * LINE_HEIGHT + VERT_PAD
      const maxHeight = maxRows * LINE_HEIGHT + VERT_PAD

      if (!expanded) {
        el.style.height = `${minHeight}px`
        el.style.overflowY = 'hidden'
        return
      }

      // Reset so scrollHeight reflects full wrapped content (incl. prefilled text).
      el.style.height = '0px'
      const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
      el.style.height = `${next}px`
      el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }, [value, defaultValue, minRows, maxRows, expanded])

    return (
      <div className={cn('flex w-full flex-col gap-1', className, containerClassName)}>
        {label ? (
          <label
            htmlFor={textareaId}
            className="text-xs font-medium leading-none text-gray-500"
          >
            {label}
          </label>
        ) : null}

        <textarea
          {...props}
          ref={internalRef}
          id={textareaId}
          value={value}
          defaultValue={defaultValue}
          title={hoverTitle}
          onChange={onChange}
          disabled={disabled}
          rows={minRows}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onFocus={(e) => {
            setEditing(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setEditing(false)
            onBlur?.(e)
          }}
          className={cn(
            'box-border min-h-9 w-full resize-none rounded-[4px] border border-gray-300 bg-white px-3 py-2 text-sm leading-5 text-gray-900 placeholder:text-gray-400 outline-none transition-[height,border-color,box-shadow]',
            'focus:border-portal-purple focus:ring-1 focus:ring-portal-purple/30',
            'read-only:bg-gray-50 read-only:text-gray-600',
            disabled && 'cursor-not-allowed bg-gray-100 opacity-60',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
            !expanded
              ? 'overflow-hidden whitespace-nowrap text-ellipsis'
              : 'whitespace-pre-wrap',
          )}
        />

        {error ? (
          <span id={errorId} className="text-[11px] leading-tight text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
