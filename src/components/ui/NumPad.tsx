import { motion } from 'motion/react'
import { Delete, Check } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface NumPadProps {
  onPress: (val: string) => void
  onDelete: () => void
  onConfirm?: () => void
  showConfirm?: boolean
  className?: string
}

export const NumPad = ({ onPress, onDelete, onConfirm, showConfirm, className }: NumPadProps) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'confirm']

  return (
    <div dir="ltr" className={cn('grid grid-cols-3 gap-2.5', className)}>
      {keys.map((key) => {
        if (key === 'delete') {
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.92 }}
              onClick={onDelete}
              className="h-14 flex items-center justify-center bg-surface2 border border-border rounded-lg text-text2 hover:bg-white/5"
            >
              <Delete size={20} className="rtl:rotate-180" />
            </motion.button>
          )
        }
        if (key === 'confirm') {
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.92 }}
              onClick={onConfirm}
              disabled={!showConfirm}
              className={cn(
                'h-14 flex items-center justify-center bg-surface2 border border-border rounded-lg transition-all',
                showConfirm ? 'text-success bg-success-dim border-success/20' : 'text-text3 opacity-50'
              )}
            >
              <Check size={20} />
            </motion.button>
          )
        }
        return (
          <motion.button
            key={key}
            whileTap={{ scale: 0.92 }}
            onClick={() => onPress(key)}
            className="h-14 flex items-center justify-center bg-surface2 border border-border rounded-lg text-text font-mono text-xl font-semibold hover:bg-white/5"
          >
            {key}
          </motion.button>
        )
      })}
    </div>
  )
}
