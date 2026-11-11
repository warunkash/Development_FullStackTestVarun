'use client'

import Link from 'next/link'
import { ArrowRight, Brain, GitBranch, MessageCircle, Play, Search, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const PIPELINE_STEPS = [
  { label: 'Video Input', icon: Play, desc: 'YouTube URL or upload' },
  { label: 'Action Analysis', icon: Zap, desc: 'Pose, movement & scene detection' },
  { label: 'Intent Inference', icon: Brain, desc: 'LLM-powered intent extraction' },
  { label: 'Principle Mapping', icon: GitBranch, desc: 'Bruce Lee wisdom taxonomy' },
  { label: 'Wisdom Graph', icon: Search, desc: 'Neo4j knowledge graph' },
  { label: 'Mentor Chat', icon: MessageCircle, desc: 'Grounded conversational AI' },
]

const PRINCIPLES = [
  { code: 'BL-AD', name: 'Adaptability', tier: 1, quote: 'Empty your mind. Be formless, shapeless — like water.' },
  { code: 'BL-FL', name: 'Flow', tier: 1, quote: 'Water can flow or it can crash. Be water, my friend.' },
  { code: 'BL-TM', name: 'Timing', tier: 1, quote: 'To know when to do what — that is the supreme skill.' },
  { code: 'BL-EF', name: 'Efficiency', tier: 1, quote: 'Simplicity is the key to brilliance.' },
  { code: 'BL-PR', name: 'Presence', tier: 2, quote: 'If you spend too much time thinking about a thing, you\'ll never get it done.' },
  { code: 'BL-SE', name: 'Self-Expression', tier: 3, quote: 'Always be yourself, express yourself, have faith in yourself.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">MentorOS</span>
            <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
              Alpha
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/wisdom" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Wisdom Explorer
            </Link>
            <Link href="/chat" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Mentor Chat
            </Link>
            <Link href="/dashboard">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-primary font-medium">Human Wisdom Intelligence Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Every great action<br />
            <span className="wisdom-shimmer">carries a principle.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            MentorOS converts video of the world&apos;s greatest masters into structured,
            searchable wisdom — grounded in evidence, applicable across every domain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="gap-2 px-8">
                Analyze a Video
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/wisdom">
              <Button size="lg" variant="outline" className="gap-2 px-8">
                Explore Wisdom
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Pipeline Visualization */}
      <section className="py-24 px-6 border-t border-border">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How MentorOS Works</h2>
            <p className="text-muted-foreground">From raw video to actionable wisdom in minutes</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.label} className="relative">
                {i < PIPELINE_STEPS.length - 1 && (
                  <div className="absolute top-8 left-full w-4 h-0.5 bg-border z-10 hidden lg:block" />
                )}
                <Card className="p-4 text-center hover:border-primary/50 transition-colors cursor-default">
                  <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-xs font-semibold mb-1">{step.label}</div>
                  <div className="text-xs text-muted-foreground">{step.desc}</div>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles Grid */}
      <section className="py-24 px-6 bg-card/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Bruce Lee&apos;s Wisdom Taxonomy</h2>
            <p className="text-muted-foreground">
              15 core principles extracted from a lifetime of mastery
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRINCIPLES.map((p) => (
              <div key={p.code} className="wisdom-card group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`principle-badge ${
                      p.tier === 1 ? 'principle-t1' : p.tier === 2 ? 'principle-t2' : 'principle-t3'
                    }`}>
                      {p.code}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Tier {p.tier}</span>
                </div>
                <h3 className="font-bold text-lg mb-3 group-hover:text-primary transition-colors">
                  {p.name}
                </h3>
                <blockquote className="text-sm text-muted-foreground italic border-l border-primary/30 pl-3">
                  &ldquo;{p.quote}&rdquo;
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold mb-6">
            Start with Bruce Lee.<br />
            <span className="text-primary">Apply everywhere.</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Paste a YouTube URL and watch MentorOS extract principles, generate wisdom,
            and build a queryable knowledge graph — fully automated.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 px-10">
              Analyze Your First Video
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-sm text-muted-foreground">
        <p>MentorOS — Human Wisdom Intelligence Platform</p>
        <p className="mt-1 text-xs">Video → Action → Intent → Principle → Wisdom</p>
      </footer>
    </div>
  )
}
