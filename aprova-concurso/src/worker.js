export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ping") {
      return json({
        ok: true,
        rota: "/api/ping",
        mensagem: "Worker DEV respondendo corretamente.",
        path: url.pathname
      });
    }

    if (url.pathname === "/api/ai/teste") {
      return handleAiTeste(env);
    }

    if (url.pathname === "/api/ai/analisar-edital" && request.method === "POST") {
      return handleAnalisarEdital(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({
        ok: false,
        erro: "API existe, mas rota não encontrada",
        path: url.pathname
      }, 404);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function handleAiTeste(env) {
  try {
    if (!env.AI) {
      return json({
        ok: false,
        erro: "Binding env.AI não encontrado."
      }, 500);
    }

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
      rota: "/api/ai/teste",
      resposta
    });

  } catch (error) {
    return json({
      ok: false,
      rota: "/api/ai/teste",
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
      rota: "/api/ai/analisar-edital",
      resposta
    });

  } catch (error) {
    return json({
      ok: false,
      rota: "/api/ai/analisar-edital",
      erro: error.message || "Erro ao analisar edital."
    }, 500);
  }
}
