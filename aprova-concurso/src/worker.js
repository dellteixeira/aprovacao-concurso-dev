const MODELO_IA = "@cf/zai-org/glm-4.7-flash";
const LIMITE_CARACTERES_EDITAL = 60000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
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
          modelo: MODELO_IA,
          ai: Boolean(env.AI),
          assets: Boolean(env.ASSETS),
          supabase: Boolean(
            env.SUPABASE_URL &&
            env.SUPABASE_SERVICE_ROLE_KEY
          ),
          debug: {
            tem_AI: Boolean(env.AI),
            tem_ASSETS: Boolean(env.ASSETS),
            tem_SUPABASE_URL: Boolean(env.SUPABASE_URL),
            tem_SUPABASE_SERVICE_ROLE_KEY: Boolean(
              env.SUPABASE_SERVICE_ROLE_KEY
            ),
          },
        });
      }

      if (
        url.pathname === "/api/ai/analisar-edital" &&
        request.method === "POST"
      ) {
        return await analisarEdital(request, env);
      }

      if (
        url.pathname === "/api/ai/salvar-edital" &&
        request.method === "POST"
      ) {
        return await salvarEdital(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return json(
          {
            ok: false,
            erro: "API existente, mas a rota não foi encontrada.",
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
    } catch (error) {
      console.error("Erro não tratado no Worker:", error);

      return json(
        {
          ok: false,
          erro: obterMensagemErro(error),
        },
        500
      );
    }
  },
};

/* =========================================================
   ANÁLISE DO EDITAL
========================================================= */

async function analisarEdital(request, env) {
  try {
    if (!env.AI) {
      return json(
        {
          ok: false,
          erro:
            "Binding Workers AI não encontrado. Configure um binding chamado AI na Cloudflare.",
        },
        500
      );
    }

    const dados = await lerDadosDaRequisicao(request);

    const textoOriginal = String(
      dados.texto_edital ||
      dados.textoEdital ||
      dados.texto ||
      dados.conteudo ||
      ""
    ).trim();

    const nomeArquivo = String(
      dados.nome_arquivo ||
      dados.nomeArquivo ||
      dados.filename ||
      ""
    ).trim();

    const tipoArquivo = String(
      dados.tipo_arquivo ||
      dados.tipoArquivo ||
      dados.type ||
      ""
    ).trim();

    if (!textoOriginal) {
      return json(
        {
          ok: false,
          erro:
            "Nenhum texto de edital foi recebido. Envie o conteúdo no campo 'texto_edital' ou 'texto'.",
        },
        400
      );
    }

    if (textoOriginal.length < 50) {
      return json(
        {
          ok: false,
          erro:
            "O texto extraído do edital está vazio ou possui conteúdo insuficiente.",
        },
        400
      );
    }

    const textoEdital = textoOriginal.slice(
      0,
      LIMITE_CARACTERES_EDITAL
    );

    const prompt = montarPrompt({
      textoEdital,
      nomeArquivo,
      tipoArquivo,
    });

    /*
     * Chamada deliberadamente simples.
     * Não utiliza response_format, max_tokens,
     * max_completion_tokens nem streaming.
     */
    const respostaBruta = await env.AI.run(
      MODELO_IA,
      {
        messages: [
          {
            role: "system",
            content:
              "Você extrai informações de editais de concursos públicos. Responda somente com JSON válido, sem markdown, comentários ou explicações.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }
    );

    console.log(
      "Workers AI respondeu usando o modelo:",
      MODELO_IA
    );

    const respostaInterpretada =
      interpretarRespostaDaIa(respostaBruta);

    const resultado =
      normalizarResultado(respostaInterpretada);

    return json({
      ok: true,

      /*
       * Formatos mantidos para compatibilidade
       * com diferentes versões do HTML.
       */
      resultado,
      resposta: resultado,
      analise: resultado,

      arquivo: {
        nome: nomeArquivo || null,
        tipo: tipoArquivo || null,
        caracteres_recebidos: textoOriginal.length,
        caracteres_analisados: textoEdital.length,
        texto_cortado:
          textoOriginal.length >
          LIMITE_CARACTERES_EDITAL,
      },

      modelo: MODELO_IA,
    });
  } catch (error) {
    const mensagem = obterMensagemErro(error);

    console.error("Erro ao analisar edital:", {
      mensagem,
      modelo: MODELO_IA,
      stack:
        error instanceof Error
          ? error.stack
          : null,
    });

    return json(
      {
        ok: false,
        erro: mensagem,
        modelo: MODELO_IA,
      },
      500
    );
  }
}

/* =========================================================
   LEITURA DA REQUISIÇÃO
========================================================= */

async function lerDadosDaRequisicao(request) {
  const contentType = String(
    request.headers.get("content-type") || ""
  ).toLowerCase();

  if (contentType.includes("application/json")) {
    let body;

    try {
      body = await request.json();
    } catch (error) {
      throw new Error(
        `O corpo da requisição não contém JSON válido: ${obterMensagemErro(
          error
        )}`
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new Error(
        "O corpo JSON está vazio ou possui estrutura inválida."
      );
    }

    return body;
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes(
      "application/x-www-form-urlencoded"
    )
  ) {
    const formData = await request.formData();
    const dados = {};

    for (const [chave, valor] of formData.entries()) {
      if (typeof valor === "string") {
        dados[chave] = valor;
      }
    }

    const arquivo = formData.get("arquivo");

    if (
      arquivo &&
      typeof arquivo === "object" &&
      typeof arquivo.text === "function"
    ) {
      dados.texto_edital = await arquivo.text();
      dados.nome_arquivo =
        arquivo.name || "";
      dados.tipo_arquivo =
        arquivo.type || "";
    }

    return dados;
  }

  if (contentType.includes("text/plain")) {
    return {
      texto_edital: await request.text(),
      tipo_arquivo: "text/plain",
    };
  }

  throw new Error(
    `Content-Type não suportado: ${
      contentType || "não informado"
    }. Utilize application/json, multipart/form-data, application/x-www-form-urlencoded ou text/plain.`
  );
}

/* =========================================================
   PROMPT PARA VERTICALIZAÇÃO
========================================================= */

function montarPrompt({
  textoEdital,
  nomeArquivo,
  tipoArquivo,
}) {
  return `
Analise o edital de concurso público apresentado abaixo.

Retorne SOMENTE um objeto JSON válido.

Não utilize markdown.
Não utilize blocos de código.
Não escreva explicações.
Não escreva comentários.
Não escreva texto antes ou depois do JSON.

Use exatamente esta estrutura:

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
          "concluido": false,
          "status": "pendente"
        }
      ]
    }
  ],
  "estrategia": ""
}

REGRAS OBRIGATÓRIAS:

1. Identifique o concurso, órgão, cargo, banca e data da prova.
2. Identifique a seção de conteúdo programático.
3. Extraia todas as disciplinas.
4. Extraia todos os tópicos e subtópicos de cada disciplina.
5. Preserve os nomes e a terminologia utilizados no edital.
6. Não misture conteúdos de disciplinas diferentes.
7. Não invente disciplinas, tópicos ou informações.
8. Quando uma informação do concurso não existir, use uma string vazia.
9. A data da prova deve usar o formato AAAA-MM-DD.
10. O campo prioridade deve possuir apenas:
    "alta", "media" ou "baixa".
11. Utilize prioridade alta para matérias com maior peso, maior número de questões ou importância central.
12. Utilize prioridade media para matérias importantes, mas secundárias.
13. Utilize prioridade baixa para matérias acessórias ou com menor incidência.
14. O peso deve ser um número inteiro igual ou maior que 1.
15. Quando houver quantidade de questões, use-a como referência para o peso.
16. Cada tópico deve possuir "concluido": false.
17. Cada tópico deve possuir "status": "pendente".
18. A propriedade disciplinas não pode ser omitida.
19. Cada disciplina deve conter uma lista de tópicos.
20. O campo estrategia deve conter uma orientação curta de priorização dos estudos.

DADOS DO ARQUIVO:

Nome: ${nomeArquivo || "não informado"}
Tipo: ${tipoArquivo || "não informado"}

CONTEÚDO DO EDITAL:

${textoEdital}
`;
}

/* =========================================================
   INTERPRETAÇÃO DA RESPOSTA DA IA
========================================================= */

function interpretarRespostaDaIa(resposta) {
  if (!resposta) {
    throw new Error(
      "A IA retornou uma resposta vazia."
    );
  }

  /*
   * O modelo pode retornar diretamente
   * o objeto solicitado.
   */
  if (possuiEstruturaDeEdital(resposta)) {
    return resposta;
  }

  /*
   * Formato:
   * { response: "JSON..." }
   */
  if (typeof resposta.response === "string") {
    return extrairJson(resposta.response);
  }

  /*
   * Formato:
   * { result: "JSON..." }
   */
  if (typeof resposta.result === "string") {
    return extrairJson(resposta.result);
  }

  /*
   * Formato:
   * { result: { disciplinas: [...] } }
   */
  if (
    resposta.result &&
    possuiEstruturaDeEdital(resposta.result)
  ) {
    return resposta.result;
  }

  /*
   * Formato:
   * { result: { response: "JSON..." } }
   */
  if (
    resposta.result &&
    typeof resposta.result.response === "string"
  ) {
    return extrairJson(
      resposta.result.response
    );
  }

  /*
   * Formato OpenAI-compatible.
   */
  if (
    Array.isArray(resposta.choices) &&
    resposta.choices.length > 0
  ) {
    const escolha = resposta.choices[0];

    if (
      escolha?.message &&
      typeof escolha.message.content === "string"
    ) {
      return extrairJson(
        escolha.message.content
      );
    }

    if (typeof escolha?.text === "string") {
      return extrairJson(escolha.text);
    }

    if (
      escolha?.delta &&
      typeof escolha.delta.content === "string"
    ) {
      return extrairJson(
        escolha.delta.content
      );
    }
  }

  if (typeof resposta.text === "string") {
    return extrairJson(resposta.text);
  }

  if (
    typeof resposta.output_text === "string"
  ) {
    return extrairJson(
      resposta.output_text
    );
  }

  if (Array.isArray(resposta.output)) {
    for (const item of resposta.output) {
      if (possuiEstruturaDeEdital(item)) {
        return item;
      }

      if (typeof item === "string") {
        try {
          return extrairJson(item);
        } catch {
          // Tenta o próximo formato.
        }
      }

      if (typeof item?.text === "string") {
        try {
          return extrairJson(item.text);
        } catch {
          // Tenta o próximo formato.
        }
      }

      if (
        typeof item?.content === "string"
      ) {
        try {
          return extrairJson(
            item.content
          );
        } catch {
          // Tenta o próximo formato.
        }
      }

      if (Array.isArray(item?.content)) {
        for (const parte of item.content) {
          if (
            typeof parte?.text === "string"
          ) {
            try {
              return extrairJson(
                parte.text
              );
            } catch {
              // Continua.
            }
          }
        }
      }
    }
  }

  console.error(
    "Formato de resposta da IA não reconhecido:",
    JSON.stringify(resposta)
  );

  throw new Error(
    "A IA respondeu, mas o formato recebido não contém uma verticalização reconhecível."
  );
}

function possuiEstruturaDeEdital(valor) {
  return Boolean(
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor) &&
    (
      Array.isArray(valor.disciplinas) ||
      Array.isArray(valor.materias)
    )
  );
}

/* =========================================================
   EXTRAÇÃO E CORREÇÃO DO JSON
========================================================= */

function extrairJson(valor) {
  if (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor)
  ) {
    return valor;
  }

  const texto = String(valor || "").trim();

  if (!texto) {
    throw new Error(
      "A IA retornou um texto vazio."
    );
  }

  /*
   * Primeira tentativa:
   * resposta inteira como JSON.
   */
  try {
    return JSON.parse(texto);
  } catch {
    // Continua.
  }

  /*
   * Remove cercas de markdown.
   */
  const semMarkdown = texto
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(semMarkdown);
  } catch {
    // Continua.
  }

  /*
   * Procura o primeiro objeto JSON
   * entre a primeira e a última chave.
   */
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

  const trechoJson = semMarkdown.slice(
    inicio,
    fim + 1
  );

  try {
    return JSON.parse(trechoJson);
  } catch (error) {
    throw new Error(
      `A IA retornou JSON inválido: ${obterMensagemErro(
        error
      )}`
    );
  }
}

/* =========================================================
   NORMALIZAÇÃO DO RESULTADO
========================================================= */

function normalizarResultado(resultado) {
  if (
    !resultado ||
    typeof resultado !== "object" ||
    Array.isArray(resultado)
  ) {
    throw new Error(
      "A estrutura retornada pela IA é inválida."
    );
  }

  const concursoFonte =
    resultado.concurso &&
    typeof resultado.concurso === "object"
      ? resultado.concurso
      : {};

  const disciplinasFonte =
    Array.isArray(resultado.disciplinas)
      ? resultado.disciplinas
      : Array.isArray(resultado.materias)
        ? resultado.materias
        : [];

  if (!disciplinasFonte.length) {
    console.error(
      "Resposta da IA sem disciplinas:",
      JSON.stringify(resultado)
    );

    throw new Error(
      "A IA não identificou disciplinas no edital."
    );
  }

  const disciplinas = disciplinasFonte
    .map((item, indice) => {
      const disciplina =
        item &&
        typeof item === "object"
          ? item
          : {
              nome: String(item || ""),
            };

      const nome = String(
        disciplina.nome ||
        disciplina.materia ||
        disciplina.disciplina ||
        `Disciplina ${indice + 1}`
      ).trim();

      const topicosFonte =
        Array.isArray(disciplina.topicos)
          ? disciplina.topicos
          : Array.isArray(
              disciplina.assuntos
            )
            ? disciplina.assuntos
            : Array.isArray(
                disciplina.conteudos
              )
              ? disciplina.conteudos
              : [];

      const topicos = topicosFonte
        .map((itemTopico, ordem) => {
          const nomeTopico =
            typeof itemTopico === "string"
              ? itemTopico.trim()
              : String(
                  itemTopico?.nome ||
                  itemTopico?.assunto ||
                  itemTopico?.topico ||
                  itemTopico?.conteudo ||
                  ""
                ).trim();

          if (!nomeTopico) {
            return null;
          }

          return {
            nome: nomeTopico,
            concluido: false,
            status: "pendente",
            ordem,
          };
        })
        .filter(Boolean);

      return {
        nome,
        prioridade:
          normalizarPrioridade(
            disciplina.prioridade
          ),
        peso: normalizarPeso(
          disciplina.peso
        ),
        ordem: indice,
        topicos,
      };
    })
    .filter(
      (disciplina) =>
        disciplina.nome &&
        disciplina.topicos.length > 0
    );

  if (!disciplinas.length) {
    throw new Error(
      "A IA identificou disciplinas, mas não retornou tópicos válidos."
    );
  }

  return {
    concurso: {
      nome: String(
        concursoFonte.nome ||
        concursoFonte.titulo ||
        resultado.nome_concurso ||
        ""
      ).trim(),

      orgao: String(
        concursoFonte.orgao ||
        concursoFonte["órgão"] ||
        resultado.orgao ||
        ""
      ).trim(),

      cargo: String(
        concursoFonte.cargo ||
        resultado.cargo ||
        ""
      ).trim(),

      banca: String(
        concursoFonte.banca ||
        resultado.banca ||
        ""
      ).trim(),

      data_prova: normalizarData(
        concursoFonte.data_prova ||
        concursoFonte.prova ||
        resultado.data_prova ||
        ""
      ),
    },

    disciplinas,

    estrategia: String(
      resultado.estrategia ||
      concursoFonte.estrategia ||
      ""
    ).trim(),
  };
}

function normalizarPrioridade(valor) {
  const prioridade = removerAcentos(
    String(valor || "media")
  )
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

function normalizarPeso(valor) {
  const peso = Number(valor);

  if (
    !Number.isFinite(peso) ||
    peso < 1
  ) {
    return 1;
  }

  return Math.max(
    1,
    Math.round(peso)
  );
}

function normalizarData(valor) {
  const texto = String(
    valor || ""
  ).trim();

  if (!texto) {
    return "";
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(texto)
  ) {
    return texto;
  }

  if (
    /^\d{2}\/\d{2}\/\d{4}$/.test(texto)
  ) {
    const [dia, mes, ano] =
      texto.split("/");

    return `${ano}-${mes}-${dia}`;
  }

  return "";
}

function removerAcentos(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

/* =========================================================
   SALVAMENTO NO SUPABASE
========================================================= */

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
            tem_SUPABASE_URL: Boolean(
              env.SUPABASE_URL
            ),
            tem_SUPABASE_SERVICE_ROLE_KEY:
              Boolean(
                env.SUPABASE_SERVICE_ROLE_KEY
              ),
          },
        },
        500
      );
    }

    const contentType = String(
      request.headers.get(
        "content-type"
      ) || ""
    ).toLowerCase();

    if (
      !contentType.includes(
        "application/json"
      )
    ) {
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

    const dadosBrutos =
      body.resultado ||
      body.analise ||
      body.resposta ||
      body;

    const dados =
      normalizarResultado(
        dadosBrutos
      );

    const userId = String(
      body.user_id ||
      body.userId ||
      ""
    ).trim();

    const concursoId = String(
      body.concurso_id ||
      body.concursoId ||
      ""
    ).trim();

    if (!userId) {
      return json(
        {
          ok: false,
          erro:
            "O campo user_id é obrigatório para salvar o edital.",
        },
        400
      );
    }

    if (!concursoId) {
      return json(
        {
          ok: false,
          erro:
            "O campo concurso_id é obrigatório para salvar o edital no concurso ativo.",
        },
        400
      );
    }

    await supabaseUpdate(
      env,
      "concursos",
      {
        titulo:
          dados.concurso.nome || null,
        nome:
          dados.concurso.nome || null,
        orgao:
          dados.concurso.orgao || null,
        cargo:
          dados.concurso.cargo || null,
        banca:
          dados.concurso.banca || null,
        data_prova:
          dados.concurso.data_prova ||
          null,
        estado: "ativo",
        ativo: true,
        updated_at:
          new Date().toISOString(),
      },
      {
        id: concursoId,
        user_id: userId,
      }
    );

    let totalDisciplinas = 0;
    let totalTopicos = 0;

    for (
      let indice = 0;
      indice <
      dados.disciplinas.length;
      indice++
    ) {
      const disciplina =
        dados.disciplinas[indice];

      const disciplinaCriada =
        await supabaseInsert(
          env,
          "disciplinas",
          {
            concurso_id: concursoId,
            user_id: userId,
            nome: disciplina.nome,
            prioridade:
              disciplina.prioridade,
            peso: disciplina.peso,
            ordem: indice,
          }
        );

      if (!disciplinaCriada?.id) {
        throw new Error(
          `O Supabase não retornou o ID da disciplina "${disciplina.nome}".`
        );
      }

      totalDisciplinas++;

      for (
        let ordem = 0;
        ordem <
        disciplina.topicos.length;
        ordem++
      ) {
        const topico =
          disciplina.topicos[ordem];

        await supabaseInsert(
          env,
          "topicos",
          {
            disciplina_id:
              disciplinaCriada.id,
            concurso_id: concursoId,
            user_id: userId,
            nome: topico.nome,
            status: "pendente",
            concluido: false,
            ordem,
          }
        );

        totalTopicos++;
      }
    }

    return json({
      ok: true,
      concurso_id: concursoId,
      disciplinas_salvas:
        totalDisciplinas,
      topicos_salvos:
        totalTopicos,
    });
  } catch (error) {
    const mensagem =
      obterMensagemErro(error);

    console.error(
      "Erro ao salvar edital:",
      mensagem
    );

    return json(
      {
        ok: false,
        erro: mensagem,
      },
      500
    );
  }
}

/* =========================================================
   FUNÇÕES DO SUPABASE
========================================================= */

async function supabaseInsert(
  env,
  tabela,
  payload
) {
  const baseUrl =
    obterSupabaseUrl(env);

  const response = await fetch(
    `${baseUrl}/rest/v1/${tabela}`,
    {
      method: "POST",
      headers: {
        ...supabaseHeaders(env),
        Prefer:
          "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  const data =
    await lerRespostaHttp(response);

  if (!response.ok) {
    throw new Error(
      `Erro ao inserir em ${tabela}: ${JSON.stringify(
        data
      )}`
    );
  }

  if (
    !Array.isArray(data) ||
    !data.length
  ) {
    throw new Error(
      `O Supabase não retornou o registro criado em ${tabela}.`
    );
  }

  return data[0];
}

async function supabaseUpdate(
  env,
  tabela,
  payload,
  filtros
) {
  const baseUrl =
    obterSupabaseUrl(env);

  const parametros =
    new URLSearchParams();

  for (
    const [campo, valor]
    of Object.entries(filtros)
  ) {
    parametros.set(
      campo,
      `eq.${valor}`
    );
  }

  const response = await fetch(
    `${baseUrl}/rest/v1/${tabela}?${parametros.toString()}`,
    {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(env),
        Prefer:
          "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  const data =
    await lerRespostaHttp(response);

  if (!response.ok) {
    throw new Error(
      `Erro ao atualizar ${tabela}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}

function obterSupabaseUrl(env) {
  return String(
    env.SUPABASE_URL || ""
  )
    .trim()
    .replace(/\/+$/, "");
}

function supabaseHeaders(env) {
  return {
    apikey:
      env.SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

    "Content-Type":
      "application/json",
  };
}

async function lerRespostaHttp(
  response
) {
  const texto =
    await response.text();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

/* =========================================================
   RESPOSTAS HTTP E ERROS
========================================================= */

function obterMensagemErro(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return String(
    error ||
    "Erro desconhecido."
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, PATCH, OPTIONS",

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

        "Cache-Control":
          "no-store",

        ...corsHeaders(),
      },
    }
  );
}
