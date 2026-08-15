import React, { InputHTMLAttributes, forwardRef } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  rightElement?: React.ReactNode
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, rightElement, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {icon && (
          <div className="absolute start-3.5 top-1/2 -translate-y-1/2 text-text3">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'input',
            icon && 'ps-11',
            rightElement && 'pe-11',
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute end-3.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
