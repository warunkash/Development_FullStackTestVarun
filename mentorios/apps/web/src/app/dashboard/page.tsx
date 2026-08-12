'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpFromLine, Link2, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { VideoCard } from '@/components/video/VideoCard'
import { useVideos, useIngestUrl } from '@/hooks/use-videos'

export default function DashboardPage() {
  const [url, setUrl] = useState('')
  const [isIngesting, setIsIngesting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { data: videos, isLoading } = useVideos()
  const ingestMutation = useIngestUrl()

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsIngesting(true)
    try {
      const video = await ingestMutation.mutateAsync(url.trim())
      toast({
        title: 'Video queued for analysis',
        description: `"${video.title || url}" will be processed shortly.`,
      })
      setUrl('')
      router.push(`/dashboard/videos/${video.id}`)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to ingest video',
        description: err?.message || 'Please check the URL and try again.',
      })
    } finally {
      setIsIngesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Analyze videos and explore extracted wisdom
          </p>
        </div>

        {/* Ingest */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Analyze a Video
            </CardTitle>
            <CardDescription>
              Paste a YouTube URL to start automatic wisdom extraction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIngest} className="flex gap-3">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={isIngesting || !url.trim()}>
                {isIngesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Queuing...
                  </>
                ) : (
                  'Analyze'
                )}
              </Button>
            </form>

            <div className="mt-4 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="mt-4">
              <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/50 transition-colors">
                <ArrowUpFromLine className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Upload video file</span>
                <span className="text-xs text-muted-foreground">MP4, MOV, AVI up to 5GB</span>
                <input type="file" accept="video/*" className="hidden" />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Video List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Analyzed Videos</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : videos?.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">
                No videos analyzed yet. Paste a YouTube URL above to get started.
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {videos?.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
