const defaultSearchModel = 'gpt-4.1';

const extractText = (response) => {
  if (!response) return '';
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const maybeContent = response.output?.[0]?.content?.[0]?.text;
  if (typeof maybeContent === 'string' && maybeContent.trim()) return maybeContent.trim();
  if (maybeContent && typeof maybeContent.value === 'string' && maybeContent.value.trim()) {
    return maybeContent.value.trim();
  }
  return '';
};

/**
 * Runs an OpenAI web_search tool call for the given company/role.
 * Returns a terse semicolon-separated summary plus an array of bullet strings.
 */
const runWebResearch = async ({ client, company = '', role = '' }) => {
  if (!client || (!company && !role)) {
    return { summary: '', bullets: [] };
  }

  const queryLabel = [role, company].filter(Boolean).join(' at ');

  try {
    const response = await client.responses.create({
      model: defaultSearchModel,
      tools: [{ type: 'web_search' }],
      max_output_tokens: 256,
      input: [
        {
          role: 'user',
          content: [
            `Run a focused web scan about ${queryLabel || 'the target company and role'}.`,
            'Return 3-6 concise hiring-relevant facts (products, recent news, tech stack, hiring focus, leadership moves, interview patterns).',
            'Use semicolon-separated phrases, max 80 words, no lists or prefixes.',
          ].join(' '),
        },
      ],
    });

    const text = extractText(response);
    const bullets = text
      .split(/;|\n|\\u2022|-/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);

    return {
      summary: bullets.join('; ') || text,
      bullets,
    };
  } catch (err) {
    console.warn('OpenAI web_search failed:', err.message || err);
    return { summary: '', bullets: [] };
  }
};

module.exports = { runWebResearch };
