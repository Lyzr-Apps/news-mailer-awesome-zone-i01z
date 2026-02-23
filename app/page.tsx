'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import {
  listSchedules,
  getScheduleLogs,
  pauseSchedule,
  resumeSchedule,
  cronToHuman,
  type Schedule,
  type ExecutionLog
} from '@/lib/scheduler'
import parseLLMJson from '@/lib/jsonParser'
import {
  RiMailLine,
  RiMailSendLine,
  RiCheckLine,
  RiRefreshLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiSettings3Line,
  RiPlayLine,
  RiPauseLine,
  RiSendPlaneLine,
  RiNewspaperLine,
  RiCalendarScheduleLine,
  RiAlertLine,
  RiLoader4Line,
  RiFlowChart,
  RiRobotLine,
  RiSearchEyeLine,
  RiArrowRightLine,
  RiArrowDownLine
} from 'react-icons/ri'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DigestEntry {
  id: string
  timestamp: string
  subject: string
  recipient: string
  storiesCount: number
  workflowStatus: string
  emailSent: boolean
  source: 'manual' | 'scheduled'
  rawResponse?: any
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MANAGER_AGENT_ID = '699c700d46369d6f6bfe4685'
const RESEARCH_AGENT_ID = '699c6fecf75ee4297f34ba93'
const EMAIL_AGENT_ID = '699c6ffc0c7a75370303a727'
const SCHEDULE_ID = '699c7013399dfadeac38a77b'

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const SAMPLE_DIGESTS: DigestEntry[] = [
  {
    id: 'sample-1',
    timestamp: '2026-02-23T08:00:00Z',
    subject: 'AI News Digest: GPT-5 Rumors, DeepMind Breakthrough & More',
    recipient: 'reader@example.com',
    storiesCount: 7,
    workflowStatus: 'completed',
    emailSent: true,
    source: 'scheduled',
    rawResponse: {
      workflow_status: 'completed',
      research_completed: true,
      email_sent: true,
      recipient: 'reader@example.com',
      subject: 'AI News Digest: GPT-5 Rumors, DeepMind Breakthrough & More',
      stories_count: 7,
      timestamp: '2026-02-23T08:00:00Z'
    }
  },
  {
    id: 'sample-2',
    timestamp: '2026-02-23T07:50:00Z',
    subject: 'AI News Digest: Open-Source LLMs Surge, Regulation Updates',
    recipient: 'reader@example.com',
    storiesCount: 5,
    workflowStatus: 'completed',
    emailSent: true,
    source: 'scheduled',
    rawResponse: {
      workflow_status: 'completed',
      research_completed: true,
      email_sent: true,
      recipient: 'reader@example.com',
      subject: 'AI News Digest: Open-Source LLMs Surge, Regulation Updates',
      stories_count: 5,
      timestamp: '2026-02-23T07:50:00Z'
    }
  },
  {
    id: 'sample-3',
    timestamp: '2026-02-23T07:40:00Z',
    subject: 'AI News Digest: Robotics Milestone, New Training Methods',
    recipient: 'reader@example.com',
    storiesCount: 6,
    workflowStatus: 'completed',
    emailSent: true,
    source: 'manual',
    rawResponse: {
      workflow_status: 'completed',
      research_completed: true,
      email_sent: true,
      recipient: 'reader@example.com',
      subject: 'AI News Digest: Robotics Milestone, New Training Methods',
      stories_count: 6,
      timestamp: '2026-02-23T07:40:00Z'
    }
  },
  {
    id: 'sample-4',
    timestamp: '2026-02-22T18:00:00Z',
    subject: 'AI News Digest: Multimodal Models, Healthcare AI Wins',
    recipient: 'reader@example.com',
    storiesCount: 4,
    workflowStatus: 'completed',
    emailSent: true,
    source: 'scheduled',
    rawResponse: {
      workflow_status: 'completed',
      research_completed: true,
      email_sent: true,
      recipient: 'reader@example.com',
      subject: 'AI News Digest: Multimodal Models, Healthcare AI Wins',
      stories_count: 4,
      timestamp: '2026-02-22T18:00:00Z'
    }
  }
]

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: string): string {
  if (!ts) return '--'
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return ts
  }
}

function formatFullTimestamp(ts: string): string {
  if (!ts) return '--'
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return ts
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ---------------------------------------------------------------------------
// SkeletonCard
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-sm p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-3 w-24 bg-muted rounded-sm" />
          <div className="h-px w-4 bg-border" />
          <div className="h-3 w-48 bg-muted rounded-sm" />
        </div>
        <div className="h-5 w-12 bg-muted rounded-sm" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DigestCard
// ---------------------------------------------------------------------------

function DigestCard({
  digest,
  isExpanded,
  onToggle
}: {
  digest: DigestEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-card border border-border rounded-sm transition-all duration-200">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
            {formatTimestamp(digest.timestamp)}
          </span>
          <span className="text-muted-foreground hidden sm:inline">|</span>
          <span className="text-sm text-foreground truncate font-medium tracking-wide">
            {digest.subject || 'Untitled Digest'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {digest.emailSent ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-sm">
              <RiCheckLine className="w-3 h-3" />
              Sent
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-sm">
              Pending
            </span>
          )}
          {digest.source === 'manual' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs text-muted-foreground bg-muted rounded-sm">
              Manual
            </span>
          )}
          {isExpanded ? (
            <RiArrowUpSLine className="w-4 h-4 text-muted-foreground" />
          ) : (
            <RiArrowDownSLine className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs tracking-wide uppercase">Recipient</span>
              <p className="font-mono text-foreground mt-0.5 text-sm">{digest.recipient || '--'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs tracking-wide uppercase">Stories</span>
              <p className="text-foreground mt-0.5 text-sm font-medium">{digest.storiesCount}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs tracking-wide uppercase">Status</span>
              <p className="text-foreground mt-0.5 text-sm capitalize">{digest.workflowStatus || '--'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs tracking-wide uppercase">Timestamp</span>
              <p className="font-mono text-foreground mt-0.5 text-xs">{formatFullTimestamp(digest.timestamp)}</p>
            </div>
          </div>
          {digest.rawResponse && (
            <details className="mt-3">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                Raw response
              </summary>
              <pre className="mt-2 p-3 bg-background border border-border rounded-sm text-xs font-mono text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto">
                {JSON.stringify(digest.rawResponse, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Page() {
  // State
  const [recipientEmail, setRecipientEmail] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emailSaved, setEmailSaved] = useState(false)
  const [digests, setDigests] = useState<DigestEntry[]>([])
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [showSampleData, setShowSampleData] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load saved email from localStorage on mount
  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('digest_recipient_email')
      if (saved) {
        setRecipientEmail(saved)
        setEmailInput(saved)
        setEmailSaved(true)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  // Load schedule status
  const loadSchedule = useCallback(async () => {
    try {
      const result = await listSchedules({ agentId: MANAGER_AGENT_ID })
      if (result.success && Array.isArray(result.schedules)) {
        const found = result.schedules.find((s: Schedule) => s.id === SCHEDULE_ID)
        if (found) {
          setSchedule(found)
        } else if (result.schedules.length > 0) {
          setSchedule(result.schedules[0])
        }
      }
    } catch (err) {
      console.error('Failed to load schedule:', err)
    }
  }, [])

  // Load digest history from schedule logs
  const loadDigestHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    setHistoryError(null)
    try {
      const logsResult = await getScheduleLogs(SCHEDULE_ID, { limit: 50 })
      if (logsResult.success && Array.isArray(logsResult.executions)) {
        const entries: DigestEntry[] = logsResult.executions
          .filter((log: ExecutionLog) => log.success)
          .map((log: ExecutionLog) => {
            const parsed = parseLLMJson(log.response_output)
            return {
              id: log.id || `log-${log.executed_at}`,
              timestamp: log.executed_at || '',
              subject: parsed?.subject || parsed?.result?.subject || 'AI News Digest',
              recipient: parsed?.recipient || parsed?.result?.recipient || '',
              storiesCount: parsed?.stories_count ?? parsed?.result?.stories_count ?? 0,
              workflowStatus: parsed?.workflow_status || parsed?.result?.workflow_status || 'unknown',
              emailSent: parsed?.email_sent ?? parsed?.result?.email_sent ?? false,
              source: 'scheduled' as const,
              rawResponse: parsed
            }
          })
        setDigests(prev => {
          const manualDigests = prev.filter(d => d.source === 'manual')
          const combined = [...manualDigests, ...entries]
          return combined.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        })
      }
    } catch (err) {
      console.error('Failed to load digest history:', err)
      setHistoryError('Failed to load digest history')
    }
    setIsLoadingHistory(false)
  }, [])

  // Initial data load
  useEffect(() => {
    loadSchedule()
    loadDigestHistory()
  }, [loadSchedule, loadDigestHistory])

  // Polling for new digest entries
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      loadDigestHistory()
    }, 60000)
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [loadDigestHistory])

  // Save email handler
  const handleSaveEmail = useCallback(() => {
    if (!isValidEmail(emailInput)) return
    setRecipientEmail(emailInput)
    try {
      localStorage.setItem('digest_recipient_email', emailInput)
    } catch {
      // localStorage not available
    }
    setEmailSaved(true)
    setTimeout(() => setEmailSaved(false), 3000)
  }, [emailInput])

  // Send Now handler
  const handleSendNow = useCallback(async () => {
    if (!recipientEmail) {
      setSendError('Please configure a recipient email first')
      return
    }
    setIsSending(true)
    setSendError(null)
    setSendSuccess(null)
    setActiveAgentId(MANAGER_AGENT_ID)

    const result = await callAIAgent(
      `Search for the latest AI research breakthroughs, new papers, model releases, and industry developments. Then compose and send a curated HTML email digest to ${recipientEmail}`,
      MANAGER_AGENT_ID
    )

    if (result.success) {
      const parsed = parseLLMJson(result.response)
      const newDigest: DigestEntry = {
        id: `manual-${Date.now()}`,
        timestamp: parsed?.timestamp || parsed?.result?.timestamp || new Date().toISOString(),
        subject: parsed?.subject || parsed?.result?.subject || 'AI News Digest',
        recipient: parsed?.recipient || parsed?.result?.recipient || recipientEmail,
        storiesCount: parsed?.stories_count ?? parsed?.result?.stories_count ?? 0,
        workflowStatus: parsed?.workflow_status || parsed?.result?.workflow_status || 'completed',
        emailSent: parsed?.email_sent ?? parsed?.result?.email_sent ?? true,
        source: 'manual',
        rawResponse: parsed
      }
      setDigests(prev => [newDigest, ...prev])
      setSendSuccess('Digest sent successfully')
      setTimeout(() => setSendSuccess(null), 5000)
    } else {
      setSendError(result.error || 'Failed to send digest')
    }

    setIsSending(false)
    setActiveAgentId(null)
  }, [recipientEmail])

  // Schedule toggle handler
  const handleToggleSchedule = useCallback(async () => {
    if (!schedule) return
    setScheduleLoading(true)

    if (schedule.is_active) {
      await pauseSchedule(schedule.id)
    } else {
      await resumeSchedule(schedule.id)
    }

    // MUST refresh schedule list after toggle
    const refreshed = await listSchedules({ agentId: MANAGER_AGENT_ID })
    if (refreshed.success && Array.isArray(refreshed.schedules)) {
      const found = refreshed.schedules.find((s: Schedule) => s.id === SCHEDULE_ID)
      if (found) setSchedule(found)
      else if (refreshed.schedules.length > 0) setSchedule(refreshed.schedules[0])
    }

    setScheduleLoading(false)
  }, [schedule])

  // Determine which digests to show
  const displayDigests = showSampleData ? SAMPLE_DIGESTS : digests

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <RiLoader4Line className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RiNewspaperLine className="w-6 h-6 text-foreground" />
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-wide">AI News Digest</h1>
                <p className="text-xs text-muted-foreground tracking-wide mt-0.5">
                  Automated AI research summaries delivered to your inbox
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <span className="hidden sm:inline tracking-wide">Sample Data</span>
                <button
                  role="switch"
                  aria-checked={showSampleData}
                  onClick={() => setShowSampleData(prev => !prev)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-border transition-colors duration-200 ${showSampleData ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full transition-transform duration-200 ${showSampleData ? 'translate-x-4 bg-primary-foreground' : 'translate-x-0.5 bg-muted-foreground'}`}
                  />
                </button>
              </label>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Column: Digest History (70%) */}
            <div className="flex-1 lg:w-[70%] min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium tracking-wide text-foreground uppercase">
                  Digest History
                </h2>
                <button
                  onClick={() => loadDigestHistory()}
                  disabled={isLoadingHistory}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RiRefreshLine className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {historyError && !showSampleData && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-card border border-border rounded-sm text-sm text-muted-foreground">
                  <RiAlertLine className="w-4 h-4 shrink-0" />
                  <span>{historyError}</span>
                </div>
              )}

              {isLoadingHistory && !showSampleData && displayDigests.length === 0 ? (
                <div className="space-y-2">
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : displayDigests.length === 0 ? (
                <div className="bg-card border border-border rounded-sm p-8 text-center">
                  <RiMailLine className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-foreground font-medium mb-1">No digests sent yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Your first AI news summary will arrive shortly! Configure your email and activate the schedule, or send one manually.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                  {displayDigests.map(digest => (
                    <DigestCard
                      key={digest.id}
                      digest={digest}
                      isExpanded={expandedId === digest.id}
                      onToggle={() =>
                        setExpandedId(prev => (prev === digest.id ? null : digest.id))
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Configuration & Actions (30%) */}
            <div className="lg:w-[30%] lg:min-w-[300px] space-y-4">
              {/* Recipient Email */}
              <div className="bg-card border border-border rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RiMailSendLine className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-medium tracking-wide uppercase text-foreground">
                    Recipient Email
                  </h3>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 bg-input border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={handleSaveEmail}
                    disabled={!isValidEmail(emailInput)}
                    className="px-3 py-2 bg-secondary text-secondary-foreground rounded-sm text-xs font-medium hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Save
                  </button>
                </div>
                {emailSaved && (
                  <p className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <RiCheckLine className="w-3 h-3" />
                    Email saved
                  </p>
                )}
                {recipientEmail && !emailSaved && (
                  <p className="mt-2 text-xs text-muted-foreground font-mono truncate">
                    Current: {recipientEmail}
                  </p>
                )}
              </div>

              {/* Schedule Control */}
              <div className="bg-card border border-border rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RiCalendarScheduleLine className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-medium tracking-wide uppercase text-foreground">
                    Schedule
                  </h3>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tracking-wide">Frequency</span>
                    <span className="text-xs font-mono text-foreground px-2 py-0.5 bg-secondary rounded-sm">
                      {schedule?.cron_expression ? cronToHuman(schedule.cron_expression) : 'Every 10 minutes'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tracking-wide">Status</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-sm ${schedule?.is_active ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${schedule?.is_active ? 'bg-foreground' : 'bg-muted-foreground'}`} />
                      {schedule?.is_active ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  {schedule?.is_active && schedule?.next_run_time && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground tracking-wide">Next run</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatTimestamp(schedule.next_run_time)}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleToggleSchedule}
                    disabled={scheduleLoading || !schedule}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors disabled:opacity-50 ${schedule?.is_active ? 'bg-secondary text-secondary-foreground hover:bg-accent' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
                  >
                    {scheduleLoading ? (
                      <RiLoader4Line className="w-4 h-4 animate-spin" />
                    ) : schedule?.is_active ? (
                      <>
                        <RiPauseLine className="w-4 h-4" />
                        Pause Schedule
                      </>
                    ) : (
                      <>
                        <RiPlayLine className="w-4 h-4" />
                        Activate Schedule
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Send Now */}
              <div className="bg-card border border-border rounded-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <RiSendPlaneLine className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-medium tracking-wide uppercase text-foreground">
                    Manual Send
                  </h3>
                </div>

                <button
                  onClick={handleSendNow}
                  disabled={isSending || !recipientEmail}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-sm text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <RiLoader4Line className="w-4 h-4 animate-spin" />
                      Generating digest...
                    </>
                  ) : (
                    <>
                      <RiMailSendLine className="w-4 h-4" />
                      Send Now
                    </>
                  )}
                </button>

                {!recipientEmail && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Configure a recipient email above first
                  </p>
                )}

                {sendError && (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-background border border-border rounded-sm">
                    <RiAlertLine className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">{sendError}</p>
                  </div>
                )}

                {sendSuccess && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-background border border-border rounded-sm">
                    <RiCheckLine className="w-3.5 h-3.5 shrink-0" />
                    <p className="text-xs text-foreground">{sendSuccess}</p>
                  </div>
                )}
              </div>

              {/* Gmail Status */}
              <div className="bg-card border border-border rounded-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <RiMailLine className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-medium tracking-wide uppercase text-foreground">
                    Gmail Integration
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-foreground" />
                  <span className="text-xs text-muted-foreground">Connected</span>
                </div>
              </div>

              {/* Agent Workflow */}
              <div className="bg-card border border-border rounded-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                  <RiFlowChart className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-xs font-medium tracking-wide uppercase text-foreground">
                    Agent Workflow
                  </h3>
                </div>

                {/* Workflow Visualization */}
                <div className="space-y-3">
                  {/* Input trigger */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-sm border border-border">
                    <RiPlayLine className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground tracking-wide">Scheduler / Send Now</span>
                  </div>

                  {/* Arrow down */}
                  <div className="flex justify-center">
                    <RiArrowDownLine className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Manager Agent - PROMINENT */}
                  <div className={`relative px-3 py-3 rounded-sm border-2 transition-all duration-300 ${
                    activeAgentId === MANAGER_AGENT_ID
                      ? 'border-foreground bg-accent'
                      : 'border-border bg-secondary'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <RiRobotLine className={`w-4 h-4 shrink-0 ${activeAgentId === MANAGER_AGENT_ID ? 'text-foreground animate-pulse' : 'text-foreground'}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground tracking-wide">AI News Coordinator</p>
                          <p className="text-xs text-muted-foreground font-mono">Manager Agent</p>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 text-[10px] font-mono bg-primary text-primary-foreground rounded-sm">
                        gpt-4.1
                      </span>
                    </div>
                    {activeAgentId === MANAGER_AGENT_ID && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <RiLoader4Line className="w-3 h-3 animate-spin text-foreground" />
                        <span className="text-xs text-foreground">Orchestrating workflow...</span>
                      </div>
                    )}
                  </div>

                  {/* Arrow down splitting to two */}
                  <div className="flex justify-center">
                    <div className="flex flex-col items-center">
                      <RiArrowDownLine className="w-4 h-4 text-muted-foreground" />
                      <div className="flex items-center gap-1 -mt-0.5">
                        <div className="w-[calc(50%-8px)] h-px bg-border" />
                        <div className="w-4" />
                        <div className="w-[calc(50%-8px)] h-px bg-border" />
                      </div>
                    </div>
                  </div>

                  {/* Sub-Agents side by side */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Research Agent */}
                    <div className={`px-2.5 py-2.5 rounded-sm border transition-all duration-300 ${
                      activeAgentId === MANAGER_AGENT_ID
                        ? 'border-border bg-accent/50'
                        : 'border-border bg-background'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <RiSearchEyeLine className={`w-3.5 h-3.5 shrink-0 ${activeAgentId === MANAGER_AGENT_ID ? 'text-foreground animate-pulse' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-medium text-foreground truncate">Research Agent</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">Perplexity sonar-pro</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Web search for AI news</p>
                    </div>

                    {/* Email Agent */}
                    <div className={`px-2.5 py-2.5 rounded-sm border transition-all duration-300 ${
                      activeAgentId === MANAGER_AGENT_ID
                        ? 'border-border bg-accent/50'
                        : 'border-border bg-background'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <RiMailSendLine className={`w-3.5 h-3.5 shrink-0 ${activeAgentId === MANAGER_AGENT_ID ? 'text-foreground animate-pulse' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-medium text-foreground truncate">Email Agent</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">OpenAI gpt-4.1</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Compose & send via Gmail</p>
                    </div>
                  </div>

                  {/* Arrow down */}
                  <div className="flex justify-center">
                    <RiArrowDownLine className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Output */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-sm border border-border">
                    <RiCheckLine className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground tracking-wide">Email Delivered</span>
                  </div>
                </div>

                {/* Agent IDs (collapsible) */}
                <details className="mt-3">
                  <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors tracking-wide">
                    Agent Details
                  </summary>
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Coordinator</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{MANAGER_AGENT_ID.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Research</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{RESEARCH_AGENT_ID.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">Email</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{EMAIL_AGENT_ID.slice(0, 8)}...</span>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
