// Server-Sent Events hub. Replaces Firestore's onSnapshot: after every commit
// the server tells connected browsers which collections changed, and they
// refetch those. The app runs as a single instance, so in-process fan-out is enough.

const clients = new Set();

export function eventsHandler(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  clients.add(res);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

export function broadcast(collections) {
  const list = [...collections];
  if (list.length === 0) return;
  const payload = `event: change\ndata: ${JSON.stringify({ collections: list })}\n\n`;
  for (const res of clients) res.write(payload);
}
