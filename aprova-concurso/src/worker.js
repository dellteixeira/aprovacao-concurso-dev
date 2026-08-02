const MODELO_IA = "@cf/zai-org/glm-4.7-flash";
const LIMITE_CARACTERES_EDITAL = 95000;

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
        modelo: MODELO_IA,
        ai: Boolean(env.AI),
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
          erro: "API existente, mas a rota solicitada não foi encontrada.",
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

    const dadosRecebidos = await lerDadosDaRequisicao(request);

    const textoOriginal = String(
      dadosRecebidos.texto_edital ||
      dadosRecebidos.textoEdital ||
      dadosRecebidos.texto ||
      dadosRecebidos.conteudo ||
      ""
    ).trim();

    const nomeArquivo = String(
      dadosRecebidos.nome_arquivo ||
      dadosRecebidos.nomeArquivo ||
      dadosRecebidos.filename ||
      dadosRecebidos.arquivoNome ||
      ""
    ).trim();

    const tipoArquivo = String(
      dadosRecebidos.tipo_arquivo ||
      dadosRecebidos.tipoArquivo ||
      dadosRecebidos.type ||
      dadosRecebidos.arquivoTipo ||
      ""
    ).trim();

    if (!textoOriginal) {
      return json(
        {
          ok: false,
          erro:
            "Nenhum texto foi recebido. Envie o conteúdo em 'texto_edital' ou 'texto'.",
        },
        400
      );
    }

    if (textoOriginal.length < 50) {
      return json(
        {
          ok: false,
          erro:
            "O conteúdo extraído do edital está vazio ou possui texto insuficiente.",
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

    const respostaBruta = await env.AI.run(MODELO_IA, {
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em extração estruturada de editais de concursos públicos. Retorne somente um objeto JSON válido, sem markdown e sem explicações.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.1,

      /*
       * O parâmetro max_tokens foi substituído nos modelos mais
       * recentes por max_completion_tokens.
       */
      max_completion_tokens: 8000,

      /*
       * Solicita explicitamente uma resposta estruturada em JSON.
       */
      response_format: {
        type: "json_object",
      },
    });

    console.log(
      "Resposta bruta do Workers AI:",
      JSON.stringify(respostaBruta)
    );

    const respostaInterpretada =
      interpretarRespostaDaIa(respostaBruta);

    const resultadoNormalizado =
      normalizarResultado(respostaInterpretada);

    return json({
      ok: true,

      /*
       * Estrutura principal utilizada pelo aplicativo.
       */
      resultado: resultadoNormalizado,

      /*
       * Campos adicionais para compatibilidade com versões
       * anteriores do HTML.
       */
      resposta: resultadoNormalizado,
      analise: resultadoNormalizado,

      arquivo: {
        nome: nomeArquivo || null,
        tipo: tipoArquivo || null,
        caracteres_recebidos: textoOriginal.length,
        caracteres_analisados: textoEdital.length,
        texto_cortado:
          textoOriginal.length > LIMITE_CARACTERES_EDITAL,
      },

      modelo: MODELO_IA,
    });
  } catch (error) {
    console.error("Erro completo ao analisar edital:", error);

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

/* =========================================================
   LEITURA DA REQUISIÇÃO
========================================================= */

async function lerDadosDaRequisicao(request) {
  const contentType = String(
    request.headers.get("content-type") || ""
  ).toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();

      if (!body || typeof body !== "object") {
        throw new Error("O corpo JSON está vazio.");
      }

      return body;
    } catch (error) {
      throw new Error(
        `O corpo da requisição não contém JSON válido: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`
      );
    }
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    const resultado = Object.fromEntries(formData.entries());

    const arquivo = formData.get("arquivo");

    if (
      arquivo &&
      typeof arquivo === "object" &&
      typeof arquivo.text === "function"
    ) {
      resultado.texto_edital = await arquivo.text();
      resultado.nome_arquivo = arquivo.name || "";
      resultado.tipo_arquivo = arquivo.type || "";
    }

    return resultado;
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
    }. Formatos aceitos: application/json, multipart/form-data, application/x-www-form-urlencoded e text/plain.`
  );
}

/* =========================================================
   PROMPT
========================================================= */

function montarPrompt({
  textoEdital,
  nomeArquivo,
  tipoArquivo,
}) {
  return `
Analise integralmente o edital de concurso público fornecido abaixo.

Retorne SOMENTE um objeto JSON válido.

Não use markdown.
Não use blocos de código.
Não escreva comentários.
Não escreva explicações antes ou depois do JSON.

A resposta deve seguir esta estrutura:

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

REGRAS:

1. Localize o conteúdo programático do edital.
2. Extraia todas as disciplinas existentes.
3. Extraia todos os tópicos e subtópicos de cada disciplina.
4. Não agrupe disciplinas diferentes em uma única disciplina.
5. Preserve os nomes e a terminologia do edital.
6. Não invente disciplinas ou tópicos.
7. Todos os tópicos devem conter:
   "concluido": false
8. Todos os tópicos devem conter:
   "status": "pendente"
9. O campo "prioridade" deve ser somente:
   "alta", "media" ou "baixa".
10. Use prioridade "alta" para disciplinas com:
    - maior quantidade de questões;
    - maior peso;
    - conhecimentos específicos;
    - importância central para o cargo.
11. Use prioridade "media" para disciplinas importantes, mas secundárias.
12. Use prioridade "baixa" para disciplinas acessórias ou de menor incidência.
13. O peso deve ser um número inteiro igual ou maior que 1.
14. Quando houver número de questões, utilize-o como referência para o peso.
15. A data deve ser convertida para o formato AAAA-MM-DD.
16. Quando uma informação do concurso não estiver presente, use uma string vazia.
17. A estratégia deve ser curta e indicar quais disciplinas devem ser priorizadas.
18. A propriedade "disciplinas" nunca pode ser omitida.
19. Cada disciplina deve possuir a propriedade "topicos".
20. Retorne somente JSON sintaticamente válido.

ARQUIVO:

Nome: ${nomeArquivo || "não informado"}
Tipo: ${tipoArquivo || "não informado"}

EDITAL:

${textoEdital}
`;
}

/* =========================================================
   INTERPRETAÇÃO DA RESPOSTA DA IA
========================================================= */

function interpretarRespostaDaIa(resposta) {
  if (!resposta) {
    throw new Error("A IA retornou uma resposta vazia.");
  }

  /*
   * Alguns modelos, especialmente em JSON Mode,
   * podem retornar diretamente um objeto.
   */
  if (possuiEstruturaDeEdital(resposta)) {
    return resposta;
  }

  if (
    resposta.result &&
    possuiEstruturaDeEdital(resposta.result)
  ) {
    return resposta.result;
  }

  /*
   * Formato:
   * {
   *   response: "{...}"
   * }
   */
  if (typeof resposta.response === "string") {
    return extrairJson(resposta.response);
  }

  /*
   * Formato:
   * {
   *   result: "{...}"
   * }
   */
  if (typeof resposta.result === "string") {
    return extrairJson(resposta.result);
  }

  /*
   * Formato OpenAI-compatible:
   * {
   *   choices: [
   *     {
   *       message: {
   *         content: "{...}"
   *       }
   *     }
   *   ]
   * }
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
      return extrairJson(escolha.message.content);
    }

    if (typeof escolha?.text === "string") {
      return extrairJson(escolha.text);
    }

    if (
      escolha?.delta &&
      typeof escolha.delta.content === "string"
    ) {
      return extrairJson(escolha.delta.content);
    }
  }

  /*
   * Formatos alternativos.
   */
  if (typeof resposta.text === "string") {
    return extrairJson(resposta.text);
  }

  if (typeof resposta.output_text === "string") {
    return extrairJson(resposta.output_text);
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
          // Continua para o próximo item.
        }
      }

      if (typeof item?.text === "string") {
        try {
          return extrairJson(item.text);
        } catch {
          // Continua.
        }
      }

      if (typeof item?.content === "string") {
        try {
          return extrairJson(item.content);
        } catch {
          // Continua.
        }
      }

      if (Array.isArray(item?.content)) {
        for (const parte of item.content) {
          if (typeof parte === "string") {
            try {
              return extrairJson(parte);
            } catch {
              // Continua.
            }
          }

          if (typeof parte?.text === "string") {
            try {
              return extrairJson(parte.text);
            } catch {
              // Continua.
            }
          }
        }
      }
    }
  }

  /*
   * Última tentativa: procurar JSON no objeto serializado.
   */
  const respostaSerializada = JSON.stringify(resposta);

  try {
    const resultado = extrairJson(respostaSerializada);

    if (possuiEstruturaDeEdital(resultado)) {
      return resultado;
    }
  } catch {
    // A mensagem detalhada será lançada abaixo.
  }

  console.error(
    "Formato de resposta não reconhecido:",
    respostaSerializada
  );

  throw new Error(
    "A resposta da IA foi recebida, mas não contém uma verticalização reconhecível."
  );
}

function possuiEstruturaDeEdital(valor) {
  return Boolean(
    valor &&
    typeof valor === "object" &&
    (
      Array.isArray(valor.disciplinas) ||
      Array.isArray(valor.materias)
    )
  );
}

/* =========================================================
   EXTRAÇÃO DE JSON
========================================================= */

function extrairJson(texto) {
  if (
    texto &&
    typeof texto === "object" &&
    !Array.isArray(texto)
  ) {
    return texto;
  }

  const conteudo = String(texto || "").trim();

  if (!conteudo) {
    throw new Error("A IA retornou texto vazio.");
  }

  /*
   * Tentativa 1: conteúdo inteiro.
   */
  try {
    return JSON.parse(conteudo);
  } catch {
    // Continua.
  }

  /*
   * Tentativa 2: remove blocos markdown.
   */
  const semMarkdown = conteudo
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(semMarkdown);
  } catch {
    // Continua.
  }

  /*
   * Tentativa 3: localiza o primeiro objeto JSON.
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

  const bruto = semMarkdown.slice(inicio, fim + 1);

  try {
    return JSON.parse(bruto);
  } catch (error) {
    throw new Error(
      `A IA retornou JSON inválido: ${
        error instanceof Error
          ? error.message
          : "erro de sintaxe"
      }`
    );
  }
}

/* =========================================================
   NORMALIZAÇÃO DO RESULTADO
========================================================= */

function normalizarResultado(resultado) {
  if (
    !resultado ||
    typeof resultado !== "object"
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

  const disciplinasFonte = Array.isArray(
    resultado.disciplinas
  )
    ? resultado.disciplinas
    : Array.isArray(resultado.materias)
      ? resultado.materias
      : [];

  if (!disciplinasFonte.length) {
    console.error(
      "Resultado sem disciplinas:",
      JSON.stringify(resultado)
    );

    throw new Error(
      "A IA não identificou disciplinas no edital."
    );
  }

  const disciplinas = disciplinasFonte
    .map((item, indice) => {
      const disciplina =
        item && typeof item === "object"
          ? item
          : {
              nome: String(item || ""),
            };

      const nomeDisciplina = String(
        disciplina.nome ||
        disciplina.materia ||
        disciplina.disciplina ||
        `Disciplina ${indice + 1}`
      ).trim();

      const topicosFonte = Array.isArray(
        disciplina.topicos
      )
        ? disciplina.topicos
        : Array.isArray(disciplina.assuntos)
          ? disciplina.assuntos
          : Array.isArray(disciplina.conteudos)
            ? disciplina.conteudos
            : [];

      const topicos = topicosFonte
        .map((itemTopico, numero) => {
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
            ordem: numero,
          };
        })
        .filter(Boolean);

      return {
        nome: nomeDisciplina,
        prioridade: normalizarPrioridade(
          disciplina.prioridade
        ),
        peso: normalizarPeso(disciplina.peso),
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

  const estrategia = String(
    resultado.estrategia ||
    concursoFonte.estrategia ||
    ""
  ).trim();

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

    estrategia,
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

  if (!Number.isFinite(peso) || peso < 1) {
    return 1;
  }

  return Math.max(1, Math.round(peso));
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

function removerAcentos(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
    const dadosBrutos =
      body.resultado ||
      body.analise ||
      body;

    const dados = normalizarResultado(dadosBrutos);

    const userId = String(
      body.user_id ||
      body.userId ||
      ""
    ).trim();

    const concursoIdExistente = String(
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

    let concursoId = concursoIdExistente;

    if (concursoIdExistente) {
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
            dados.concurso.data_prova || null,
          estado: "ativo",
          updated_at: new Date().toISOString(),
        },
        {
          id: concursoIdExistente,
          user_id: userId,
        }
      );
    } else {
      const concursoCriado = await supabaseInsert(
        env,
        "concursos",
        {
          user_id: userId,
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
            dados.concurso.data_prova || null,
          estado: "ativo",
          ativo: true,
        }
      );

      if (!concursoCriado?.id) {
        throw new Error(
          "O Supabase não retornou o ID do concurso."
        );
      }

      concursoId = concursoCriado.id;
    }

    let totalDisciplinas = 0;
    let totalTopicos = 0;

    for (
      let indice = 0;
      indice < dados.disciplinas.length;
      indice++
    ) {
      const disciplina = dados.disciplinas[indice];

      const disciplinaCriada = await supabaseInsert(
        env,
        "disciplinas",
        {
          concurso_id: concursoId,
          user_id: userId,
          nome: disciplina.nome,
          prioridade: disciplina.prioridade,
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
        let numero = 0;
        numero < disciplina.topicos.length;
        numero++
      ) {
        const topico = disciplina.topicos[numero];

        await supabaseInsert(
          env,
          "topicos",
          {
            disciplina_id: disciplinaCriada.id,
            concurso_id: concursoId,
            user_id: userId,
            nome: topico.nome,
            status: "pendente",
            concluido: false,
            ordem: numero,
          }
        );

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

/* =========================================================
   FUNÇÕES DO SUPABASE
========================================================= */

async function supabaseInsert(
  env,
  tabela,
  payload
) {
  const baseUrl = obterSupabaseUrl(env);

  const response = await fetch(
    `${baseUrl}/rest/v1/${tabela}`,
    {
      method: "POST",
      headers: supabaseHeaders(env, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
    }
  );

  const data = await lerRespostaHttp(response);

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

async function supabaseUpdate(
  env,
  tabela,
  payload,
  filtros
) {
  const baseUrl = obterSupabaseUrl(env);
  const query = new URLSearchParams();

  for (const [campo, valor] of Object.entries(filtros)) {
    query.set(campo, `eq.${valor}`);
  }

  const response = await fetch(
    `${baseUrl}/rest/v1/${tabela}?${query.toString()}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(env, {
        Prefer: "return=representation",
      }),
      body: JSON.stringify(payload),
    }
  );

  const data = await lerRespostaHttp(response);

  if (!response.ok) {
    throw new Error(
      `Erro ao atualizar ${tabela}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

function obterSupabaseUrl(env) {
  return String(env.SUPABASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
}

function supabaseHeaders(
  env,
  adicionais = {}
) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...adicionais,
  };
}

async function lerRespostaHttp(response) {
  const texto = await response.text();

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
   RESPOSTAS HTTP
========================================================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
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
        ...corsHeaders(),
      },
    }
  );
}
