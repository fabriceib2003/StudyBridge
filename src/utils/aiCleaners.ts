/**
 * Shared AI prompt rules and post-processing cleaners
 */

export const NO_GREETINGS_PROMPT_RULE =
  "Never greet the user. Never introduce yourself or mention being StudyBridge, an AI, a tutor or an assistant. Never say Hello, Hi, Sure, Certainly, Of course, Great question, or similar. Start directly with the content. Do not end with an offer of more help or a question to the user.";

/**
 * Strips leading greeting or self-introduction sentences and trailing offer-of-help/closing questions.
 * Safe to apply to saved results at display time, streaming previews, and newly generated answers.
 */
export function stripGreetingsAndOffers(text: string): string {
  if (!text || typeof text !== 'string') return text || '';

  let s = text.trim();

  // If this is clean JSON (starts with { or [), preserve without altering internal data
  if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
    return s;
  }

  // 1. Strip leading greetings, pleasantries, and self-introductions sentence-by-sentence
  const leadingSentenceRegex = /^(?:(?:(?:hello|hi|hey|greetings|welcome)(?:\s+(?:there|everyone|friend|student))?|sure|certainly|of\s+course|absolutely|definitely|great\s+question|good\s+question|excellent\s+question)[!.,:\s-]+|(?:(?:i(?:'m|\s+am)|my\s+name\s+is|this\s+is)\s+studybridge\b[^.!?\n]*[:.!?\n]+)|(?:as\s+(?:studybridge\b|an?\s+(?:ai|tutor|study\s+assistant|assistant|educator|academic\s+tutor)\b)[^.!?\n]*[:.!?\n]+)|(?:(?:i(?:\s+would|'d)?\s+be\s+(?:happy|glad|pleased)\s+to\s+(?:help|assist|explain|provide)|i\s+can\s+(?:help|assist|explain)\b)[^.!?\n]*[:.!?\n]+)|(?:here(?:'s|\s+is|\s+are)\s+(?:the|a|an|some|your)\b[^.!?\n]*[:.!?\n]+))\s*/i;

  let prev = '';
  // Repeat up to 5 times to handle chained pleasantries (e.g. "Sure! Great question. I can help.")
  let iterations = 0;
  while (s !== prev && iterations < 5 && leadingSentenceRegex.test(s)) {
    prev = s;
    s = s.replace(leadingSentenceRegex, '').trim();
    iterations++;
  }

  // 2. Strip trailing offer-of-help, questions to user, and closing wishes sentence-by-sentence
  const trailingSentenceRegex = /\s*(?:(?:(?:i\s+)?hope\s+this\s+(?:helps|is\s+helpful)[^.!?\n]*[.!?]?)|(?:(?:please\s+)?let\s+me\s+know\s+if\s+(?:you\s+)?(?:have|need)[^.!?\n]*[.!?]?)|(?:feel\s+free\s+to\s+ask[^.!?\n]*[.!?]?)|(?:if\s+you\s+(?:have|need)[^.!?\n]*feel\s+free[^.!?\n]*[.!?]?)|(?:(?:do\s+you\s+have|is\s+there\s+anything|would\s+you\s+like|what\s+would\s+you\s+like)[^.!?\n]*\?)|(?:happy\s+studying[!.]*)|(?:good\s+luck\s+with\s+(?:your\s+)?(?:studies|exam|test)[!.]*))\s*$/i;

  prev = '';
  iterations = 0;
  while (s !== prev && iterations < 5 && trailingSentenceRegex.test(s)) {
    prev = s;
    s = s.replace(trailingSentenceRegex, '').trim();
    iterations++;
  }

  return s;
}
