import { NextResponse } from 'next/server'
import {
  syncDeviceSessions,
  type DeviceSessionPayload,
} from '@/lib/offline/background-sync-server'

const MAX_SESSIONS = 20
const MAX_LOGS = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asSession(value: unknown): DeviceSessionPayload | null {
  if (!isRecord(value)) return null
  const id = typeof value.id === 'string' ? value.id : ''
  const status = value.status
  if (!id) return null
  if (status !== 'in_progress' && status !== 'completed' && status !== 'cancelled') {
    return null
  }
  const logsRaw = Array.isArray(value.logs) ? value.logs.slice(0, MAX_LOGS) : []
  const logs = logsRaw.flatMap((log) => {
    if (!isRecord(log) || typeof log.id !== 'string' || typeof log.liftTypeId !== 'string') {
      return []
    }
    return [
      {
        id: log.id,
        liftTypeId: log.liftTypeId,
        setNumber: Number(log.setNumber) || 0,
        weight: Number(log.weight) || 0,
        reps: Number(log.reps) || 0,
        durationSeconds:
          log.durationSeconds == null ? null : Number(log.durationSeconds) || 0,
        isSkipped: Boolean(log.isSkipped),
        bodyweight: Boolean(log.bodyweight),
        loggedAt:
          typeof log.loggedAt === 'string' ? log.loggedAt : new Date().toISOString(),
      },
    ]
  })
  const prsRaw = Array.isArray(value.prs) ? value.prs : []
  const prs = prsRaw.flatMap((pr) => {
    if (!isRecord(pr) || typeof pr.liftTypeId !== 'string') return []
    return [
      {
        liftTypeId: pr.liftTypeId,
        weight: Number(pr.weight) || 0,
        reps: Number(pr.reps) || 0,
      },
    ]
  })
  return {
    id,
    splitId: typeof value.splitId === 'string' ? value.splitId : '',
    splitDayId: typeof value.splitDayId === 'string' ? value.splitDayId : '',
    status,
    startedAt:
      typeof value.startedAt === 'string' ? value.startedAt : new Date().toISOString(),
    finishedAt: typeof value.finishedAt === 'string' ? value.finishedAt : null,
    durationSeconds:
      value.durationSeconds == null ? null : Number(value.durationSeconds) || 0,
    logs,
    prs,
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: [], failed: [], error: 'Invalid body' }, { status: 400 })
  }
  const raw = isRecord(body) && Array.isArray(body.sessions) ? body.sessions : []
  const sessions = raw.slice(0, MAX_SESSIONS).flatMap((row) => {
    const session = asSession(row)
    return session ? [session] : []
  })
  if (sessions.length === 0) {
    return NextResponse.json({ ok: [], failed: [] })
  }
  const result = await syncDeviceSessions(sessions)
  if (result.unauthorized) {
    return NextResponse.json(result, { status: 401 })
  }
  const status = result.failed.length > 0 ? 207 : 200
  return NextResponse.json(result, { status })
}
