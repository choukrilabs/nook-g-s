import React from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/[0.06]',
        className
      )}
      {...props}
    />
  )
}

export const ClientCardSkeleton: React.FC = () => {
  return (
    <div className="glass border border-white/5 rounded-3xl p-5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="space-y-2">
          <Skeleton className="w-32 h-4 rounded-full" />
          <Skeleton className="w-20 h-3 rounded-full" />
        </div>
      </div>
      <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
    </div>
  )
}

export const SessionCardSkeleton: React.FC = () => {
  return (
    <div className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-3 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="w-36 h-4 rounded-full" />
          <div className="flex items-center gap-2">
            <Skeleton className="w-16 h-3 rounded-full" />
            <Skeleton className="w-12 h-3 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-4 h-4 rounded-full shrink-0" />
      </div>
    </div>
  )
}

export const StatCardSkeleton: React.FC = () => {
  return (
    <div className="glass border border-white/5 p-5 rounded-3xl relative overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-6 h-6 rounded-lg" />
          <Skeleton className="w-16 h-2.5 rounded-full" />
        </div>
        <Skeleton className="w-24 h-6 rounded-full" />
      </div>
    </div>
  )
}
