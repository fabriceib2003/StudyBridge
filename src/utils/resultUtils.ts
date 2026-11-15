import { SavedResult } from '../types';

export function stripMarkdownAndLatex(text: string): string {
  if (!text) return '';
  return text
    // Remove LaTeX math $$...$$ and $...$
    .replace(/\$\$([^\n$]+)\$\$/g, '$1')
    .replace(/\$([^\n$]+)\$/g, '$1')
    // Remove Markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove markdown symbols #, *, _, `, ~, >, [, ], (, ), {, }
    .replace(/[*#$`_~[\]()>{}]/g, '')
    // Collapse all whitespace to a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a string contains known fixed template text that must never be shown
 */
export function isTemplateText(text: string): boolean {
  if (!text) return false;
  const t = text.trim();
  if (/^generated\s+\d+.*(?:quiz|flashcard|question|covering)/i.test(t)) return true;
  if (/click below to (?:launch|open|generate) the (?:quiz arena|flashcard viewer|flashcards|quiz)/i.test(t)) return true;
  if (/ready (?:to study|for practice)\?\s*click below/i.test(t)) return true;
  return false;
}

/**
 * Computes a plain-text preview (max 2 lines, Markdown and LaTeX symbols stripped):
 * - Quiz: the first question text, then "+ N more questions".
 * - Flashcards: the fronts of the first 2 cards, then "+ N more cards".
 * - Summary: the TL;DR sentence(s).
 * - Explanation: the first core idea.
 * - Answer: the first sentence of the answer.
 */
export function computePreview(res: {
  type?: string;
  content?: string;
  quizData?: any;
  flashcardData?: any;
  preview?: string;
}): string {
  // If a valid preview is already stored and is not template text, return it
  if (res.preview && res.preview.trim() && !isTemplateText(res.preview)) {
    return stripMarkdownAndLatex(res.preview);
  }

  const rawType = (res.type || 'summary').trim().toLowerCase();
  const content = res.content || '';

  // 1. Quiz: first question text, then "+ N more questions"
  if (rawType === 'quiz' || res.quizData?.questions?.length) {
    const questions = res.quizData?.questions || [];
    if (questions.length > 0) {
      const rawQ = questions[0].question || questions[0].text || '';
      const cleanQ = stripMarkdownAndLatex(rawQ);
      const firstQ = cleanQ.length > 100 ? cleanQ.slice(0, 97).trim() + '...' : cleanQ;
      const remaining = questions.length - 1;
      return remaining > 0 ? `${firstQ} + ${remaining} more questions` : firstQ;
    }
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (parsed?.questions?.length > 0) {
        const cleanQ = stripMarkdownAndLatex(parsed.questions[0].question || '');
        const firstQ = cleanQ.length > 100 ? cleanQ.slice(0, 97).trim() + '...' : cleanQ;
        const remaining = parsed.questions.length - 1;
        return remaining > 0 ? `${firstQ} + ${remaining} more questions` : firstQ;
      }
    } catch {}

    // Fallback if content was stored as template text
    if (isTemplateText(content)) {
      const match = content.match(/covering\s+([^.\n]+)/i);
      if (match) {
        return `Quiz covering ${stripMarkdownAndLatex(match[1])}`;
      }
    }
  }

  // 2. Flashcards: the fronts of the first 2 cards, then "+ N more cards"
  if (rawType === 'flashcards' || rawType === 'flashcard' || res.flashcardData?.cards?.length) {
    const cards = res.flashcardData?.cards || [];
    if (cards.length > 0) {
      const fronts = cards.slice(0, 2).map((c: any) => stripMarkdownAndLatex(c.front || c.question || '')).filter(Boolean);
      const remaining = cards.length - fronts.length;
      const joined = fronts.join(', ');
      return remaining > 0 ? `${joined} + ${remaining} more cards` : joined;
    }
    try {
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      if (parsed?.cards?.length > 0) {
        const fronts = parsed.cards.slice(0, 2).map((c: any) => stripMarkdownAndLatex(c.front || '')).filter(Boolean);
        const remaining = parsed.cards.length - fronts.length;
        const joined = fronts.join(', ');
        return remaining > 0 ? `${joined} + ${remaining} more cards` : joined;
      }
    } catch {}

    // Fallback if content was stored as template text
    if (isTemplateText(content)) {
      const match = content.match(/covering\s+([^.\n]+)/i);
      if (match) {
        return `Flashcards covering ${stripMarkdownAndLatex(match[1])}`;
      }
    }
  }

  const cleanText = stripMarkdownAndLatex(content);

  // If content is pure template text without questions/cards parsed
  if (isTemplateText(cleanText)) {
    const match = cleanText.match(/covering\s+([^.\n]+)/i);
    if (match) {
      return `Study practice covering ${stripMarkdownAndLatex(match[1])}`;
    }
  }

  // 3. Summary: the TL;DR sentence(s)
  if (rawType === 'summary' || rawType === 'summarize') {
    const tldrMatch = cleanText.match(/(?:tl;?dr|tldr|takeaways?|key takeaways?|overview)[:\s*#]+([^.\n]+[.!?])/i);
    if (tldrMatch) {
      return stripMarkdownAndLatex(tldrMatch[1]);
    }
    const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    const preview = sentences.slice(0, 2).join(' ') || cleanText.slice(0, 150);
    return preview;
  }

  // 4. Explanation: the first core idea
  if (rawType === 'explanation' || rawType === 'explain') {
    const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    return sentences[0] || cleanText.slice(0, 150);
  }

  // 5. Answer: the first sentence of the answer
  if (rawType === 'answer' || rawType === 'custom') {
    const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
    return sentences[0] || cleanText.slice(0, 150);
  }

  const sentences = cleanText.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 5);
  return sentences[0] || cleanText.slice(0, 150);
}

/**
 * Checks if a title matches the old template/count/generic pattern and should be recomputed at display time
 */
export function isOldOrGenericTitle(title?: string): boolean {
  if (!title || !title.trim()) return true;
  const t = title.trim();
  // Old patterns: "Quiz: Chapter 03 (5)", "Flashcards: Chapter 03 (12)", "Quiz: ... (5)"
  if (/^(?:Quiz|Flashcards):\s*.+\s*\(\d+\)$/i.test(t)) return true;
  // Old NotebookWorkspace patterns: "Practice Quiz (...)", "Flashcards (...)", "Summary (...)", "Ask: ..."
  if (/^(?:Practice Quiz|Flashcards|Summary)\s*\([^)]*\)$/i.test(t)) return true;
  if (/^Ask:\s*"/i.test(t)) return true;
  // Generic fallbacks: "Quiz: Study Material", "Summary: Study Material", "Explanation: Core Concepts", "Explanation: Study Material"
  if (/^(?:Summary|Explanation|Quiz|Flashcards|Answer):\s*(?:Study Material|General Study|Core Concepts|Subject)$/i.test(t)) return true;
  if (/^(?:quiz|flashcards|summary|explanation|answer)\s+result$/i.test(t)) return true;
  // Missing colon prefix
  if (!t.includes(':')) return true;
  return false;
}

/**
 * Computes a real short title (max 60 characters) from real content in the form "<Type>: <topic>":
 * - Quiz and Flashcards: uses model "title" field, or most frequent "topic" of items, or fallback source name.
 * - Summary: topic from first heading or TL;DR.
 * - Explanation: main concept(s).
 * - Answer: cleaned question.
 * - If title already exists for same sources and type, adds "#2", "#3".
 */
export function computeTitle(
  actionType: string,
  content: string,
  quizData?: any,
  flashcardData?: any,
  sourceName: string = 'Study Material',
  existingResults: SavedResult[] = []
): string {
  const rawType = (actionType || 'summary').trim().toLowerCase();
  const typeLabel = 
    rawType === 'summary' || rawType === 'summarize' ? 'Summary' :
    rawType === 'explanation' || rawType === 'explain' ? 'Explanation' :
    rawType === 'quiz' ? 'Quiz' :
    rawType === 'flashcards' || rawType === 'flashcard' ? 'Flashcards' :
    'Answer';

  let topic = '';

  // 1. Quiz
  if (rawType === 'quiz') {
    topic = quizData?.title || '';
    if (!topic && quizData?.questions?.length) {
      const topics = quizData.questions.map((q: any) => q.topic).filter(Boolean);
      if (topics.length) {
        const counts = topics.reduce((acc: any, t: string) => { 
          const clean = t.trim();
          acc[clean] = (acc[clean] || 0) + 1; 
          return acc; 
        }, {});
        topic = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      }
    }
    if (!topic && typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        topic = parsed?.title || '';
        if (!topic && parsed?.questions?.length) {
          const topics = parsed.questions.map((q: any) => q.topic).filter(Boolean);
          if (topics.length) {
            const counts = topics.reduce((acc: any, t: string) => { 
              const clean = t.trim();
              acc[clean] = (acc[clean] || 0) + 1; 
              return acc; 
            }, {});
            topic = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
          }
        }
      } catch {}
    }
    if (!topic && typeof content === 'string' && isTemplateText(content)) {
      const match = content.match(/covering\s+([^,.\n]+)/i);
      if (match) {
        topic = match[1].trim();
      }
    }
  } 
  // 2. Flashcards
  else if (rawType === 'flashcards' || rawType === 'flashcard') {
    topic = flashcardData?.title || '';
    if (!topic && flashcardData?.cards?.length) {
      const topics = flashcardData.cards.map((c: any) => c.topic).filter(Boolean);
      if (topics.length) {
        const counts = topics.reduce((acc: any, t: string) => { 
          const clean = t.trim();
          acc[clean] = (acc[clean] || 0) + 1; 
          return acc; 
        }, {});
        topic = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
      }
    }
    if (!topic && typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        topic = parsed?.title || '';
        if (!topic && parsed?.cards?.length) {
          const topics = parsed.cards.map((c: any) => c.topic).filter(Boolean);
          if (topics.length) {
            const counts = topics.reduce((acc: any, t: string) => { 
              const clean = t.trim();
              acc[clean] = (acc[clean] || 0) + 1; 
              return acc; 
            }, {});
            topic = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
          }
        }
      } catch {}
    }
    if (!topic && typeof content === 'string' && isTemplateText(content)) {
      const match = content.match(/covering\s+([^,.\n]+)/i);
      if (match) {
        topic = match[1].trim();
      }
    }
  } 
  // 3. Summary: topic from first heading or TL;DR
  else if (rawType === 'summary' || rawType === 'summarize') {
    const clean = stripMarkdownAndLatex(content);
    const headingMatch = content.match(/^#+\s+([^\n]+)/m);
    if (headingMatch) {
      const h = headingMatch[1].trim().replace(/^Summary\s*[:\-–—]\s*/i, '').replace(/[*_`]/g, '').trim();
      if (h.length >= 3) {
        topic = h;
      }
    }
    if (!topic) {
      const tldrMatch = clean.match(/(?:tl;?dr|tldr|takeaways?|key takeaways?|overview)[:\s*#]+([^.\n]+)/i);
      if (tldrMatch) {
        topic = tldrMatch[1].trim();
      }
    }
    if (!topic) {
      const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || sourceName;
      topic = firstSentence;
    }
  } 
  // 4. Explanation: main concept(s)
  else if (rawType === 'explanation' || rawType === 'explain') {
    const isGenericSource = !sourceName || /^(?:Study Material|General Study|Subject)$/i.test(sourceName.trim());
    if (!isGenericSource && sourceName.length > 2 && sourceName.length < 50) {
      topic = sourceName.trim();
    }
    if (!topic) {
      const headingMatch = content.match(/^#+\s+([^\n]+)/m);
      if (headingMatch) {
        const h = headingMatch[1].trim().replace(/^Explanation\s*[:\-–—]\s*/i, '').replace(/[*_`]/g, '').trim();
        if (h.length >= 3) {
          topic = h;
        }
      }
    }
    if (!topic) {
      const clean = stripMarkdownAndLatex(content);
      const firstSentence = clean.split(/(?<=[.!?])\s+/)[0] || sourceName;
      topic = firstSentence;
    }
  } 
  // 5. Answer: cleaned question
  else if (rawType === 'answer' || rawType === 'custom') {
    const cleanQ = sourceName.trim().replace(/^[^a-zA-Z0-9]+/, '').replace(/[?.,!]+$/, '').trim();
    topic = cleanQ || 'Question';
  }

  // Fall back to clean source name if topic is still missing
  const cleanSourceName = (sourceName || 'Study Material').replace(/\s*\(\d+\)$/, '').trim();
  if (!topic || topic.length < 2) {
    topic = cleanSourceName;
  }

  // Prefix and budget for max 60 chars
  const prefix = `${typeLabel}: `;
  const maxTopicLen = 60 - prefix.length - 4; // Reserve 4 chars for potential " #99"
  let cleanTopic = stripMarkdownAndLatex(topic);
  if (cleanTopic.length > maxTopicLen) {
    cleanTopic = cleanTopic.slice(0, maxTopicLen - 3).trim() + '...';
  }
  const baseTitle = `${prefix}${cleanTopic}`;

  let finalTitle = baseTitle;
  const sameTitleCount = existingResults.filter(r => {
    const t = r.title || '';
    return t === baseTitle || t.startsWith(baseTitle + ' #');
  }).length;
  if (sameTitleCount > 0) {
    finalTitle = `${baseTitle} #${sameTitleCount + 1}`;
  }
  if (finalTitle.length > 60) {
    finalTitle = finalTitle.slice(0, 57).trim() + '...';
  }
  return finalTitle;
}

/**
 * Helper to get the display title for any result, computing dynamically for old results
 */
export function getDisplayTitle(
  res: { title?: string; type?: string; content?: string; quizData?: any; flashcardData?: any; id?: string },
  existingResults: any[] = [],
  fallbackSourceName?: string
): string {
  if (res.title && !isOldOrGenericTitle(res.title)) {
    return res.title;
  }
  return computeTitle(
    res.type || 'summary',
    res.content || '',
    res.quizData,
    res.flashcardData,
    fallbackSourceName || 'Study Material',
    existingResults.filter(r => r.id !== res.id)
  );
}
