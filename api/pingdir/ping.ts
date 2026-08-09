export default function handler(req: any, res: any) {
  res.json({ ok: true, where: 'api/pingdir/ping.ts (subdir of api/)' });
}
