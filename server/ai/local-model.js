export async function verifyLocalModel(model, signal, fetchImpl = fetch) {
  const response = await fetchImpl('http://127.0.0.1:11434/api/tags', { signal });
  if (!response.ok) throw new Error('The local model list could not be read.');
  const result = await response.json();
  const modelName = model.includes(':') ? model : `${model}:latest`;
  const installed = result.models?.find(
    (item) => item.name === modelName || item.model === modelName,
  );
  if (!installed)
    throw new Error('Install the configured vision model in local Ollama first.');
  // A localhost Ollama server can proxy cloud models. Reject those before any
  // message or image is handed to its completion endpoint.
  if (
    installed.remote_host ||
    installed.remote_model ||
    /(?:^|[:-])cloud(?:$|[:-])/i.test(modelName) ||
    !(installed.size > 0)
  ) {
    throw new Error(
      'Sensitive mode requires downloaded local model weights, not an Ollama cloud model.',
    );
  }
}
