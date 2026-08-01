export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "Aprova Concurso DEV",
        ai: Boolean(env.AI),
        supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
      });
    }

    if (url.pathname === "/api/ai/analisar-edital" && request.method === "POST") {
      return analisarEdital(request, env);
    }

    if (url.pathname === "/api/ai/salvar-edital" && request.method === "POST") {
      return salvarEdital(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({
        ok: false,
        erro: "API existe, mas rota não encontrada",
        path: url.pathname,
      }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};

async function analisarEdital(request, env) {
  try {
    if (!env.AI) {
      return json({
        ok: false,
        erro: "Binding Workers AI não encontrado. Verifique se existe um binding chamado AI na Cloudflare.",
      }, 500);
    }

    const formData = await request.formData();
    const arquivo = formData.get("arquivo");

    if (!arquivo) {
      return json({
        ok: false,
        erro: "Nenhum arquivo enviado. O campo esperado é 'arquivo'.",
      }, 400);
    }

    const textoEdital = await arquivo.text();

    if (!textoEdital || textoEdital.trim().length < 20) {
      return json({
        ok: false,
        erro: "O arquivo enviado está vazio ou possui texto insuficiente.",
      }, 400);
    }

    const prompt = `
Você é um especialista em concursos públicos.

Analise o edital abaixo e retorne SOMENTE JSON válido, sem markdown, sem comentários e sem qualquer texto fora do JSON.

Formato obrigatório:

{
  "concurso": {
    "nome": "",
    "orgao": "",
    "cargo": "",
    "banca": "",
    "data_prova": "AAAA-MM-DD",
    "estrategia": ""
  },
  "disciplinas": [
    {
      "nome": "",
      "prioridade": "alta|media|baixa",
      "peso": 1,
      "topicos": [
        {
          "nome": "",
          "status": "pendente"
        }
      ]
    }
  ]
}

Regras obrigatórias:
- Extraia todas as disciplinas relevantes do edital.
- Extraia todos os tópicos de cada disciplina.
- Use prioridade alta para matérias centrais, recorrentes ou com maior peso.
- Use prioridade média para matérias importantes, mas secundárias.
- Use prioridade baixa para tópicos acessórios.
- Se a data da prova não estiver clara, use null.
- O campo status dos tópicos deve ser sempre "pendente".
- Não invente dados inexistentes; use null quando necessário.
- Retorne somente JSON válido.

EDITAL:
${textoEdital}
`;

    const resposta = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content: "Você é um extrator de dados de edital. Sua resposta deve ser somente JSON válido.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const textoResposta =
      resposta.response ||
      resposta.result ||
      resposta.text ||
      JSON.stringify(resposta);

    const resultado = extrairJson(textoResposta);

    return json({
      ok: true,
      resultado,
    });
  } catch (error) {
    return json({
      ok: false,
      erro: error.message,
    }, 500);
  }
}

async function salvarEdital(request, env) {
  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return json({
        ok: false,
        erro: "Variáveis do Supabase não configuradas na Cloudflare.",
      }, 500);
    }

    const body = await request.json();
    const dados = body.resultado || body;

    if (!dados.concurso || !Array.isArray(dados.disciplinas)) {
      return json({
        ok: false,
        erro: "JSON inválido. Esperado: concurso e disciplinas.",
      }, 400);
    }

    const concurso = dados.concurso;

    const concursoCriado = await supabaseInsert(env, "concursos", {
      nome: concurso.nome || null,
      orgao: concurso.orgao || null,
      cargo: concurso.cargo || null,
      banca: concurso.banca || null,
      data_prova: concurso.data_prova || null,
      estrategia: concurso.estrategia || null,
    });

    const concursoId = concursoCriado.id;
    let totalTopicos = 0;

    for (const disciplina of dados.disciplinas) {
      if (!disciplina.nome) continue;

      const disciplinaCriada = await supabaseInsert(env, "disciplinas", {
        concurso_id: concursoId,
        nome: disciplina.nome,
        prioridade: normalizarPrioridade(disciplina.prioridade),
        peso: disciplina.peso || 1,
      });

      const topicos = Array.isArray(disciplina.topicos) ? disciplina.topicos : [];

      for (const topico of topicos) {
        if (!topico.nome) continue;

        await supabaseInsert(env, "topicos", {
          disciplina_id: disciplinaCriada.id,
          nome: topico.nome,
          status: topico.status || "pendente",
        });

        totalTopicos++;
      }
    }

    return json({
      ok: true,
      concurso_id: concursoId,
      disciplinas_salvas: dados.disciplinas.length,
      topicos_salvos: totalTopicos,
    });
  } catch (error) {
    return json({
      ok: false,
      erro: error.message,
    }, 500);
  }
}

async function supabaseInsert(env, tabela, payload) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${tabela}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Erro ao inserir em ${tabela}: ${JSON.stringify(data)}`);
  }

  return data[0];
}

function extrairJson(texto) {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");

  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error("A IA não retornou JSON válido.");
  }

  const bruto = texto.slice(inicio, fim + 1);
  return JSON.parse(bruto);
}

function normalizarPrioridade(valor) {
  const prioridade = String(valor || "media").toLowerCase();

  if (prioridade === "alta") return "alta";
  if (prioridade === "baixa") return "baixa";

  return "media";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    },
  });
}
