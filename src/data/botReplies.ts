// Scripted Radar replies from the design prototypes. These stand in for the
// Amplify AI Kit conversation route (amplify/data/resource.ts → `chat`), which
// answers from real records via read tools and proposes via approval-gated
// write tools. Swap `botReply` for `useAIConversation` when the backend is live.

export function botReply(q: string, mobile = false): string {
  q = (q || '').toLowerCase();
  if (/top|match|best|recommend|fit/.test(q))
    return mobile
      ? 'Your top three: 1Password — Client Platform Engineer (94), Jamf — Senior Endpoint Engineer (91), and Wealthsimple — Identity & Access (88). 1Password is the cleanest fit. Want me to save it to your pipeline?'
      : 'Your top three: 1Password — Client Platform Engineer (94), Jamf — Senior Endpoint Engineer (91), and Wealthsimple — Identity & Access (88). 1Password is the cleanest: Apple fleet at scale, identity baked in, right at your level. Want me to open it in Recommended?';
  if (/new|sweep|found|latest|today/.test(q))
    return mobile
      ? 'This sweep fetched 31 roles, kept 23, muted 2 phantoms, and surfaced 3 hidden gems. The standout is Modern Workplace Lead @ Benevity — a generic title that’s ~78% your stack.'
      : 'This sweep fetched 31 roles, deduped to 23, flagged 2 phantoms, and surfaced 3 hidden gems. The standout is Modern Workplace Lead @ Benevity — a generic title whose description is ~78% your stack.';
  if (/phantom|repost|evergreen|fake/.test(q))
    return mobile
      ? "Hootsuite's Apple Fleet role has shown up on 6 of the last 8 sweeps over 94 days and never moved — a classic evergreen req. I've queued it to mute; approve above and it stops resurfacing."
      : "Hootsuite's Senior Systems Engineer (Apple Fleet) has appeared on 6 of the last 8 sweeps over 94 days and never moved — a classic evergreen req. I'd hold off on a serious application until it changes. Want me to mute it?";
  if (/proposal|queue|move|approve|change/.test(q))
    return mobile
      ? 'The 3 cards above are everything waiting. The highest-value one adds “Workspace Engineer” — it’d surface 3 roles you’d otherwise never see.'
      : 'You have moves waiting above. The highest-value one: add “Workspace Engineer” as a search term — it would surface 3 roles your current terms miss, with no extra noise.';
  if (/eligib|canada|remote|visa|\bus\b|auth/.test(q))
    return mobile
      ? "I enforce Canada-eligibility as a hard filter. Tailscale's role is a strong skills match but US-only, so it's hidden unless you override it."
      : "I enforce Canada-eligibility as a hard filter. Tailscale's Endpoint Management role is a strong skills match but US-authorization only, so it stays hidden unless you override it on the card.";
  if (/gem|hidden/.test(q))
    return mobile
      ? '3 gems this sweep: Modern Workplace Lead @ Benevity and Technical Implementation Consultant @ Dialpad (content matches), plus IT Operations Generalist @ Clio (a fleet signal). Want the details on any?'
      : '3 hidden gems this sweep: Modern Workplace Lead @ Benevity and Technical Implementation Consultant @ Dialpad (both content matches), plus IT Operations Generalist @ Clio (a company-fleet signal). Confirm any to promote it into Recommended.';
  if (/pipeline|applied|track|interview/.test(q))
    return mobile
      ? "You're tracking 3 roles: 1Password (Applied), Jamf (Interview), NinjaOne (Interested). Want a prep checklist for the Jamf interview?"
      : "You're tracking 3 roles: 1Password (Applied), Jamf (Interview), and NinjaOne (Interested). Want me to draft a follow-up note for the Jamf interview?";
  if (/hi|hello|hey|help|start|morning/.test(q))
    return mobile
      ? 'Happy to help. Try “show all matches”, “what’s new this sweep?”, or “any phantoms?”.'
      : 'Happy to help. Try “walk me through my top matches”, “what’s new this sweep?”, or “review my proposals”.';
  return 'I can walk you through your matches, explain any fit score, flag phantoms, or tee up changes for your approval. What would you like to dig into?';
}
