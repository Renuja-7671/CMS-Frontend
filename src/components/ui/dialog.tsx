import * as React from "react"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-2xl mx-4">
        {children}
      </div>
    </div>
  )
}

export function DialogContent({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-xl ${className}`}>
      {children}
    </div>
  )
}

export function DialogHeader({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-6 pb-4 ${className}`}>
      {children}
    </div>
  )
}

export function DialogTitle({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <h2 className={`text-xl font-semibold text-gray-900 ${className}`}>
      {children}
    </h2>
  )
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  )
}

export function DialogDescription({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`text-sm text-gray-600 ${className}`}>
      {children}
    </div>
  )
}

export function DialogFooter({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex justify-end gap-3 p-6 pt-4 border-t ${className}`}>
      {children}
    </div>
  )
}
