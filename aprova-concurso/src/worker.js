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
        supabase: Boolean(
          env.SUPABASE_URL &&
          env.SUPABASE_SERVICE_ROLE_KEY
        ),
        debug: {
          tem_SUPABASE_URL: Boolean(env.SUPABASE_URL),
          tem_SUPABASE_SERVICE_ROLE_KEY: Boolean(
            env.SUPABASE_SERVICE_ROLE_KEY
          ),
          variaveis_visiveis: Object.keys(env).sort(),
        },
      });
    }

    if (
      url.pathname === "/api/ai/analisar-edital" &&
      request.method === "POST"
    ) {
      return analisarEdital(request, env);
    }

    if (
      url.pathname === "/api/ai/salvar-edital" &&
      request.method === "POST"
    ) {
      return salvarEdital(request, env);
    }

    if (url.pathname.startsWith("/api/")) {
      return json(
        {
          ok: false,
          erro: "API existe, mas a rota não foi encontrada.",
          path: url.pathname,
        },
        404
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Aprova Concurso DEV", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  },
};

async function analisarEdital(request, env) {
  try {
    if (!env.AI) {
      return json(
        {
          ok: false,
          erro:
            "Binding Workers AI não encontrado. Verifique se existe um binding chamado AI na Cloudflare.",
        },
        500
      );
    }

    const contentType = String(
      request.headers.get("content-type") || ""
    ).toLowerCase();

    let textoEdital = "";
    let nomeArquivo = "";
    let tipoArquivo = "";

    /*
     * O HTML atual envia application/json.
     *
     * Estrutura esperada:
     * {
     *   "nome_arquivo": "...",
     *   "tipo_arquivo": "...",
     *   "texto_edital": "...",
     *   "texto": "..."
     * }
     */
    if (contentType.includes("application/json")) {
      let body;

      try {
        body = await request.json();
      } catch {
        return json(
          {
            ok: false,
            erro: "O corpo da requisição não contém um JSON válido.",
          },
          400
        );
      }

      nomeArquivo = String(
        body.nome_arquivo ||
        body.nomeArquivo ||
        body.filename ||
        ""
      ).trim();

      tipoArquivo = String(
        body.tipo_arquivo ||
        body.tipoArquivo ||
        body.type ||
        ""
      ).trim();

      textoEdital = String(
        body.texto_edital ||
        body.textoEdital ||
        body.texto ||
        body.conteudo ||
        ""
      ).trim();
    }

    /*
     * Mantém compatibilidade com formulários que enviem
     * multipart/form-data ou application/x-www-form-urlencoded.
     */
    else if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await request.formData();

      const arquivo = formData.get("arquivo");
      const textoFormulario =
        formData.get("texto_edital") ||
        formData.get("texto") ||
        formData.get("conteudo");

      if (
        arquivo &&
        typeof arquivo === "object" &&
        typeof arquivo.text === "function"
      ) {
        textoEdital = String(await arquivo.text()).trim();
        nomeArquivo = String(arquivo.name || "").trim();
        tipoArquivo = String(arquivo.type || "").trim();
      } else if (textoFormulario) {
        textoEdital = String(textoFormulario).trim();
        nomeArquivo = String(
          formData.get("nome_arquivo") || ""
        ).trim();
        tipoArquivo = String(
          formData.get("tipo_arquivo") || ""
        ).trim();
      }
    }

    /*
     * Permite também texto puro para testes manuais.
     */
    else if (contentType.includes("text/plain")) {
      textoEdital = String(await request.text()).trim();
      tipoArquivo = "text/plain";
    }

    /*
     * Qualquer outro Content-Type é recusado com erro 415.
     */
    else {
      return json(
        {
          ok: false,
          erro:
            `Content-Type não suportado: ${contentType || "não informado"}.`,
          formatos_aceitos: [
            "application/json",
            "multipart/form-data",
            "application/x-www-form-urlencoded",
            "text/plain",
          ],
        },
        415
      );
    }

    if (!textoEdital) {
      return json(
        {
          ok: false,
          erro:
            "Nenhum texto de edital foi recebido. Envie o campo 'texto_edital' ou 'texto'.",
        },
        400
      );
    }

    if (textoEdital.length < 50) {
      return json(
        {
          ok: false,
          erro:
            "O texto do edital está vazio ou possui conteúdo insuficiente para análise.",
        },
        400
      );
    }

    /*
     * Evita enviar textos excessivamente grandes ao modelo.
     */
    const MAX_CHARS_TO_AI = 95000;
    const textoLimitado = textoEdital.slice(0, MAX_CHARS_TO_AI);
    const textoFoiCortado = textoEdital.length > MAX_CHARS_TO_AI;

    const prompt = `
Você é um especialista em análise e verticalização de editais de concursos públicos.

Analise o edital fornecido e retorne SOMENTE um JSON válido.

Não use markdown.
Não use blocos de código.
Não faça comentários.
Não escreva qualquer texto antes ou depois do JSON.

O JSON deve seguir exatamente esta estrutura:

{
  "concurso": {
    "nome": "",
    "orgao": "",
    "cargo": "",
    "banca": "",
    "data_prova": "AAAA-MM-DD"
  },
  "disciplinas": [
    {
      "nome": "",
      "prioridade": "alta",
      "peso": 1,
      "topicos": [
        {
          "nome": "",
          "concluido": false
        }
      ]
    }
  ],
  "estrategia": ""
}

REGRAS OBRIGATÓRIAS:

1. Extraia todas as disciplinas presentes no conteúdo programático.
2. Extraia todos os tópicos e subtópicos de cada disciplina.
3. Não resuma excessivamente os tópicos.
4. Preserve a terminologia utilizada no edital.
5. Não misture tópicos de disciplinas diferentes.
6. O campo "prioridade" deve conter somente:
   - "alta"
   - "media"
   - "baixa"
7. Use prioridade "alta" para:
   - disciplinas com maior número de questões;
   - disciplinas com maior peso;
   - conhecimentos específicos;
   - matérias centrais para o cargo.
8. Use prioridade "media" para matérias importantes, mas secundárias.
9. Use prioridade "baixa" para matérias de menor incidência ou peso.
10. O campo "peso" deve ser um número inteiro igual ou maior que 1.
11. Use o número de questões ou o peso indicado no edital como referência.
12. Todos os tópicos devem iniciar com:
    "concluido": false
13. A data da prova deve usar o formato AAAA-MM-DD.
14. Caso uma informação do concurso não esteja disponível, use uma string vazia.
15. Não invente disciplinas, datas, cargos, órgãos, bancas ou tópicos.
16. O campo "estrategia" deve conter uma orientação curta de priorização dos estudos.
17. Retorne somente JSON sintaticamente válido.

DADOS DO ARQUIVO:

Nome: ${nomeArquivo || "não informado"}
Tipo: ${tipoArquivo || "não informado"}

CONTEÚDO DO EDITAL:

${textoLimitado}
`;

    const resposta = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages: [
          {
            role: "system",
            content:
              "Você extrai e organiza dados de editais de concursos públicos. Responda exclusivamente com JSON válido.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }
    );

    const textoResposta = obterTextoDaRespostaAi(resposta);
    const resultado = extrairJson(textoResposta);
    const resultadoNormalizado = normalizarResultado(resultado);

    return json({
      ok: true,
      resultado: resultadoNormalizado,

      /*
       * Campos adicionais para manter compatibilidade
       * com versões anteriores do HTML.
       */
      resposta: resultadoNormalizado,
      arquivo: {
        nome: nomeArquivo || null,
        tipo: tipoArquivo || null,
        caracteres_recebidos: textoEdital.length,
        caracteres_analisados: textoLimitado.length,
        texto_cortado: textoFoiCortado,
      },
    });
  } catch (error) {
    console.error("Erro ao analisar edital:", error);

    return json(
      {
        ok: false,
        erro:
          error instanceof Error
            ? error.message
            : "Erro desconhecido durante a análise do edital.",
      },
      500
    );
  }
}

async function salvarEdital(request, env) {
  try {
    if (
      !env.SUPABASE_URL ||
      !env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(
        {
          ok: false,
          erro:
            "Variáveis do Supabase não configuradas na Cloudflare.",
          debug: {
            tem_SUPABASE_URL: Boolean(env.SUPABASE_URL),
            tem_SUPABASE_SERVICE_ROLE_KEY: Boolean(
              env.SUPABASE_SERVICE_ROLE_KEY
            ),
            variaveis_visiveis: Object.keys(env).sort(),
          },
        },
        500
      );
    }

    const contentType = String(
      request.headers.get("content-type") || ""
    ).toLowerCase();

    if (!contentType.includes("application/json")) {
      return json(
        {
          ok: false,
          erro:
            "A rota salvar-edital aceita somente application/json.",
        },
        415
      );
    }

    const body = await request.json();
    const dados = body.resultado || body;

    if (
      !dados.concurso ||
      !Array.isArray(dados.disciplinas)
    ) {
      return json(
        {
          ok: false,
          erro:
            "JSON inválido. Era esperada uma estrutura com concurso e disciplinas.",
        },
        400
      );
    }

    const concurso = dados.concurso;

    const concursoCriado = await supabaseInsert(
      env,
      "concursos",
      {
        nome: concurso.nome || null,
        orgao: concurso.orgao || null,
        cargo: concurso.cargo || null,
        banca: concurso.banca || null,
        data_prova: concurso.data_prova || null,
      }
    );

    if (!concursoCriado || !concursoCriado.id) {
      throw new Error(
        "O Supabase não retornou o ID do concurso criado."
      );
    }

    const concursoId = concursoCriado.id;

    let totalDisciplinas = 0;
    let totalTopicos = 0;

    for (const disciplina of dados.disciplinas) {
      if (!disciplina || !disciplina.nome) {
        continue;
      }

      const disciplinaCriada = await supabaseInsert(
        env,
        "disciplinas",
        {
          concurso_id: concursoId,
          nome: String(disciplina.nome).trim(),
          prioridade: normalizarPrioridade(
            disciplina.prioridade
          ),
          peso: Math.max(
            1,
            Number(disciplina.peso) || 1
          ),
        }
      );

      if (
        !disciplinaCriada ||
        !disciplinaCriada.id
      ) {
        throw new Error(
          `O Supabase não retornou o ID da disciplina ${disciplina.nome}.`
        );
      }

      totalDisciplinas++;

      const topicos = Array.isArray(disciplina.topicos)
        ? disciplina.topicos
        : [];

      for (const topico of topicos) {
        const nomeTopico =
          typeof topico === "string"
            ? topico.trim()
            : String(topico?.nome || "").trim();

        if (!nomeTopico) {
          continue;
        }

        await supabaseInsert(env, "topicos", {
          disciplina_id: disciplinaCriada.id,
          nome: nomeTopico,
          status:
            typeof topico === "object" &&
            topico?.status
              ? topico.status
              : "pendente",
        });

        totalTopicos++;
      }
    }

    return json({
      ok: true,
      concurso_id: concursoId,
      disciplinas_salvas: totalDisciplinas,
      topicos_salvos: totalTopicos,
    });
  } catch (error) {
    console.error("Erro ao salvar edital:", error);

    return json(
      {
        ok: false,
        erro:
          error instanceof Error
            ? error.message
            : "Erro desconhecido ao salvar o edital.",
      },
      500
    );
  }
}

async function supabaseInsert(env, tabela, payload) {
  const baseUrl = String(env.SUPABASE_URL || "")
    .replace(/\/+$/, "");

  const response = await fetch(
    `${baseUrl}/rest/v1/${tabela}`,
    {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization:
          `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  let data;

  try {
    data = await response.json();
  } catch {
    data = {
      erro: await response.text(),
    };
  }

  if (!response.ok) {
    throw new Error(
      `Erro ao inserir em ${tabela}: ${JSON.stringify(data)}`
    );
  }

  if (!Array.isArray(data) || !data.length) {
    throw new Error(
      `O Supabase não retornou o registro criado em ${tabela}.`
    );
  }

  return data[0];
}

function obterTextoDaRespostaAi(resposta) {
  if (typeof resposta === "string") {
    return resposta;
  }

  if (typeof resposta?.response === "string") {
    return resposta.response;
  }

  if (typeof resposta?.result === "string") {
    return resposta.result;
  }

  if (typeof resposta?.text === "string") {
    return resposta.text;
  }

  if (
    resposta?.result &&
    typeof resposta.result.response === "string"
  ) {
    return resposta.result.response;
  }

  return JSON.stringify(resposta);
}

function extrairJson(texto) {
  const conteudo = String(texto || "").trim();

  if (!conteudo) {
    throw new Error("A IA retornou uma resposta vazia.");
  }

  /*
   * Primeira tentativa: a resposta inteira já é JSON.
   */
  try {
    return JSON.parse(conteudo);
  } catch {
    // Continua para a extração do primeiro objeto JSON.
  }

  /*
   * Remove cercas de markdown eventualmente inseridas pelo modelo.
   */
  const semMarkdown = conteudo
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(semMarkdown);
  } catch {
    // Continua para a localização por chaves.
  }

  const inicio = semMarkdown.indexOf("{");
  const fim = semMarkdown.lastIndexOf("}");

  if (
    inicio === -1 ||
    fim === -1 ||
    fim <= inicio
  ) {
    throw new Error(
      "A IA não retornou um objeto JSON reconhecível."
    );
  }

  const bruto = semMarkdown.slice(inicio, fim + 1);

  try {
    return JSON.parse(bruto);
  } catch (error) {
    throw new Error(
      `A IA retornou JSON inválido: ${error.message}`
    );
  }
}

function normalizarResultado(resultado) {
  if (
    !resultado ||
    typeof resultado !== "object"
  ) {
    throw new Error(
      "A estrutura retornada pela IA é inválida."
    );
  }

  const concursoBruto =
    resultado.concurso &&
    typeof resultado.concurso === "object"
      ? resultado.concurso
      : {};

  const disciplinasBrutas = Array.isArray(
    resultado.disciplinas
  )
    ? resultado.disciplinas
    : [];

  if (!disciplinasBrutas.length) {
    throw new Error(
      "A IA não identificou disciplinas no edital."
    );
  }

  const disciplinas = disciplinasBrutas
    .map((disciplina, indice) => {
      const dados =
        disciplina &&
        typeof disciplina === "object"
          ? disciplina
          : {
              nome: String(disciplina || ""),
            };

      const topicosBrutos = Array.isArray(
        dados.topicos
      )
        ? dados.topicos
        : Array.isArray(dados.assuntos)
          ? dados.assuntos
          : [];

      const topicos = topicosBrutos
        .map((topico) => {
          const nome =
            typeof topico === "string"
              ? topico.trim()
              : String(
                  topico?.nome ||
                  topico?.assunto ||
                  ""
                ).trim();

          if (!nome) {
            return null;
          }

          return {
            nome,
            concluido: false,
          };
        })
        .filter(Boolean);

      return {
        nome: String(
          dados.nome ||
          dados.materia ||
          `Disciplina ${indice + 1}`
        ).trim(),
        prioridade: normalizarPrioridade(
          dados.prioridade
        ),
        peso: Math.max(
          1,
          Math.round(Number(dados.peso) || 1)
        ),
        topicos,
      };
    })
    .filter(
      (disciplina) =>
        disciplina.nome &&
        disciplina.topicos.length
    );

  if (!disciplinas.length) {
    throw new Error(
      "Nenhuma disciplina com tópicos válidos foi identificada."
    );
  }

  return {
    concurso: {
      nome: String(
        concursoBruto.nome ||
        concursoBruto.titulo ||
        ""
      ).trim(),
      orgao: String(
        concursoBruto.orgao ||
        concursoBruto.órgão ||
        ""
      ).trim(),
      cargo: String(
        concursoBruto.cargo || ""
      ).trim(),
      banca: String(
        concursoBruto.banca || ""
      ).trim(),
      data_prova: normalizarData(
        concursoBruto.data_prova ||
        concursoBruto.prova ||
        ""
      ),
    },
    disciplinas,
    estrategia: String(
      resultado.estrategia ||
      concursoBruto.estrategia ||
      ""
    ).trim(),
  };
}

function normalizarData(valor) {
  const texto = String(valor || "").trim();

  if (!texto) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return texto;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split("/");
    return `${ano}-${mes}-${dia}`;
  }

  return "";
}

function normalizarPrioridade(valor) {
  const prioridade = String(
    valor || "media"
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (prioridade === "alta") {
    return "alta";
  }

  if (prioridade === "baixa") {
    return "baixa";
  }

  return "media";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
  };
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        ...corsHeaders(),
      },
    }
  );
}
