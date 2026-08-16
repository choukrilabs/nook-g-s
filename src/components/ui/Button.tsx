import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'motion/react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ButtonProps extends Omit<HTMLMotionProps<"button">, 'children'> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | string
  isLoading?: boolean
  children?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'btn-primary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
      success: 'bg-success-dim border border-success/20 text-success rounded-lg h-11 px-4 flex items-center justify-center gap-2 transition-all hover:bg-success/20 active:bg-success/30 active:scale-97',
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        disabled={disabled || isLoading}
        className={cn(
          variants[variant],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          children
        )}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
