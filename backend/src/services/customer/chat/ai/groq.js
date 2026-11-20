module.exports = {
    request({ model, apiKey, system, input, schema, signal }) {
        return fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
            redirect: 'error',
            signal,
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system + '\nJSON schema: ' + JSON.stringify(schema) },
                    { role: 'user', content: JSON.stringify(input) },
                ],
                response_format: { type: 'json_object' },
                max_completion_tokens: 2048,
            }),
        });
    },
    read(body) {
        return body.choices?.[0]?.message?.content;
    },
};
