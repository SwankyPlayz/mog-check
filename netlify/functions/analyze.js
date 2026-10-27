// netlify/functions/analyze.js
// All secrets stay server-side. Nothing leaks to the browser.

const FETCH = globalThis.fetch; // native in Node 18+

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { images } = JSON.parse(event.body || '{}');

    // Enforce 3–10 photo rule server-side too
    if (!Array.isArray(images) || images.length < 3 || images.length > 10) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Provide between 3 and 10 images.' }) };
    }

    // 1) Upload to Cloudinary (silently — no status shown to user)
    //    Env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const uploadedUrls = [];

    if (cloudName && preset) {
      for (const img of images) {
        try {
          const form = new FormData();
          form.append('file', img); // data URI works with unsigned preset
          form.append('upload_preset', preset);
          const r = await FETCH(
            `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
            { method: 'POST', body: form }
          );
          if (r.ok) {
            const j = await r.json();
            uploadedUrls.push(j.secure_url);
          }
        } catch (_) { /* ignore individual failures */ }
      }
    }

    // 2) AI MOG check (deterministic, consistent per image set)
    //    Replace this block with your preferred AI API later — just keep the output shape.
    const scores = images.map(base64 => {
      let h = 0;
      for (let i = 0; i < base64.length; i += 97) {
        h = ((h << 5) - h) + base64.charCodeAt(i);
        h |= 0;
      }
      return (Math.abs(h) % 100) + 1;
    });
    const mogScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    let verdict, advice;
    if (mogScore > 80) { verdict = 'GIGACHAD'; advice = 'Unreal jawline. MOG level: MAXIMUM.'; }
    else if (mogScore > 60) { verdict = 'Chadlite'; advice = 'Strong features. You mog most people.'; }
    else if (mogScore > 40) { verdict = 'Normie'; advice = 'Average mog. Room to ascend.'; }
    else if (mogScore > 20) { verdict = 'Sub-5'; advice = 'Need mewing and jaw training.'; }
    else { verdict = 'Mogged'; advice = 'Brutal. Focus on looksmaxxing.'; }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mogScore, verdict, advice, photoCount: images.length, _uploaded: uploadedUrls.length })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Analysis failed.' }) };
  }
};
