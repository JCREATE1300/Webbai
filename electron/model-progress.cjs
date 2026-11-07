// A manifest supplies every layer size before the first large layer downloads.
function createModelProgress(layers = []) {
  const files = new Map();
  const knownTotal = layers.length > 0;
  for (const layer of layers) {
    if (layer.digest && Number.isFinite(layer.size) && layer.size >= 0) {
      files.set(layer.digest, { total: layer.size, completed: 0 });
    }
  }
  return (event) => {
    if (event.digest && Number.isFinite(event.total) && event.total >= 0) {
      const previous = files.get(event.digest);
      const total = Math.max(previous?.total || 0, event.total);
      files.set(event.digest, {
        total,
        completed: Math.min(total, Math.max(previous?.completed || 0, event.completed || 0)),
      });
    }
    const total = [...files.values()].reduce((sum, file) => sum + file.total, 0);
    const completed = [...files.values()].reduce((sum, file) => sum + file.completed, 0);
    const success = event.status === 'success';
    return {
      status: event.status || '',
      completed: success ? total : completed,
      total,
      // Without the manifest, discovered files aren't a reliable denominator.
      percent: success ? 100 : knownTotal && total > 0 ? Math.min(99.99, completed / total * 100) : null,
    };
  };
}

async function getModelLayers(id) {
  const name = String(id).trim().replace(/^ollama\//i, '');
  const match = /^(?:([a-zA-Z0-9._-]+)\/)?([a-zA-Z0-9._-]+)(?::([a-zA-Z0-9._-]+))?$/.exec(name);
  if (!match) return [];
  try {
    const [, namespace = 'library', model, tag = 'latest'] = match;
    const response = await fetch(`https://registry.ollama.ai/v2/${namespace}/${model}/manifests/${tag}`, {
      headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return [];
    const manifest = await response.json();
    return Array.isArray(manifest.layers) ? manifest.layers : [];
  } catch {
    return [];
  }
}

module.exports = { createModelProgress, getModelLayers };