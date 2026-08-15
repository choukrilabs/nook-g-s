import { motion, AnimatePresence } from 'motion/react'
import { CircleCheck as CheckCircle, Circle as XCircle, TriangleAlert as AlertTriangle, Info, X } from 'lucide-react'
import { useUIStore, Toast as ToastType } from '../../stores/uiStore'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const Toast = ({ toast }: { toast: ToastType }) => {
  const removeToast = useUIStore((state) => state.removeToast)

  const icons = {
    success: <CheckCircle className="text-success" size={18} />,
    error: <XCircle className="text-error" size={18} />,
    warning: <AlertTriangle className="text-warning" size={18} />,
    info: <Info className="text-info" size={18} />,
  }

  const borders = {
    success: 'border-l-success',
    error: 'border-l-error',
    warning: 'border-l-warning',
    info: 'border-l-info',
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-surface2 border border-border border-l-4 rounded-xl shadow-2xl min-w-[280px] max-w-[400px]',
        borders[toast.type]
      )}
    >
      <div className="flex-shrink-0">{icons[toast.type]}</div>
      <p className="flex-grow text-sm font-medium text-text pe-2">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 text-text3 hover:text-text transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  )
}

export const ToastContainer = () => {
  const toasts = useUIStore((state) => state.toasts)

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast toast={toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
