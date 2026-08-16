import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

export const BottomSheet = ({ isOpen, onClose, title, children }: BottomSheetProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
            className="fixed bottom-0 inset-x-0 bg-surface border-t border-border rounded-t-[24px] z-[160] max-h-[90vh] overflow-y-auto pb-safe"
          >
            <div className="sticky top-0 bg-surface z-10 px-4 pt-3 pb-2">
              <div className="w-8 h-1 bg-border2 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                {title && <h3 className="text-lg font-bold text-text">{title}</h3>}
                <button
                  onClick={onClose}
                  className="p-2 text-text3 hover:text-text transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="px-4 pb-8">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
