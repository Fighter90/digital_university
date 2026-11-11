// DIG-12 — the uniform 404 for API surfaces.
//
// A foreign object and a missing object MUST produce byte-identical answers
// (no existence oracle). API routes (and future ICS / PDF / AI-chat feeds)
// return THIS response for any denied lookup; pages answer with the shared
// app-wide not-found page (src/app/not-found.tsx).

import { NextResponse } from 'next/server';

export function uniformNotFoundResponse(): NextResponse {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
