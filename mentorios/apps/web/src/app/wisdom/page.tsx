'use client'

import { useState } from 'react'
import { Search, Filter, BookOpen, TrendingUp, Users, Heart, Rocket } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const PRINCIPLES = [
  { code: 'BL-AD', name: 'Adaptability', tier: 1, examples: 23 },
  { code: 'BL-FL', name: 'Flow', tier: 1, examples: 31 },
  { code: 'BL-TM', name: 'Timing', tier: 1, examples: 18 },
  { code: 'BL-IN', name: 'Interception', tier: 1, examples: 12 },
  { code: 'BL-EF', name: 'Efficiency', tier: 1, examples: 27 },
  { code: 'BL-DR', name: 'Directness', tier: 1, examples: 15 },
  { code: 'BL-AW', name: 'Awareness', tier: 2, examples: 19 },
  { code: 'BL-PO', name: 'Positioning', tier: 2, examples: 14 },
  { code: 'BL-SI', name: 'Simplicity', tier: 2, examples: 22 },
  { code: 'BL-NR', name: 'Non-Resistance', tier: 2, examples: 8 },
  { code: 'BL-PR', name: 'Presence', tier: 2, examples: 16 },
  { code: 'BL-SE', name: 'Self-Expression', tier: 3, examples: 11 },
  { code: 'BL-EC', name: 'Emotional Control', tier: 3, examples: 9 },
  { code: 'BL-CG', name: 'Continuous Growth', tier: 3, examples: 20 },
  { code: 'BL-DT', name: 'Detachment', tier: 3, examples: 7 },
]

const DOMAINS = [
  { id: 'business', label: 'Business', icon: Rocket },
  { id: 'investing', label: 'Investing', icon: TrendingUp },
  { id: 'leadership', label: 'Leadership', icon: Users },
  { id: 'relationships', label: 'Relationships', icon: Heart },
  { id: 'personal_growth', label: 'Growth', icon: BookOpen },
]

const SAMPLE_INSIGHTS = [
  {
    id: '1',
    title: 'The Flowing Stance Transition',
    insight: 'Bruce Lee demonstrates complete formlessness — shifting from aggressive to defensive positioning without any telegraphing motion, showing the principle of non-attachment to fixed form.',
    principles: ['BL-AD', 'BL-FL'],
    timestamp: '2:34',
    video: 'Bruce Lee Interview — Pierre Berton Show',
    confidence: 0.92,
    applications: {
      business: 'Pivot strategy without emotional attachment to the original plan. The best founders flow between approaches as market data demands.',
      investing: 'Position sizing should adapt to changing volatility regimes. Never become attached to a thesis that the market has invalidated.',
    },
  },
  {
    id: '2',
    title: 'The Intercepting Strike — Timing Mastery',
    insight: 'Rather than waiting for the opponent\'s punch to arrive, Bruce Lee launches his counter-strike during the opponent\'s commitment phase — demonstrating the principle of interception and timing superiority.',
    principles: ['BL-TM', 'BL-IN'],
    timestamp: '4:12',
    video: 'Jeet Kune Do Demonstration',
    confidence: 0.88,
    applications: {
      business: 'Anticipate competitor moves and position your product before the move completes. React to signals, not to fully formed threats.',
      investing: 'Enter positions when catalysts are forming, not after they\'ve been recognized by the market.',
    },
  },
  {
    id: '3',
    title: 'Economy of Motion in Teaching',
    insight: 'When demonstrating a technique, Bruce Lee eliminates all unnecessary preparatory movements. Each motion begins from where the previous one ended — pure efficiency in service of the goal.',
    principles: ['BL-EF', 'BL-DR'],
    timestamp: '7:45',
    video: 'Training Footage — 1969',
    confidence: 0.85,
    applications: {
      business: 'Design product flows that eliminate steps. Every click is a potential drop-off. Start from where the user already is.',
      leadership: 'Give instructions that are direct and complete. Eliminate preamble. Respect people\'s time with economy of words.',
    },
  },
]

export default function WisdomPage() {
  const [query, setQuery] = useState('')
  const [selectedPrinciple, setSelectedPrinciple] = useState<string | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  const filteredInsights = SAMPLE_INSIGHTS.filter((insight) => {
    if (query && !insight.title.toLowerCase().includes(query.toLowerCase()) &&
        !insight.insight.toLowerCase().includes(query.toLowerCase())) {
      return false
    }
    if (selectedPrinciple && !insight.principles.includes(selectedPrinciple)) {
      return false
    }
    if (selectedDomain && !insight.applications[selectedDomain as keyof typeof insight.applications]) {
      return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold mb-2">Wisdom Explorer</h1>
          <p className="text-muted-foreground">
            Browse {SAMPLE_INSIGHTS.length}+ insights extracted from Bruce Lee&apos;s videos
          </p>

          <div className="mt-6 flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search wisdom... 'adaptability', 'timing in business', 'flow'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 grid lg:grid-cols-[280px_1fr] gap-8">
        {/* Filters Sidebar */}
        <aside className="space-y-6">
          {/* Principles */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Filter by Principle</h3>
            <div className="space-y-1">
              {[1, 2, 3].map((tier) => (
                <div key={tier}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 mt-3">
                    Tier {tier}
                  </p>
                  {PRINCIPLES.filter((p) => p.tier === tier).map((p) => (
                    <button
                      key={p.code}
                      onClick={() => setSelectedPrinciple(selectedPrinciple === p.code ? null : p.code)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
                        selectedPrinciple === p.code
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs opacity-60">{p.examples}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Domains */}
          <div>
            <h3 className="font-semibold text-sm mb-3">Filter by Domain</h3>
            <div className="space-y-1">
              {DOMAINS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDomain(selectedDomain === d.id ? null : d.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    selectedDomain === d.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  <d.icon className="h-4 w-4" />
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Insights */}
        <main>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {filteredInsights.length} insights
              {selectedPrinciple && ` · ${PRINCIPLES.find((p) => p.code === selectedPrinciple)?.name}`}
              {selectedDomain && ` · ${DOMAINS.find((d) => d.id === selectedDomain)?.label}`}
            </p>
            {(selectedPrinciple || selectedDomain || query) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPrinciple(null)
                  setSelectedDomain(null)
                  setQuery('')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="space-y-6">
            {filteredInsights.map((insight) => (
              <div key={insight.id} className="wisdom-card group cursor-pointer">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                    {insight.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: `hsl(${insight.confidence * 120} 70% 50%)` }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {(insight.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Principles */}
                <div className="flex gap-2 mb-3">
                  {insight.principles.map((code) => {
                    const p = PRINCIPLES.find((pr) => pr.code === code)
                    return (
                      <span
                        key={code}
                        className={`principle-badge ${
                          p?.tier === 1 ? 'principle-t1' : p?.tier === 2 ? 'principle-t2' : 'principle-t3'
                        }`}
                      >
                        {code}
                      </span>
                    )
                  })}
                </div>

                {/* Insight */}
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {insight.insight}
                </p>

                {/* Applications */}
                {Object.entries(insight.applications).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(insight.applications)
                      .filter(([domain]) => !selectedDomain || domain === selectedDomain)
                      .map(([domain, text]) => {
                        const d = DOMAINS.find((x) => x.id === domain)
                        return (
                          <div key={domain} className="flex gap-2 p-3 rounded-md bg-muted/50">
                            {d && <d.icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                            <div>
                              <span className="text-xs font-medium text-primary capitalize">{domain}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}

                {/* Source */}
                <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{insight.video}</span>
                  <span>·</span>
                  <span>{insight.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
