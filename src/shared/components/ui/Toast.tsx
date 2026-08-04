'use client'

import React, { useEffect } from 'react'
import { MaterialIcon } from '@/shared/components/ui/MaterialIcon'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Helper function to safely merge Tailwind classes (Standard Next.js practice)
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export type ToastVariant = 'success' | 'error' | 'info'

interface ToastStyle {
    border: string
    iconBg: string
    iconColor: string
    icon: string
    label: string
}

const VARIANT_STYLES: Record<ToastVariant, ToastStyle> = {
    success: {
        border: 'border-emerald-200',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-700',
        icon: 'check_circle',
        label: 'Success',
    },
    error: {
        border: 'border-red-200',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        icon: 'error',
        label: 'Error',
    },
    info: {
        border: 'border-portal-border',
        iconBg: 'bg-portal-purple-soft',
        iconColor: 'text-portal-purple-text',
        icon: 'info',
        label: 'Info',
    },
} as const

export interface ToastProps {
    message: React.ReactNode
    variant?: ToastVariant
    onDismiss?: () => void
    duration?: number
    icon?: string | false
    className?: string
}

export function Toast({
    message,
    variant = 'info',
    onDismiss,
    duration,
    icon,
    className,
}: ToastProps) {
    const styles = VARIANT_STYLES[variant]
    const iconName = icon === false ? null : (icon ?? styles.icon)

    // Optional auto-dismiss timer logic
    useEffect(() => {
        if (!duration || !onDismiss) return
        const timer = setTimeout(() => {
            onDismiss()
        }, duration)
        return () => clearTimeout(timer)
    }, [duration, onDismiss])

    return (
        <div
            role={variant === 'error' ? 'alert' : 'status'}
            aria-live={variant === 'error' ? 'assertive' : 'polite'}
            className={cn(
                'flex w-full max-w-sm items-center gap-3 rounded-[5px] border bg-white p-4 text-gray-700 shadow-card transition-all',
                styles.border,
                className
            )}
        >
            {iconName && (
                <div
                    className={cn(
                        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded',
                        styles.iconBg,
                        styles.iconColor
                    )}
                >
                    <MaterialIcon name={iconName} size={20} />
                    <span className="sr-only">{styles.label}</span>
                </div>
            )}

            <div className="flex-1 text-sm font-normal leading-snug">{message}</div>

            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Close notification"
                    className="shrink-0 flex h-7 w-7 items-center justify-center rounded border border-transparent bg-transparent text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-portal-purple transition-colors"
                >
                    <MaterialIcon name="close" size={18} />
                </button>
            )}
        </div>
    )
}