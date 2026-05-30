import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Video {
  id: string
  title: string | null
  source: 'youtube' | 'upload' | 'url'
  source_url: string | null
  status: string
  duration_seconds: number | null
  thumbnail_url: string | null
  created_at: string
}

export function useVideos(params?: { status?: string; mentor_id?: string }) {
  return useQuery({
    queryKey: ['videos', params],
    queryFn: () => api.get<Video[]>('/videos', { params }),
  })
}

export function useVideo(videoId: string | null) {
  return useQuery({
    queryKey: ['videos', videoId],
    queryFn: () => api.get<Video>(`/videos/${videoId}`),
    enabled: !!videoId,
  })
}

export function useVideoStatus(videoId: string | null) {
  return useQuery({
    queryKey: ['videos', videoId, 'status'],
    queryFn: () => api.get<{ status: string; progress: number; current_step: string | null }>(`/videos/${videoId}/status`),
    enabled: !!videoId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 2000
      const terminal = ['COMPLETE', 'FAILED', 'CANCELLED']
      return terminal.includes(data.status) ? false : 2000
    },
  })
}

export function useIngestUrl() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (url: string) => {
      return api.post<Video>('/videos/ingest-url', { url })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] })
    },
  })
}

export function useVideoTimeline(videoId: string | null) {
  return useQuery({
    queryKey: ['wisdom', 'timeline', videoId],
    queryFn: () =>
      api.get<{
        video_id: string
        duration_seconds: number
        annotations: Array<{
          type: string
          start_time: number
          end_time: number
          title: string
          text: string
          confidence: number
          insight_id: string
        }>
      }>(`/wisdom/timeline/${videoId}`),
    enabled: !!videoId,
  })
}
