import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant, RoomServiceClient } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { generateAdminToken } from '@/lib/adminAuth';
import {
  validateRoomName,
  validateParticipantName,
  validateImageUrl,
  validateMetadataSize,
} from '@/lib/validation';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const COOKIE_KEY = 'random-participant-postfix';

function getHttpUrl(wsUrl: string): string {
  return wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
}

export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get('roomName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    let role = request.nextUrl.searchParams.get('role') ?? 'listener';
    const imageUrl = request.nextUrl.searchParams.get('imageUrl') ?? '';

    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not defined');
    }

    // Input validation
    if (!validateRoomName(roomName)) {
      return new NextResponse(
        'Invalid roomName: must be 1-100 characters, alphanumeric, dash, or underscore only',
        { status: 400 },
      );
    }
    if (!validateParticipantName(participantName)) {
      return new NextResponse(
        'Invalid participantName: must be 1-50 characters, alphanumeric and common name characters only',
        { status: 400 },
      );
    }
    if (!validateImageUrl(imageUrl)) {
      return new NextResponse('Invalid imageUrl: must be a valid https:// URL', { status: 400 });
    }
    if (!validateMetadataSize(metadata)) {
      return new NextResponse('Metadata too large: max 4096 bytes', { status: 400 });
    }

    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      throw new Error('Invalid region');
    }

    if (!randomParticipantPostfix) {
      randomParticipantPostfix = randomString(4);
    }

    // Server-side role validation: prevent role hijacking
    // If someone requests host role, check if the room already has a host
    if (role === 'host') {
      try {
        const svc = new RoomServiceClient(getHttpUrl(LIVEKIT_URL), API_KEY!, API_SECRET!);
        const rooms = await svc.listRooms([roomName!]);
        if (rooms.length > 0) {
          // Room exists - check if there's already a host
          const participants = await svc.listParticipants(roomName!);
          const existingHost = participants.find((p) => {
            try {
              const meta = JSON.parse(p.metadata || '{}');
              return meta.role === 'host';
            } catch {
              return false;
            }
          });
          if (existingHost) {
            // Room already has a host - downgrade to listener
            role = 'listener';
          }
        }
        // If room doesn't exist yet, allow the first host claim
      } catch (err) {
        // If we can't verify, err on the side of security - downgrade
        console.error('Error checking room for host:', err);
        role = 'listener';
      }
    }

    // Only allow known roles
    if (!['host', 'moderator', 'listener'].includes(role)) {
      role = 'listener';
    }

    // Build metadata with role and image
    const participantMetadata = JSON.stringify({
      role,
      imageUrl,
      ...(metadata ? JSON.parse(metadata) : {}),
    });

    const participantToken = await createParticipantToken(
      {
        identity: `${participantName}__${randomParticipantPostfix}`,
        name: participantName!,
        metadata: participantMetadata,
      },
      roomName!,
      role,
    );

    // Generate a room-scoped, time-limited HMAC token instead of raw password
    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: roomName!,
      participantToken: participantToken,
      participantName: participantName!,
      ...(role === 'host' ? { adminToken: generateAdminToken(roomName!) } : {}),
    };
    return new NextResponse(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  role: string,
) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = '5m';

  let grant: VideoGrant;

  if (role === 'host' || role === 'moderator') {
    // Host and moderators can publish audio and data, subscribe to everything
    grant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };
  } else {
    // Listeners can only subscribe (listen), cannot publish audio
    grant = {
      room: roomName,
      roomJoin: true,
      canPublish: false,
      canPublishData: true, // Allow data for raise hand, chat etc.
      canSubscribe: true,
    };
  }

  at.addGrant(grant);
  return at.toJwt();
}

function getCookieExpirationTime(): string {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
