module.exports = {
    request({ model, apiKey, system, input, schema, signal }) {
        return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            redirect: 'error',
            signal,
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
                generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 2048 },
            }),
        });
    },
    read(body) {
        return body.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
    },
};
