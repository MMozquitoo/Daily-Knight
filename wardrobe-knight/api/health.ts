export const config = {
  runtime: 'nodejs',
};

export function GET(): Response {
  return Response.json({ ok: true, service: 'wardrobe-knight' });
}
