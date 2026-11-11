// Linear GraphQL client for the digital-university workspace (team DIG).
// Deterministic — no LLM. The orchestrator uses this instead of a clerk agent:
// fewer failure modes, no token cost, exact pagination.
// Auth: LINEAR_DIGITAL_UNIVERSITY_API_KEY (never hardcode).

const API = 'https://api.linear.app/graphql';
const TEAM_KEY = 'DIG';
const TEAM_ID = 'dbf2aaaf-98b0-4daa-9ad0-3a6ed3baee0f';
export const LABEL = 'swarm';

const STATES = `query($team: ID!) { workflowStates(filter: { team: { id: { eq: $team } } }) { nodes { id name type } } }`;
const states = async () => (await gql(STATES, { team: TEAM_ID })).workflowStates.nodes;

const key = () => process.env.LINEAR_DIGITAL_UNIVERSITY_API_KEY;

export async function gql(query, variables = {}) {
  if (!key()) throw new Error('LINEAR_DIGITAL_UNIVERSITY_API_KEY is not set');
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: key() },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json().catch(() => ({}));
  if (j.errors?.length) throw new Error(`linear: ${j.errors.map((e) => e.message).join('; ')}`);
  if (!r.ok) throw new Error(`linear http ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.data;
}

/** First Todo issue in team DIG labeled `swarm`, best priority first, then oldest. */
export async function pickIssue({ pin = '' } = {}) {
  const data = await gql(
    `query($team: String!) {
      issues(filter: { team: { key: { eq: $team } }, state: { type: { eq: "unstarted" } } }, first: 100) {
        nodes { id identifier title description branchName priority
          state { name } labels { nodes { name } } }
      }
    }`,
    { team: TEAM_KEY },
  );
  const todo = data.issues.nodes;
  const withLabel = todo.filter((i) => i.labels.nodes.some((l) => l.name === LABEL));
  const candidates = pin ? withLabel.filter((i) => i.identifier === pin) : withLabel;
  if (pin && !candidates.length) {
    // pinned issue may be in another state — surface a clear error
    const found = todo.find((i) => i.identifier === pin);
    throw new Error(
      found
        ? `${pin} is in state "${found.state?.name || 'unknown'}" or lacks the "${LABEL}" label`
        : `${pin} not found in team ${TEAM_KEY}`,
    );
  }
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      (a.priority || 0) - (b.priority || 0) ||
      a.identifier.localeCompare(b.identifier, undefined, { numeric: true }),
  );
  const i = candidates[0];
  return {
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    description: i.description || '',
    branch: i.branchName || '',
  };
}

const issueId = async (identifier) =>
  (await gql(`query($id: String!) { issue(id: $id) { id } }`, { id: identifier })).issue.id;

export async function claimIssue(identifier) {
  const id = await issueId(identifier);
  const stateId = (await states()).find(
    (s) => s.type === 'started' && s.name === 'In Progress',
  )?.id;
  if (!stateId) throw new Error('In Progress state not found in team DIG');
  await gql(
    `mutation($id: String!, $state: String!) { issueUpdate(id: $id, input: { stateId: $state }) { success } }`,
    { id, state: stateId },
  );
  await addComment(
    identifier,
    '🎯 Рой принял задачу: executor → гейты → ревью → security → PR. Статусы ведёт оркестратор.',
  );
}

export async function addComment(identifier, body) {
  const id = await issueId(identifier);
  await gql(
    `mutation($id: String!, $body: String!) { commentCreate(input: { issueId: $id, body: $body }) { success } }`,
    { id, body },
  );
}

export async function doneIssue(identifier, evidence) {
  const id = await issueId(identifier);
  const stateId = (await states()).find((s) => s.type === 'completed')?.id;
  if (!stateId) throw new Error('Done state not found in team DIG');
  await gql(
    `mutation($id: String!, $state: String!) { issueUpdate(id: $id, input: { stateId: $state }) { success } }`,
    { id, state: stateId },
  );
  await addComment(identifier, evidence);
}

export async function failIssue(identifier, step, msg) {
  try {
    await addComment(
      identifier,
      `⚠️ Рой споткнулся на шаге **${step}**: ${String(msg).slice(0, 3000)}\n\nВетка оставлена для человека; задача остаётся в In Progress — закрыть может только человек.`,
    );
  } catch (e) {
    console.error(`(linear failure-report also failed: ${e.message})`);
  }
}

/** The orchestrator's last failure comment for this issue (⚠️ …) — carries review
 *  findings across restarts so a re-queued task starts with them, not from zero. */
export async function lastFailureNotes(identifier) {
  const id = await issueId(identifier);
  const data = await gql(
    `query($id: String!) { issue(id: $id) { comments(first: 100) { nodes { body } } } }`,
    { id },
  );
  const matches = data.issue.comments.nodes.filter((c) => c.body.startsWith('⚠️ Рой споткнулся'));
  return matches.length ? matches[matches.length - 1].body : '';
}

/** Poll a Linear issue until its PR comment round-trips (used by --wait-evidence in tests). */
export const normalizeIdentifier = (s) => {
  const m = String(s || '')
    .trim()
    .toUpperCase()
    .match(/^DIG-\d+$/);
  if (!m) throw new Error(`bad identifier: ${s}`);
  return m[0];
};
