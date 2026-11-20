const providers = new Map([
    ['gemini', require('./gemini')],
    ['groq', require('./groq')],
]);

function settings(name = process.env.AI_PROVIDER?.trim().toLowerCase() || 'gemini') {
    const prefix = name.toUpperCase();
    const timeout = Number(process.env.AI_TIMEOUT_MS || process.env[prefix + '_TIMEOUT_MS']);
    return {
        name,
        apiKey: process.env[prefix + '_API_KEY']?.trim(),
        model: process.env[prefix + '_MODEL']?.trim(),
        timeout: Number.isInteger(timeout) && timeout > 0 ? Math.min(timeout, 20000) : 12000,
    };
}

function matchesSchema(value, schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const type = value === null ? 'null' : Array.isArray(value) ? 'array'
        : Number.isInteger(value) ? 'integer' : typeof value;
    if (!types.includes(type) || (schema.enum && !schema.enum.includes(value))) return false;
    if (type === 'array') return value.every(item => matchesSchema(item, schema.items));
    if (type === 'object') {
        const required = schema.required || [];
        return required.every(key => Object.hasOwn(value, key))
            && Object.entries(schema.properties || {}).every(([key, rule]) =>
                !Object.hasOwn(value, key) || matchesSchema(value[key], rule));
    }
    return true;
}

async function attempt(config, payload, timeout) {
    const provider = providers.get(config.name);
    if (!provider) return { ok: false, reason: 'invalid_provider' };
    if (!config.apiKey) return { ok: false, reason: 'missing_api_key' };
    if (!config.model) return { ok: false, reason: 'missing_model' };
    if (timeout <= 0) return { ok: false, reason: 'no_time_left' };
    try {
        const response = await provider.request({ ...config, ...payload, signal: AbortSignal.timeout(timeout) });
        if (!response.ok) {
            await response.body?.cancel();
            return { ok: false, reason: response.status === 429 ? 'quota_exceeded' : 'http_' + response.status };
        }
        const data = JSON.parse(provider.read(await response.json()));
        if (payload.schema.properties?.intent && !payload.schema.properties.intent.enum.includes(data?.intent)) {
            return { ok: false, reason: 'invalid_intent' };
        }
        return matchesSchema(data, payload.schema) ? { ok: true, data } : { ok: false, reason: 'invalid_schema' };
    } catch (error) {
        const reason = ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout'
            : error instanceof SyntaxError ? 'invalid_json' : 'network_error';
        return { ok: false, reason };
    }
}

async function generateJson(stage, system, input, schema, timeout = settings().timeout) {
    const primary = settings();
    const fallback = process.env.AI_FALLBACK_PROVIDER?.trim().toLowerCase();
    const next = fallback && fallback !== primary.name && providers.has(fallback) ? settings(fallback) : primary;
    const retrySame = process.env.AI_RETRY_ONCE === 'true';
    const deadline = Date.now() + timeout;
    const payload = { system, input, schema };
    let result;
    for (const config of [primary, next]) {
        const start = Date.now();
        result = await attempt(config, payload, Math.max(0, Math.min(config.timeout, deadline - start)));
        const label = config.name === 'gemini' ? 'Gemini' : config.name === 'groq' ? 'Groq' : 'provider';
        if (result.ok) {
            console.info('[chat] ' + label + ' ' + stage + ' ok in ' + (Date.now() - start) + 'ms');
            return { ...result, provider: config.name };
        }
        console.warn('[chat] ' + label + ' ' + stage + ' failed: ' + result.reason + ' (' + (Date.now() - start) + 'ms); using backend fallback if no retry succeeds');
        if (config !== primary || Date.now() >= deadline) break;
        if (next === primary && (!retrySame || !/^http_5|^network_error$/.test(result.reason))) break;
        if (result.reason === 'no_time_left') break;
        if (next === primary) {
            const retried = await attempt(primary, payload, Math.max(0, deadline - Date.now()));
            console.info('[chat] ' + label + ' ' + stage + ' retry ' + (retried.ok ? 'ok' : retried.reason) + ' in ' + (Date.now() - start) + 'ms');
            return retried.ok ? { ...retried, provider: primary.name } : retried;
        }
    }
    return result;
}

module.exports = { generateJson, settings };
