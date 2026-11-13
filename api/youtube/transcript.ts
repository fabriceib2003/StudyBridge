import { auth } from '../firebaseAdmin';

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split('Bearer ')[1]?.trim();

  let uid: string;
  try {
    if (!auth) {
      return res.status(500).json({ error: 'Server authentication configuration missing' });
    }
    const decodedToken = await auth.verifyIdToken(token);
    uid = decodedToken.uid;
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const clientKey = uid || req.socket.remoteAddress || 'client';
  if (!checkRateLimit(clientKey)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const { videoId, lang } = req.body;
  if (!videoId || typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: 'Invalid YouTube video ID format.' });
  }

  try {
    const INNERTUBE_CLIENT_VERSION = '20.10.38';
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `com.google.android.youtube/${INNERTUBE_CLIENT_VERSION} (Linux; U; Android 14)`,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: INNERTUBE_CLIENT_VERSION,
          },
        },
        videoId,
      }),
    });

    if (!playerRes.ok) {
      return res.status(502).json({ error: 'Server or network error.' });
    }

    const data = await playerRes.json();
    const playability = data?.playabilityStatus;
    if (playability && playability.status !== 'OK') {
      return res.status(403).json({ error: 'Video unavailable.' });
    }

    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captionTracks || !Array.isArray(captionTracks) || captionTracks.length === 0) {
      return res.status(404).json({ error: 'No captions available.' });
    }

    let selectedTrack = captionTracks[0];
    if (lang) {
      const match = captionTracks.find((t: any) => t.languageCode === lang || t.languageCode?.startsWith(lang));
      if (match) selectedTrack = match;
    }

    const trackUrl = selectedTrack.baseUrl + (selectedTrack.baseUrl.includes('fmt=') ? '' : '&fmt=srv3');
    const trRes = await fetch(trackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!trRes.ok) {
      return res.status(502).json({ error: 'Failed to download captions.' });
    }

    const xml = await trRes.text();
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
    
    if (fullTranscript.length > 500000) {
      return res.status(413).json({ error: 'Transcript too long.' });
    }

    return res.json({
      title: data.videoDetails?.title || 'YouTube Video',
      channelName: data.videoDetails?.author || '',
      transcript: fullTranscript
    });
  } catch (err: any) {
    console.error('YouTube transcript error:', err);
    return res.status(500).json({ error: 'Server or network error.' });
  }
}
