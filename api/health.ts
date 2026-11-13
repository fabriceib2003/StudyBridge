export default function handler(req: any, res: any) {
  res.json({ status: 'ok', time: Date.now() });
}
