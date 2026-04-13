/**
 * Interview frontend API client.
 * Inputs: Interview payloads, chat ids, and turn numbers from the browser state layer.
 * Outputs: Parsed JSON responses from the interview-related backend endpoints.
 */
const parseJsonResponse = async (response) => {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || 'Non-JSON response');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
};

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseJsonResponse(response);
};

export const startInterview = (payload) => postJson('/openai/start', payload);
export const askInterview = (payload) => postJson('/openai/ask', payload);
export const closeInterview = (chatId) => postJson('/openai/close', { chatId });
export const getTurnReview = async (chatId, turn) => {
  const response = await fetch(`/openai/review?chatId=${encodeURIComponent(chatId)}&turn=${encodeURIComponent(turn)}`, {
    headers: {
      Accept: 'application/json',
    },
  });
  return parseJsonResponse(response);
};
