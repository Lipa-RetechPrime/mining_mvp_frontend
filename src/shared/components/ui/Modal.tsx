'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MaterialIcon } from './MaterialIcon'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export interface ModalProps {
    open: boolean
    title: ReactNode
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    backdropClassName?: string
    className?: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const SIZE_CLASSES = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[calc(100vw-2rem)]',
}

export function Modal({
    open,
    title,
    onClose,
    children,
    footer,
    backdropClassName,
    className,
    size = 'xl',
}: ModalProps) {
    const [mounted, setMounted] = useState(false)
    const titleId = useId()


    useEffect(() => {
        setMounted(true)
    }, [])


    useEffect(() => {
        if (!open) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [open, onClose])

    if (!mounted || !open) return null

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            role="presentation"
        >
            {/* Backdrop */}
            <div
                className={cn('fixed inset-0 transition-opacity', backdropClassName ?? 'bg-black/40')}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Dialog Card */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={cn(
                    'relative z-10 flex max-h-[min(90vh,720px)] w-full flex-col overflow-hidden rounded-card bg-white shadow-card transition-all',
                    SIZE_CLASSES[size],
                    className
                )}
            >
                {/* Header */}
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-portal-border px-5 py-4">
                    <h2 id={titleId} className="text-base font-semibold text-[--color-portal-navy]">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close modal"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-portal-muted hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple transition-colors"
                    >
                        <MaterialIcon name="cancel" size={20} className="text-[--color-portal-purple]" />
                    </button>
                </header>

                {/* Content Body */}
                <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">
                    {children}
                </div>

                {/* Optional Footer */}
                {footer && (
                    <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-portal-border px-5 py-3">
                        {footer}
                    </footer>
                )}
            </div>
        </div>,
        document.body
    )
}