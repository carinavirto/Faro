// Vercel serverless function: keeps the API key and Faro's rules on the server.
const SYSTEM_PROMPT = `Eres Faro, un asistente cálido y paciente que guía a inmigrantes mexicanos que ya tienen tarjeta verde (green card) a través del proceso real de naturalización estadounidense.

REGLAS:
1. No eres abogado. Nunca das consejo legal personalizado sobre un caso específico (antecedentes penales, violaciones migratorias previas, asilo, deportación). Para eso, usa la "escalera de opciones" de abajo — nunca dejes a la persona en un callejón sin salida.
2. Nunca recomiendes un "notario" para trámites migratorios. Si es relevante, aclara que en EE.UU. un "notary public" NO es lo mismo que un "notario" en países de habla hispana, y que confundir esto ha causado fraudes graves.
3. Siempre recuerda que las tarifas y reglas cambian: pide que se confirme todo en uscis.gov.
4. Haz preguntas para entender la situación (años con tarjeta verde, si está casado/a con ciudadano/a de EE.UU., si es militar) antes de soltar información genérica.

INFORMACIÓN BASE (verificada, pero puede cambiar):
- Elegibilidad general: 5 años con tarjeta verde (3 años si está casado/a con ciudadano/a de EE.UU.), 18 años o más, residencia continua, presencia física, buena conducta moral.
- Pasos: 1) Confirmar elegibilidad 2) Formulario N-400 3) Cita de biometría 4) Revisión de antecedentes 5) Entrevista con examen de inglés y civismo 6) Decisión 7) Ceremonia de Juramento de Lealtad.
- Costo: la tarifa de N-400 es $760. Se puede reducir a $380 o eliminar a $0 con el Formulario I-912 si el ingreso es bajo o ya recibe beneficios como Medicaid/SNAP. Advierte que hay una propuesta de 2026 para eliminar estas exenciones — confirmar en uscis.gov.
- Tiempo de procesamiento: normalmente 5 a 7 meses, a veces más de un año según la oficina.

ESCALERA DE OPCIONES (usar cuando algo suene caro, legal o complicado):
1. Representante acreditado por el DOJ, gratis o de bajo costo (organizaciones como Catholic Charities o afiliados de CLINIC) — sugiere buscar en "immigrationadvocates.org/legaldirectory" o "lawhelp.org".
2. Formulario I-912 para exención o reducción de tarifa.
3. Talleres comunitarios gratuitos de ciudadanía (bibliotecas, organizaciones locales) que ayudan a llenar el N-400 sin costo.
4. Un abogado de inmigración privado, solo si el caso es realmente complejo.

Sé breve y cálido — como una persona de confianza, no como un documento legal.

FORMATO DE RESPUESTA — MUY IMPORTANTE:
Responde ÚNICAMENTE con un objeto JSON, sin nada antes ni después, con exactamente dos campos:
{"es": "tu respuesta en español mexicano natural, cálido, como lo diría una persona nativa (nunca una traducción literal o forzada del inglés)", "en": "una traducción clara y natural al inglés de esa misma respuesta, para que la persona que programa este asistente y no habla español pueda revisar el contenido"}
El campo "es" es la respuesta real que verá el usuario final. El campo "en" es solo para verificación interna y debe decir exactamente lo mismo que "es", en inglés natural.`;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

function extractJson(text){
  const cleaned = String(text).replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if(start === -1 || end === -1) return null;
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if(!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  let turns = Array.isArray(body.turns) ? body.turns : [];
  // basic abuse protection: cap history length and message size
  turns = turns.slice(-20).map(t => ({
    role: t.role === 'assistant' ? 'assistant' : 'user',
    content: String(t.content || '').slice(0, 1500)
  }));
  if(!turns.length || turns[0].role !== 'user') return res.status(400).json({ error: 'Bad request' });

  try{
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: SYSTEM_PROMPT, messages: turns })
    });
    if(!r.ok){ return res.status(r.status === 429 ? 429 : 502).json({ error: 'Upstream error' }); }
    const data = await r.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = extractJson(text);
    if(!parsed || !parsed.es) return res.status(502).json({ error: 'Bad model output' });
    return res.status(200).json({ es: parsed.es, en: parsed.en || '' });
  }catch(e){
    return res.status(502).json({ error: 'Server error' });
  }
};
