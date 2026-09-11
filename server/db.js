import pg from 'pg';

// Return dates and naive date-times exactly in the string shapes the client
// compares lexicographically ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm").
pg.types.setTypeParser(1082, (v) => v); // date
pg.types.setTypeParser(1114, (v) => {   // timestamp without time zone
  const [day, time = '00:00:00'] = v.split(' ');
  const hms = time.split('.')[0];
  return `${day}T${hms.endsWith(':00') ? hms.slice(0, 5) : hms}`;
});
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

function sslFor(url) {
  if (/sslmode=disable/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url)) return false;
  if (/sslmode=(require|verify)/.test(url)) return { rejectUnauthorized: false };
  return false;
}

export const pool = new pg.Pool({
  connectionString,
  ssl: sslFor(connectionString),
  max: Number(process.env.PG_POOL_MAX || 10),
});

pool.on('error', (err) => {
  console.error('[db] idle client error', err);
});

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
