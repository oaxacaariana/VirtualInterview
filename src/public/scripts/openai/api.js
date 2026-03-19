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
export const closeInterview = (chatId) =>
  postJson('/openai/close', { chatId }).catch(() => null);
