import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function EmployeeAvatar({ photo, name, className = '' }: { photo: string | null | undefined; name: string; className?: string }) {
  const [source, setSource] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    let objectUrl = ''
    if (!photo) { setSource(null); return }
    if (/^(https?:\/\/|blob:)/i.test(photo)) { setSource(photo); return }
    void api.download(photo).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    }).catch(() => { if (active) setSource(null) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [photo])
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'U'
  return <span className={`employee-avatar-photo ${className}`} aria-label={name}>
    {source ? <img src={source} alt="" /> : <span aria-hidden="true">{initials}</span>}
  </span>
}
