import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { MaterialIcon } from './MaterialIcon'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral' | 'outline'
export type BadgeSize = 'sm' | 'md' | 'lg'

interface VariantConfig {
    style: string
    defaultIcon?: string
}

const VARIANT_CONFIGS: Record<BadgeVariant, VariantConfig> = {
    info: {
        style: 'bg-portal-purple-soft text-portal-purple-text border border-transparent',
        defaultIcon: 'info',
    },
    success: {
        style: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        defaultIcon: 'check_circle',
    },
    warning: {
        style: 'bg-amber-50 text-amber-700 border border-amber-200',
        defaultIcon: 'warning',
    },
    error: {
        style: 'bg-red-50 text-red-700 border border-red-200',
        defaultIcon: 'error',
    },
    neutral: {
        style: 'bg-gray-100 text-gray-700 border border-transparent',
        defaultIcon: 'label',
    },
    outline: {
        style: 'bg-transparent text-gray-600 border border-gray-300',
    },
}

const SIZE_STYLES: Record<BadgeSize, { badge: string; iconSize: number }> = {
    sm: { badge: 'px-2 py-0.5 text-xs gap-1', iconSize: 14 },
    md: { badge: 'px-3 py-1 text-[13px] gap-1.5', iconSize: 16 },
    lg: { badge: 'px-3.5 py-1.5 text-sm gap-2', iconSize: 18 },
}

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
    variant?: BadgeVariant
    size?: BadgeSize
    icon?: string | false
    children: ReactNode
    className?: string
}

/** Compact status pill / badge component. */
export function Badge({
    variant = 'info',
    size = 'md',
    icon,
    children,
    className,
    ...props
}: BadgeProps) {
    const config = VARIANT_CONFIGS[variant]
    const sizeConfig = SIZE_STYLES[size]
    const iconName = icon === false ? null : (icon ?? config.defaultIcon)

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full font-medium leading-none select-none transition-colors',
                config.style,
                sizeConfig.badge,
                className
            )}
            {...props}
        >
            {iconName && <MaterialIcon name={iconName} size={sizeConfig.iconSize} />}
            {children}
        </span>
    )
}