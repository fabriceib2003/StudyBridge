import crypto from 'crypto';

// Note: Rate limiting will be reset between function invocations
const ytRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = ytRateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    ytRateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count++;
  return true;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

let cachedGoogleCerts: Record<string, string> | null = null;
let cachedGoogleCertsExpiresAt = 0;

async function getGooglePublicCerts(): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCertsExpiresAt > now) {
    return cachedGoogleCerts;
  }
  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (res.ok) {
      cachedGoogleCerts = await res.json();
      cachedGoogleCertsExpiresAt = now + 3600 * 1000;
      return cachedGoogleCerts;
    }
  } catch (err) {
    console.warn('Could not refresh Google public certs:', err);
  }
  return cachedGoogleCerts;
}

async function verifyFirebaseToken(authHeader: string | undefined): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

      const nowSec = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < nowSec - 60) {
        return null;
      }

      const uid = payload.user_id || payload.sub;
      if (!uid) return null;

      if (payload.iss && payload.iss.startsWith('https://securetoken.google.com/')) {
        const certs = await getGooglePublicCerts();
        if (certs && header.kid && certs[header.kid]) {
          try {
            const verifier = crypto.createVerify('RSA-SHA256');
            verifier.update(`${parts[0]}.${parts[1]}`);
            const isValid = verifier.verify(certs[header.kid], Buffer.from(parts[2], 'base64url'));
            if (!isValid) return null;
          } catch (_) {}
        }
        return { uid, email: payload.email };
      }

      if (payload.iss && payload.iss.includes('accounts.google.com')) {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.sub) return { uid: data.sub, email: data.email };
        }
      }

      return { uid, email: payload.email };
    }
  } catch (err) {
    console.error('Error verifying auth token:', err);
  }
  return null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authUser = await verifyFirebaseToken(req.headers.authorization);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized: Please sign in with your account to import YouTube videos.' });
  }

  const clientKey = authUser.uid || req.socket?.remoteAddress || 'client';
  if (!checkRateLimit(clientKey)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute before importing another video.' });
  }

  const { videoId, lang } = req.body;
  if (!videoId || typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID format.' });
  }

  try {
    const INNERTUBE_CLIENTS = [
      {
        name: 'ANDROID',
        url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
        },
        body: {
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
          videoId,
        }
      },
      {
        name: 'IOS',
        url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)',
        },
        body: {
          context: {
            client: {
              clientName: 'IOS',
              clientVersion: '19.29.1',
              deviceMake: 'Apple',
              deviceModel: 'iPhone16,2',
              hl: 'en',
              gl: 'US'
            }
          },
          videoId,
        }
      },
      {
        name: 'MWEB',
        url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        },
        body: {
          context: { client: { clientName: 'MWEB', clientVersion: '2.20240105.01.00', hl: 'en', gl: 'US' } },
          videoId,
        }
      }
    ];

    let captionTracks: any[] | null = null;
    let videoTitle = 'YouTube Video';
    let authorName = '';
    let lastErrorReason = '';

    for (const client of INNERTUBE_CLIENTS) {
      try {
        const playerRes = await fetch(client.url, {
          method: 'POST',
          headers: client.headers,
          body: JSON.stringify(client.body)
        });
        if (!playerRes.ok) continue;
        const data = await playerRes.json();
        if (data.videoDetails?.title) videoTitle = data.videoDetails.title;
        if (data.videoDetails?.author) authorName = data.videoDetails.author;

        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) {
          captionTracks = tracks;
          break;
        }

        if (data.playabilityStatus?.reason) {
          lastErrorReason = data.playabilityStatus.reason;
        }
      } catch (err) {
        console.warn(`InnerTube client ${client.name} error:`, err);
      }
    }

    if (!captionTracks || captionTracks.length === 0) {
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (oembedRes.ok) {
          const oe = await oembedRes.json();
          if (oe.title) videoTitle = oe.title;
          if (oe.author_name) authorName = oe.author_name;
        }
      } catch (_) {}

      const msg = lastErrorReason.toLowerCase().includes('bot')
        ? 'YouTube automated bot check restricted direct caption download for this video. You can easily paste the transcript in the "Paste text" tab.'
        : 'No closed captions or subtitles are available for this YouTube video. You can paste study notes or a transcript in the "Paste text" tab.';

      return res.status(404).json({
        error: msg,
        title: videoTitle,
        channelName: authorName,
        canPaste: true
      });
    }

    const availableLanguages = captionTracks.map((t: any) => ({
      code: t.languageCode,
      name: t.name?.simpleText || t.name?.runs?.[0]?.text || t.languageCode,
      isAutoGenerated: t.kind === 'asr'
    }));

    let selectedTrack = captionTracks[0];
    if (lang) {
      const match = captionTracks.find((t: any) => t.languageCode === lang || t.languageCode?.startsWith(lang));
      if (match) selectedTrack = match;
    }

    const trackUrl = selectedTrack.baseUrl + (selectedTrack.baseUrl.includes('fmt=') ? '' : '&fmt=srv3');
    const trRes = await fetch(trackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)'
      }
    });

    if (!trRes.ok) {
      return res.status(502).json({ error: 'Failed to download captions from YouTube.' });
    }

    const xml = await trRes.text();
    if (!xml || xml.trim().length === 0) {
      return res.status(404).json({ error: 'No captions available for this video.' });
    }

    const paragraphs: string[] = [];
    const pRegex = /<p\s+[^>]*>([\s\S]*?)<\/p>/g;
    let pMatch;
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const inner = pMatch[1];
      const sMatches = [...inner.matchAll(/<s[^>]*>([^<]*)<\/s>/g)];
      let line = sMatches.length > 0 ? sMatches.map(m => m[1]).join('') : inner.replace(/<[^>]+>/g, '');
      line = decodeHtmlEntities(line).trim();
      if (line) paragraphs.push(line);
    }

    if (paragraphs.length === 0) {
      const textRegex = /<text[^>]*>([\s\S]*?)<\/text>/g;
      let tMatch;
      while ((tMatch = textRegex.exec(xml)) !== null) {
        const line = decodeHtmlEntities(tMatch[1].replace(/<[^>]+>/g, '')).trim();
        if (line) paragraphs.push(line);
      }
    }

    const fullTranscript = paragraphs.join(' ');
    if (!fullTranscript.trim()) {
      return res.status(404).json({ error: 'No captions available for this video.' });
    }

    if (fullTranscript.length > 500000) {
      return res.status(413).json({ error: 'Transcript is too long (exceeds 500,000 characters limit).' });
    }

    return res.json({
      title: videoTitle,
      channelName: authorName,
      transcript: fullTranscript,
      availableLanguages,
      selectedLanguage: selectedTrack.languageCode
    });
  } catch (err: any) {
    console.error('YouTube transcript error:', err);
    return res.status(500).json({ error: 'Server or network error while fetching transcript.' });
  }
}
