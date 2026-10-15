import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
}

function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const password = authHeader.replace('Bearer ', '');
  return password === ADMIN_PASSWORD;
}

// GET: List active rooms and participants
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const svc = new RoomServiceClient(getHttpUrl(LIVEKIT_URL), API_KEY, API_SECRET);
    const rooms = await svc.listRooms();

    const roomsWithParticipants = await Promise.all(
      rooms.map(async (room) => {
        const participants = await svc.listParticipants(room.name);
        return {
          name: room.name,
          sid: room.sid,
          numParticipants: room.numParticipants,
          creationTime: Number(room.creationTime),
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
              isSpeaking: p.isSpeaking,
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
  if (!verifyAdmin(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, roomName, identity } = body;
    const svc = new RoomServiceClient(getHttpUrl(LIVEKIT_URL), API_KEY, API_SECRET);

    switch (action) {
      case 'end_room': {
        await svc.deleteRoom(roomName);
        return NextResponse.json({ success: true, message: 'Room ended' });
      }

      case 'grant_speak': {
        await svc.updateParticipant(roomName, identity, undefined, {
          canPublish: true,
          canPublishData: true,
          canSubscribe: true,
        });
        // Update metadata to reflect moderator role
        const participants = await svc.listParticipants(roomName);
        const participant = participants.find((p) => p.identity === identity);
        if (participant) {
          let meta: Record<string, unknown> = {};
          try {
            meta = JSON.parse(participant.metadata || '{}');
          } catch {}
          meta.role = 'moderator';
          await svc.updateParticipant(roomName, identity, JSON.stringify(meta));
        }
        return NextResponse.json({ success: true, message: 'Speak permission granted' });
      }

      case 'revoke_speak': {
        await svc.updateParticipant(roomName, identity, undefined, {
          canPublish: false,
          canPublishData: true,
          canSubscribe: true,
        });
        // Update metadata back to listener
        const participantsList = await svc.listParticipants(roomName);
        const part = participantsList.find((p) => p.identity === identity);
        if (part) {
          let meta: Record<string, unknown> = {};
          try {
            meta = JSON.parse(part.metadata || '{}');
          } catch {}
          meta.role = 'listener';
          await svc.updateParticipant(roomName, identity, JSON.stringify(meta));
        }
        return NextResponse.json({ success: true, message: 'Speak permission revoked' });
      }

      case 'remove_participant': {
        await svc.removeParticipant(roomName, identity);
        return NextResponse.json({ success: true, message: 'Participant removed' });
      }

      case 'mute_participant': {
        // Mute by revoking publish permission temporarily
        await svc.updateParticipant(roomName, identity, undefined, {
          canPublish: false,
          canPublishData: true,
          canSubscribe: true,
        });
        return NextResponse.json({ success: true, message: 'Participant muted' });
      }

      default:
        return new NextResponse('Unknown action', { status: 400 });
    }
  } catch (error) {
    console.error('Admin action error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
