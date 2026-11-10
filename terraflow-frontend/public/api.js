const BODY_PREVIEW_LENGTH = 140;

export class ApiError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ApiError";
    this.status = details.status;
    this.body = details.body;
  }
}

function describeBody(body) {
  const trimmed = body.trim();
  return trimmed ? trimmed.slice(0, BODY_PREVIEW_LENGTH) : "(empty response)";
}

function parseBody(body) {
  try {
    return { parsed: true, value: JSON.parse(body) };
  } catch {
    return { parsed: false, value: null };
  }
}

function describeApiError(status, path, value) {
  const detail = value && typeof value === "object" ? value.error || value.message : null;
  return detail ? `HTTP ${status} from ${path} - ${detail}` : `HTTP ${status} from ${path}`;
}

export async function requestJson(path, options) {
  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    throw new Error(`cannot reach the local runner (${error.message})`);
  }

  const body = await response.text();
  const result = parseBody(body);

  if (!response.ok) {
    throw new ApiError(describeApiError(response.status, path, result.value), {
      status: response.status,
      body: result.parsed ? result.value : null
    });
  }

  if (!result.parsed) {
    throw new Error(`expected JSON from ${path} but received - ${describeBody(body)}`);
  }

  return result.value;
}
