import { randomString } from '@/lib/client-utils';
import { getLiveKitURL } from '@/lib/getLiveKitURL';
import { ConnectionDetails } from '@/lib/types';
import { AccessToken, AccessTokenOptions, VideoGrant } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';

const COOKIE_KEY = 'random-participant-postfix';

export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get('roomName');
    const participantName = request.nextUrl.searchParams.get('participantName');
    const metadata = request.nextUrl.searchParams.get('metadata') ?? '';
    const region = request.nextUrl.searchParams.get('region');
    const role = request.nextUrl.searchParams.get('role') ?? 'listener';
    const imageUrl = request.nextUrl.searchParams.get('imageUrl') ?? '';

    if (!LIVEKIT_URL) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      throw new Error('Invalid region');
    }

    if (typeof roomName !== 'string') {
      return new NextResponse('Missing required query parameter: roomName', { status: 400 });
    }
    if (participantName === null) {
      return new NextResponse('Missing required query parameter: participantName', { status: 400 });
    }

    if (!randomParticipantPostfix) {
      randomParticipantPostfix = randomString(4);
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
        name: participantName,
        metadata: participantMetadata,
      },
      roomName,
      role,
    );

    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName: roomName,
      participantToken: participantToken,
      participantName: participantName,
      // Include admin token for hosts so they can manage participants from within the meeting
      ...(role === 'host' ? { adminToken: ADMIN_PASSWORD } : {}),
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
