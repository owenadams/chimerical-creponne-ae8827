import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = 'Search by title, author...' }: SearchBarProps) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 pr-4 pl-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
        autoFocus
      />
    </div>
  )
}
