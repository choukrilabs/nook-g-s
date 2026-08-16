import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useUIStore } from '../../stores/uiStore'
import { useTranslation } from '../../i18n'
import { StaffPermissions } from '../../types'

interface PermissionGateProps {
  children: React.ReactNode
  permission: keyof StaffPermissions
}

export function PermissionGate({ children, permission }: PermissionGateProps) {
  const { type, staff } = useAuthStore()
  const addToast = useUIStore((state) => state.addToast)
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    if (type === 'staff' && staff) {
      const perms = staff.permissions as unknown as StaffPermissions | null
      const hasPermission = !!perms?.[permission]
      if (!hasPermission) {
        addToast(t("common.access_denied"), 'error')
        navigate('/dashboard', { replace: true })
      }
    }
  }, [type, staff, permission, navigate, addToast, t])

  if (type === 'owner') {
    return <>{children}</>
  }

  if (type === 'staff' && staff) {
    const perms = staff.permissions as unknown as StaffPermissions | null
    const hasPermission = !!perms?.[permission]
    if (hasPermission) {
      return <>{children}</>
    }
  }

  return null
}
