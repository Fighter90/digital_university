// DIG-12 — API surface of the isolation contract (pattern for the future
// ICS / PDF / AI-chat feeds): same data layer, same uniform 404 for a foreign
// and a missing request. Nothing owner-scoped ever leaves this check.
import {
  requireDataCtx,
  getRequestByNumber,
  normalizeRequestNumber,
  uniformNotFoundResponse,
} from '@/server/data';
import { dataDb } from '@/server/data/db';

export async function GET(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number: rawNumber } = await params;
  const ctx = await requireDataCtx(`/api/requests/${rawNumber}`);

  const request = await getRequestByNumber(
    dataDb,
    ctx,
    normalizeRequestNumber(decodeURIComponent(rawNumber)),
  );
  if (!request) return uniformNotFoundResponse();

  return Response.json(request);
}
