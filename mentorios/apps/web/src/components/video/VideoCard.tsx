'use client'

import Link from 'next/link'
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn, formatDuration, getStatusColor, getStatusLabel } from '@/lib/utils'
import type { Video } from '@/hooks/use-videos'

interface VideoCardProps {
  video: Video
}

export function VideoCard({ video }: VideoCardProps) {
  const isProcessing = !['COMPLETE', 'FAILED', 'CANCELLED'].includes(video.status)

  return (
    <Link href={`/dashboard/videos/${video.id}`}>
      <Card className="group overflow-hidden hover:border-primary/40 transition-all duration-200 cursor-pointer">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted relative overflow-hidden">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title ?? 'Video'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="text-4xl mb-2">🎬</div>
                <p className="text-xs">Processing...</p>
              </div>
            </div>
          )}

          {/* Status overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {video.duration_seconds && (
            <div className="absolute bottom-2 right-2 bg-background/80 text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(video.duration_seconds)}
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-primary transition-colors">
            {video.title ?? video.source_url ?? 'Untitled'}
          </h3>

          <div className="flex items-center gap-2 mb-2">
            {video.status === 'COMPLETE' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
            {video.status === 'FAILED' && <XCircle className="h-4 w-4 text-red-400" />}
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
            <span className={cn('text-xs', getStatusColor(video.status))}>
              {getStatusLabel(video.status)}
            </span>
          </div>

          {isProcessing && (
            <Progress value={33} className="h-1" />
          )}

          <p className="text-xs text-muted-foreground mt-2">
            {new Date(video.created_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
