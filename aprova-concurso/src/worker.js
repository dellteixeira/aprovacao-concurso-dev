export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Rota de teste da IA
    if (url.pathname === "/api/ai/teste" && request.method === "GET") {
      return handleAiTeste(env);
    }

    // Rota para análise de edital/texto
    if (url.pathname === "/api/ai/analisar-edital" && request.method === "POST") {
      return handleAnalisarEdital(request, env);
    }

    // Entrega o HTML/CSS/JS da pasta public
    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

async function handleAiTeste(env) {
  try {
    const resposta = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content: "Você é um assistente objetivo especializado em estudos para concursos públicos."
        },
        {
          role: "user",
          content: "Responda em uma frase: a integração da IA do Aprova Concurso DEV está funcionando?"
        }
      ]
    });

    return json({
      ok: true,
      resposta
    });
  } catch (error) {
    return json({
      ok: false,
      erro: error.message || "Erro ao chamar Workers AI."
    }, 500);
  }
}

async function handleAnalisarEdital(request, env) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.texto !== "string") {
      return json({
        ok: false,
        erro: "Envie um JSON com o campo texto."
      }, 400);
    }

    const texto = body.texto.trim();

    if (texto.length < 50) {
      return json({
        ok: false,
        erro: "O texto enviado é muito curto para análise."
      }, 400);
    }

    const textoLimitado = texto.slice(0, 12000);

    const prompt = `
Analise o texto de edital abaixo para um aplicativo de estudos para concursos públicos.

Retorne SOMENTE JSON válido, sem markdown, neste formato:

{
  "concurso": {
    "nome": "",
    "orgao": "",
    "cargo": "",
    "banca": "",
    "data_prova": ""
  },
  "disciplinas": [
    {
      "nome": "",
      "prioridade": "alta|media|baixa",
      "justificativa": "",
      "topicos": [
        {
          "nome": "",
          "status": "pendente"
        }
      ]
    }
  ],
  "estrategia": ""
}

Texto do edital:
${textoLimitado}
`;

    const resposta = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content: "Você é um estrategista de concursos públicos. Retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return json({
      ok: true,
      resposta
    });
  } catch (error) {
    return json({
      ok: false,
      erro: error.message || "Erro ao analisar edital."
    }, 500);
  }
}
