import { NextRequest, NextResponse } from 'next/server';
import { RoomServiceClient } from 'livekit-server-sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { validateRoomName } from '@/lib/validation';

const API_KEY = process.env.LIVEKIT_API_KEY!;
const API_SECRET = process.env.LIVEKIT_API_SECRET!;
const LIVEKIT_URL = process.env.LIVEKIT_URL!;

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
}

export async function POST(request: NextRequest) {
  try {
    // Verify the request comes from an authenticated user
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { roomName, identity, raised } = await request.json();

    if (!roomName || !identity) {
      return new NextResponse('Missing roomName or identity', { status: 400 });
    }

    if (!validateRoomName(roomName)) {
      return new NextResponse('Invalid roomName', { status: 400 });
    }

    const svc = new RoomServiceClient(getHttpUrl(LIVEKIT_URL), API_KEY, API_SECRET);
    const participants = await svc.listParticipants(roomName);
    const participant = participants.find((p) => p.identity === identity);

    if (!participant) {
      return new NextResponse('Participant not found', { status: 404 });
    }

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(participant.metadata || '{}');
    } catch {}

    meta.isHandRaised = !!raised;
    meta.handRaisedAt = raised ? Date.now() : undefined;

    await svc.updateParticipant(roomName, identity, JSON.stringify(meta));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Raise hand error:', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
