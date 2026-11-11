import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatTimestamp(seconds: number): string {
  return formatDuration(Math.round(seconds))
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    QUEUED: 'text-muted-foreground',
    DOWNLOADING: 'text-blue-400',
    TRANSCRIBING: 'text-blue-400',
    ANALYZING_VISION: 'text-yellow-400',
    DETECTING_ACTIONS: 'text-yellow-400',
    GENERATING_WISDOM: 'text-amber-400',
    BUILDING_GRAPH: 'text-amber-400',
    COMPLETE: 'text-green-400',
    FAILED: 'text-red-400',
    CANCELLED: 'text-muted-foreground',
  }
  return colors[status] ?? 'text-muted-foreground'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    QUEUED: 'Queued',
    DOWNLOADING: 'Downloading',
    TRANSCRIBING: 'Transcribing',
    ANALYZING_VISION: 'Analyzing visuals',
    DETECTING_ACTIONS: 'Detecting actions',
    GENERATING_WISDOM: 'Extracting wisdom',
    BUILDING_GRAPH: 'Building knowledge graph',
    COMPLETE: 'Complete',
    FAILED: 'Failed',
    CANCELLED: 'Cancelled',
  }
  return labels[status] ?? status
}

export function getPrincipleColor(tier: number): string {
  const colors = { 1: 'amber', 2: 'sky', 3: 'purple' }
  return colors[tier as keyof typeof colors] ?? 'amber'
}
