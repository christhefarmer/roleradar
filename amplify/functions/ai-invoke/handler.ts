// One-shot AI tasks over the Bedrock Converse API: résumé parse and fit
// scoring. The model must answer with strict JSON; we extract it tolerantly.
// 4.x Claude models are only invokable through an inference profile — the
// global Haiku 4.5 profile below is the runnable id for
// anthropic.claude-haiku-4-5-20251001-v1:0.

import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const MODEL_ID = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

const client = new BedrockRuntimeClient();

const PARSE_PROMPT = [
  'You parse a résumé (and optional LinkedIn text) for a job-hunt scout and',
  'produce the scout\'s entire search range. Extract:',
  '(1) strengths — return 6 to 8, never fewer than 6 unless the text is under',
  'a paragraph. Each: { key (short snake_case derived from the strength itself,',
  'e.g. character_art, shader_dev, okta_sso — NOT from any fixed list), label,',
  'conf: HIGH | MED | RARE (HIGH = strong direct evidence, MED = thinner or',
  'adjacent evidence, RARE = an unusual edge worth cross-listing), weight 1-3,',
  'bar 0-100, ev (a short evidence quote lifted from the text) }. Be rigorous:',
  'mine every angle — tools and hard skills, domains, shipped projects or',
  'portfolio work, education and certifications, collaboration, trajectory.',
  'For sparse or junior résumés still reach 6 with honestly-graded MED',
  'confidence; ground every strength in the text, never invent;',
  '(2) termGroups — exactly three priority tiers: { name: "High", weight: 3 },',
  '{ name: "Med", weight: 2 }, { name: "Low", weight: 1 }, each with terms:',
  'string[] of 3-8 short queries a job board understands — job titles,',
  'technologies, certifications. High = the core lane, Med = strong adjacent,',
  'Low = stretch;',
  '(3) suggestedTerms — string[] of extra terms beyond the groups;',
  '(4) suggestedCompanies — [{ name, reason }] employers worth watching;',
  '(5) facts — { seniority, location, canadaEligible: boolean }.',
  'Respond with ONLY a valid JSON object with keys strengths, termGroups,',
  'suggestedTerms, suggestedCompanies, facts. No prose, no markdown fences.',
].join(' ');

const FIT_PROMPT = [
  'You score a job posting against a specific owner profile. Compare the role',
  'description to the profile and return an honest, structured fit read. The',
  'payload includes dimensions: a JSON list of { key, label } derived from the',
  'owner\'s parsed strengths — always score every provided key (always',
  'including level for seniority fit and eligible for work eligibility).',
  'Respond with ONLY a valid JSON object: { score: 0-100, verdict: "match" |',
  '"reach" | "below" | "mismatch", sentence: an honest one-or-two sentence',
  'verdict (transparent about stretches and gaps), dims: map of each provided',
  'key to "hit" | "partial" | "thin" | "na" (or "us" when blocked by US-only',
  'authorization), notes: map of the same keys to one short plain-language',
  'sentence each, chips: up to 4 short labels like "+ Deep Jamf" or',
  '"− Light on build" }. No prose outside the JSON, no markdown fences.',
].join(' ');

interface AiInvokeEvent {
  arguments: { task: unknown; payload: unknown };
}

function unwrap(value: unknown): unknown {
  let v = value;
  for (let i = 0; i < 3 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v);
    } catch {
      break;
    }
  }
  return v;
}

/** Pull the first JSON object out of a model reply, tolerating stray prose
 *  or markdown fences. */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('model reply contained no JSON object');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export const handler = async (event: AiInvokeEvent): Promise<string> => {
  const task = String(unwrap(event.arguments?.task) ?? '');
  const payload = unwrap(event.arguments?.payload) as Record<string, unknown> | null;
  if (!payload || (task !== 'parseProfile' && task !== 'generateFit')) {
    throw new Error(`unknown ai task: ${task}`);
  }

  const system = task === 'parseProfile' ? PARSE_PROMPT : FIT_PROMPT;
  const userMessage =
    task === 'parseProfile'
      ? `RESUME:\n${payload.resumeText ?? ''}\n\nLINKEDIN (optional):\n${payload.linkedinText ?? ''}`
      : [
          `DIMENSIONS: ${JSON.stringify(payload.dimensions ?? [])}`,
          `ROLE TITLE: ${payload.roleTitle ?? ''}`,
          `ROLE LOCATION: ${payload.roleLocation ?? ''}`,
          `ROLE DESCRIPTION:\n${payload.roleDescription ?? ''}`,
          `OWNER PROFILE:\n${payload.profile ?? ''}`,
        ].join('\n\n');

  const res = await client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: userMessage }] }],
      inferenceConfig: { maxTokens: 2400, temperature: 0.3 },
    }),
  );

  const text = (res.output?.message?.content ?? [])
    .map((block) => ('text' in block ? (block.text ?? '') : ''))
    .join('');
  if (!text) throw new Error(`empty model reply (stopReason: ${res.stopReason ?? 'unknown'})`);

  return JSON.stringify(extractJson(text));
};
