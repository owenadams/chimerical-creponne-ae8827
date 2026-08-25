import { useState } from 'react'
import { BookOpen } from 'lucide-react'

interface BookCoverProps {
  coverUrl: string | null
  title: string
  className?: string
}

/** Book cover image with a graceful fallback when no cover is available or fails to load. */
export function BookCover({ coverUrl, title, className = '' }: BookCoverProps) {
  const [failed, setFailed] = useState(false)

  if (!coverUrl || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-800 text-slate-500 ${className}`}
        title={title}
      >
        <BookOpen className="h-8 w-8" />
      </div>
    )
  }

  return (
    <img
      src={coverUrl}
      alt={`Cover of ${title}`}
      loading="lazy"
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
