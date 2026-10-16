import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';
import { verifyAdminToken } from '@/lib/adminAuth';
import { validateRoomName } from '@/lib/validation';

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
}

// Basic in-memory rate limiting for the admin endpoint.
// TODO: For production, replace with a Redis-based rate limiter that works
// across multiple server instances and survives restarts.
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * Verify admin access via either:
 * 1. Room-scoped HMAC token (used by in-meeting host controls) - preferred
 * 2. Raw admin password (used by the admin dashboard page) - fallback
 */
function verifyAdmin(request: NextRequest, roomName: string): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const token = authHeader.replace('Bearer ', '');

  // Try HMAC verification first (room-scoped, time-limited)
  if (roomName && verifyAdminToken(token, roomName)) {
    return true;
  }

  // Fallback: raw password check for the admin dashboard
  // The admin dashboard is already behind NextAuth middleware (/admin/:path*)
  return token === ADMIN_PASSWORD;
}

// GET: List active rooms and participants
export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  // For GET (listing rooms), accept either HMAC for a specific room or raw password for dashboard
  const roomName = request.nextUrl.searchParams.get('roomName') || '';
  if (!verifyAdmin(request, roomName)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const svc = new RoomServiceClient(getHttpUrl(LIVEKIT_URL), API_KEY, API_SECRET);
    const allRooms = await svc.listRooms();

    // Filter out ended (tombstone) rooms
    const rooms = allRooms.filter((room) => {
      try {
        const meta = JSON.parse(room.metadata || '{}');
        return meta.ended !== true;
      } catch {
        return true;
      }
    });

    const roomsWithParticipants = await Promise.all(
      rooms.map(async (room) => {
        const participants = await svc.listParticipants(room.name);
        return {
          name: room.name,
          sid: room.sid,
          numParticipants: room.numParticipants,
          creationTime: Number(room.creationTime),
          metadata: room.metadata || '',
          participants: participants.map((p) => {
            let role = 'listener';
            try {
              const meta = JSON.parse(p.metadata || '{}');
              role = meta.role || 'listener';
            } catch {}
            return {
              identity: p.identity,
              name: p.name,
              sid: p.sid,
              role,
              isSpeaking: (p as any).isSpeaking ?? false,
              joinedAt: Number(p.joinedAt),
              canPublish: p.permission?.canPublish ?? false,
            };
          }),
        };
      }),
    );

    return NextResponse.json({ rooms: roomsWithParticipants });
  } catch (error) {
    console.error('Admin API error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}

// POST: Admin actions (create room, end room, etc.)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (isRateLimited(ip)) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  try {
    const body = await request.json();
    const { action, roomName, identity } = body;

    // Validate roomName
    if (!validateRoomName(roomName)) {
      return new NextResponse('Invalid roomName', { status: 400 });
    }

    // Verify admin token is valid for this specific room
    if (!verifyAdmin(request, roomName)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const svc = new RoomServiceClient(getHttpUrl(LIVEKIT_URL), API_KEY, API_SECRET);

    switch (action) {
      case 'end_room': {
        // 1. Mark room as ended in metadata
        try {
          let existingMeta: Record<string, unknown> = {};
          const rooms = await svc.listRooms([roomName]);
          const target = rooms.find((r) => r.name === roomName);
          if (target?.metadata) {
            try { existingMeta = JSON.parse(target.metadata); } catch {}
          }
          existingMeta.ended = true;
          existingMeta.endedAt = Date.now();
          await svc.updateRoomMetadata(roomName, JSON.stringify(existingMeta));
        } catch (err) {
          console.error('Error setting ended metadata:', err);
        }

        // 2. Kick all participants (they get disconnected)
        try {
          const parts = await svc.listParticipants(roomName);
          await Promise.all(parts.map((p) => svc.removeParticipant(roomName, p.identity)));
        } catch {}

        return NextResponse.json({ success: true, message: 'Room ended' });
      }

      case 'grant_speak': {
        // Get current metadata first, then update both in one call
        const participants = await svc.listParticipants(roomName);
        const participant = participants.find((p) => p.identity === identity);
        let grantMeta: Record<string, unknown> = {};
        if (participant) {
          try { grantMeta = JSON.parse(participant.metadata || '{}'); } catch {}
        }
        grantMeta.role = 'moderator';
        await svc.updateParticipant(roomName, identity, {
          metadata: JSON.stringify(grantMeta),
          permission: {
            canPublish: true,
            canPublishData: true,
            canSubscribe: true,
          },
        });
        return NextResponse.json({ success: true, message: 'Speak permission granted' });
      }

      case 'revoke_speak': {
        const participantsList = await svc.listParticipants(roomName);
        const part = participantsList.find((p) => p.identity === identity);
        let revokeMeta: Record<string, unknown> = {};
        if (part) {
          try { revokeMeta = JSON.parse(part.metadata || '{}'); } catch {}
        }
        revokeMeta.role = 'listener';
        await svc.updateParticipant(roomName, identity, {
          metadata: JSON.stringify(revokeMeta),
          permission: {
            canPublish: false,
            canPublishData: true,
            canSubscribe: true,
          },
        });
        return NextResponse.json({ success: true, message: 'Speak permission revoked' });
      }

      case 'remove_participant': {
        await svc.removeParticipant(roomName, identity);
        return NextResponse.json({ success: true, message: 'Participant removed' });
      }

      case 'make_host': {
        const hostList = await svc.listParticipants(roomName);
        const hostTarget = hostList.find((p) => p.identity === identity);
        let hostMeta: Record<string, unknown> = {};
        if (hostTarget) {
          try { hostMeta = JSON.parse(hostTarget.metadata || '{}'); } catch {}
        }
        hostMeta.role = 'host';
        await svc.updateParticipant(roomName, identity, {
          metadata: JSON.stringify(hostMeta),
          permission: {
            canPublish: true,
            canPublishData: true,
            canSubscribe: true,
          },
        });

        // Save this user's name to room metadata hosts list for auto-rejoin as host
        const participantName = hostTarget?.name || identity.split('__')[0];
        try {
          const rooms = await svc.listRooms([roomName]);
          if (rooms.length > 0) {
            let roomMeta: Record<string, unknown> = {};
            try { roomMeta = JSON.parse(rooms[0].metadata || '{}'); } catch {}
            const hosts: string[] = Array.isArray(roomMeta.hosts) ? roomMeta.hosts as string[] : [];
            if (!hosts.includes(participantName)) {
              hosts.push(participantName);
            }
            roomMeta.hosts = hosts;
            await svc.updateRoomMetadata(roomName, JSON.stringify(roomMeta));
          }
        } catch {}

        return NextResponse.json({ success: true, message: 'Host permission granted' });
      }

      case 'mute_participant': {
        await svc.updateParticipant(roomName, identity, {
          permission: {
            canPublish: false,
            canPublishData: true,
            canSubscribe: true,
          },
        });
        return NextResponse.json({ success: true, message: 'Participant muted' });
      }

      case 'unmute_all': {
        const allParts = await svc.listParticipants(roomName);
        let unmutedCount = 0;
        await Promise.all(
          allParts.map(async (p) => {
            let meta: Record<string, unknown> = {};
            try { meta = JSON.parse(p.metadata || '{}'); } catch {}
            // Skip hosts — they already have publish rights
            if (meta.role === 'host') return;
            meta.role = 'moderator';
            await svc.updateParticipant(roomName, p.identity, {
              metadata: JSON.stringify(meta),
              permission: {
                canPublish: true,
                canPublishData: true,
                canSubscribe: true,
              },
            });
            unmutedCount++;
          }),
        );
        return NextResponse.json({ success: true, message: `Unmuted all (${unmutedCount} participants)` });
      }

      case 'mute_all': {
        const allPartsMute = await svc.listParticipants(roomName);
        let mutedCount = 0;
        await Promise.all(
          allPartsMute.map(async (p) => {
            let meta: Record<string, unknown> = {};
            try { meta = JSON.parse(p.metadata || '{}'); } catch {}
            // Skip hosts — don't mute hosts
            if (meta.role === 'host') return;
            meta.role = 'listener';
            await svc.updateParticipant(roomName, p.identity, {
              metadata: JSON.stringify(meta),
              permission: {
                canPublish: false,
                canPublishData: true,
                canSubscribe: true,
              },
            });
            mutedCount++;
          }),
        );
        return NextResponse.json({ success: true, message: `Muted all (${mutedCount} participants)` });
      }

      case 'create_room': {
        const { meetingTitle } = body;
        await svc.createRoom({ name: roomName });
        // Set metadata separately (createRoom doesn't support metadata field)
        if (meetingTitle) {
          await svc.updateRoomMetadata(roomName, JSON.stringify({ title: meetingTitle }));
        }
        return NextResponse.json({ success: true, message: 'Room created', roomName });
      }

      default:
        return new NextResponse('Unknown action', { status: 400 });
    }
  } catch (error) {
    console.error('Admin action error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
