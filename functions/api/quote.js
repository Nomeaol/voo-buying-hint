export async function onRequestGet(context) {
  const apiKey = context.env.ALPHA_VANTAGE_KEY;

  if (!apiKey) {
    return Response.json(
      { error: 'ALPHA_VANTAGE_KEY is not configured.' },
      { status: 500 }
    );
  }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=VOO&apikey=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    return Response.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch quote: ' + err.message },
      { status: 502 }
    );
  }
}
