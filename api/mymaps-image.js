const ALLOWED_HOST = 'mymaps.usercontent.google.com';

export default async function handler(request, response) {
  const source = Array.isArray(request.query.url) ? request.query.url[0] : request.query.url;

  let url;
  try {
    url = new URL(String(source || ''));
  } catch {
    return response.status(400).json({ error: '画像URLが正しくありません。' });
  }

  if (url.protocol !== 'https:' || url.hostname !== ALLOWED_HOST) {
    return response.status(400).json({ error: 'Google My Mapsの画像だけを表示できます。' });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Smart Map Platform image importer',
        Referer: 'https://www.google.com/',
      },
    });

    if (!upstream.ok) {
      return response.status(upstream.status).json({ error: 'Google My Mapsから画像を取得できませんでした。' });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return response.status(502).json({ error: '画像として取得できませんでした。' });
    }

    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return response.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return response.status(502).json({ error: '画像の取得中に通信エラーが発生しました。' });
  }
}
