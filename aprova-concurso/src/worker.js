const MODELO_TESTE = "@cf/zai-org/glm-4.7-flash";
const MODELO_EXTRACAO = "@cf/meta/llama-3.1-8b-instruct-fast";
const MODELO_FALLBACK = "@cf/zai-org/glm-4.7-flash";

const TAMANHO_BLOCO = 8500;
const LIMITE_METADADOS = 14000;
const LIMITE_TEXTO_LEGADO = 68000;
const MAXIMO_BLOCOS_LEGADO = 8;
const SOBREPOSICAO_BLOCO = 800;
const MAXIMO_TENTATIVAS_IA = 3;
const ESPERA_REPETICAO_MS = 900;

const PRIORIDADES = ["alta", "media", "baixa"];

const ESQUEMA_TOPICO = {
  type: "object",
  additionalProperties: false,
  properties: {
    nome: { type: "string" },
    status: { type: "string", enum: ["pendente", "concluido"] }
  },
  required: ["nome", "status"]
};

const ESQUEMA_DISCIPLINA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nome: { type: "string" },
    grupo: { type: "string" },
    prioridade: { type: "string", enum: PRIORIDADES },
    peso: { type: "integer", minimum: 1 },
    quantidade_questoes: { type: ["integer", "null"], minimum: 0 },
    topicos: { type: "array", items: ESQUEMA_TOPICO }
  },
  required: [
    "nome",
    "grupo",
    "prioridade",
    "peso",
    "quantidade_questoes",
    "topicos"
  ]
};

const ESQUEMA_CARGO = {
  type: "object",
  additionalProperties: false,
  properties: {
    codigo: { type: "string" },
    nome: { type: "string" },
    especialidade: { type: "string" },
    nivel: { type: "string" },
    requisitos: { type: "string" },
    vagas: { type: ["integer", "null"], minimum: 0 },
    disciplinas: { type: "array", items: ESQUEMA_DISCIPLINA }
  },
  required: [
    "codigo",
    "nome",
    "especialidade",
    "nivel",
    "requisitos",
    "vagas",
    "disciplinas"
  ]
};

const ESQUEMA_METADADOS = {
  type: "object",
  additionalProperties: false,
  properties: {
    concurso: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome: { type: "string" },
        orgao: { type: "string" },
        banca: { type: "string" },
        numero_edital: { type: "string" },
        data_prova: { type: "string" }
      },
      required: ["nome", "orgao", "banca", "numero_edital", "data_prova"]
    },
    estrategia: { type: "string" }
  },
  required: ["concurso", "estrategia"]
};

const ESQUEMA_BLOCO = {
  type: "object",
  additionalProperties: false,
  properties: {
    cargos: { type: "array", items: ESQUEMA_CARGO }
  },
  required: ["cargos"]
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders()
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/health"
      ) {
        return json({
          ok: true,
          service: "Aprova Concurso DEV",
          versao: "multicargos-1.3.0-etapas",
          modelo_teste: MODELO_TESTE,
          modelo_extracao: MODELO_EXTRACAO,
          modelo_fallback: MODELO_FALLBACK,
          ai: Boolean(env.AI),
          assets: Boolean(env.ASSETS),
          supabase: Boolean(
            env.SUPABASE_URL &&
            env.SUPABASE_SERVICE_ROLE_KEY
          ),
          processamento: {
            tamanho_bloco: TAMANHO_BLOCO,
            limite_metadados: LIMITE_METADADOS,
            maximo_tentativas_ia: MAXIMO_TENTATIVAS_IA
          },
          debug: {
            tem_AI: Boolean(env.AI),
            tem_ASSETS: Boolean(env.ASSETS),
            tem_SUPABASE_URL: Boolean(env.SUPABASE_URL),
            tem_SUPABASE_SERVICE_ROLE_KEY: Boolean(
              env.SUPABASE_SERVICE_ROLE_KEY
            )
          }
        });
      }

      if (
        request.method === "GET" &&
        url.pathname === "/api/ai/teste"
      ) {
        return testarWorkersAI(env);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/ai/extrair-metadados"
      ) {
        return extrairMetadadosEndpoint(request, env);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/ai/analisar-bloco"
      ) {
        return analisarBlocoEndpoint(request, env);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/ai/finalizar-analise"
      ) {
        return finalizarAnaliseEndpoint(request);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/ai/analisar-edital"
      ) {
        return analisarEditalLegadoEndpoint(request, env);
      }

      if (
        request.method === "POST" &&
        url.pathname === "/api/ai/salvar-edital"
      ) {
        return salvarEditalEndpoint(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return json(
          {
            ok: false,
            erro: "Rota da API não encontrada.",
            path: url.pathname
          },
          404
        );
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response(
        "Aprova Concurso DEV",
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    } catch (error) {
      console.error(
        "Erro não tratado no Worker:",
        error
      );

      return json(
        {
          ok: false,
          erro: obterMensagemErro(error)
        },
        500
      );
    }
  }
};

async function testarWorkersAI(env) {
  try {
    validarBindingAI(env);

    const inicio = Date.now();

    const resultado = await env.AI.run(
      MODELO_TESTE,
      {
        messages: [
          {
            role: "system",
            content: "Responda somente com a palavra OK."
          },
          {
            role: "user",
            content: "Responda OK."
          }
        ],
        max_completion_tokens: 100,
        reasoning_effort: "low",
        temperature: 0
      }
    );

    return json({
      ok: true,
      modelo: MODELO_TESTE,
      duracao_ms: Date.now() - inicio,
      conteudo: extrairConteudoResposta(resultado),
      resultado_completo: resultado
    });
  } catch (error) {
    return json(
      {
        ok: false,
        modelo: MODELO_TESTE,
        erro: obterMensagemErro(error)
      },
      500
    );
  }
}

async function extrairMetadadosEndpoint(
  request,
  env
) {
  try {
    validarBindingAI(env);

    const body = await lerJsonRequest(request);

    const texto = limparTextoEdital(
      textoSeguro(
        body.texto ||
        body.texto_edital ||
        body.conteudo
      )
    ).slice(0, LIMITE_METADADOS);

    if (texto.length < 100) {
      return json(
        {
          ok: false,
          erro: "Texto insuficiente para extrair metadados."
        },
        400
      );
    }

    const prompt = `
Extraia somente os dados gerais deste edital de concurso público.

REGRAS:
- Não extraia cargos, disciplinas ou tópicos nesta etapa.
- Não invente informações.
- Use string vazia quando o dado não estiver presente.
- A data da prova deve usar o formato AAAA-MM-DD.

Arquivo: ${
  textoSeguro(
    body.nome_arquivo ||
    body.nomeArquivo
  ) || "não informado"
}

Tipo: ${
  textoSeguro(
    body.tipo_arquivo ||
    body.tipoArquivo
  ) || "não informado"
}

TEXTO:
${texto}
`;

    const resultado = await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_METADADOS,
      "metadados_concurso",
      1000
    );

    return json({
      ok: true,
      resultado
    });
  } catch (error) {
    console.error(
      "Erro na etapa de metadados:",
      error
    );

    return json(
      {
        ok: false,
        erro: normalizarErroWorkersAI(error)
      },
      500
    );
  }
}

async function analisarBlocoEndpoint(
  request,
  env
) {
  try {
    validarBindingAI(env);

    const body = await lerJsonRequest(request);

    const bloco = limparTextoEdital(
      textoSeguro(
        body.bloco ||
        body.texto
      )
    );

    const indice = Math.max(
      0,
      Number(body.indice) || 0
    );

    const total = Math.max(
      1,
      Number(body.total) || 1
    );

    if (bloco.length < 80) {
      return json({
        ok: true,
        resultado: {
          cargos: []
        },
        aviso: "Bloco sem texto suficiente."
      });
    }

    const prompt = `
Você está analisando o bloco ${indice + 1} de ${total} de um edital de concurso.

OBJETIVO:
- Identificar somente cargos, áreas ou especialidades realmente presentes neste bloco.
- Vincular cada disciplina ao cargo correto.
- Extrair os tópicos e subtópicos de cada disciplina.
- Não tratar cargo como disciplina.
- Não tratar "Conhecimentos Gerais" ou "Conhecimentos Específicos" como cargos.
- Não misturar conteúdos de cargos diferentes.
- Não inventar informações.
- Se o bloco não possuir conteúdo útil de cargos ou disciplinas, retorne cargos vazio.
- O status inicial de todos os tópicos deve ser "pendente".
- Use peso 1 quando não houver peso expresso.
- Use quantidade_questoes null quando não houver quantidade expressa.

BLOCO:
${bloco.slice(0, TAMANHO_BLOCO)}
`;

    const resultado = await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_BLOCO,
      `bloco_cargos_${indice + 1}`,
      2800
    );

    return json({
      ok: true,
      resultado
    });
  } catch (error) {
    console.error(
      "Erro na etapa de bloco:",
      error
    );

    return json(
      {
        ok: false,
        erro: normalizarErroWorkersAI(error)
      },
      500
    );
  }
}

async function finalizarAnaliseEndpoint(
  request
) {
  try {
    const body = await lerJsonRequest(request);

    const metadados = objetoSeguro(
      body.metadados
    );

    const resultados = Array.isArray(
      body.resultados_blocos
    )
      ? body.resultados_blocos
      : [];

    const cargosBrutos = resultados.flatMap(
      item => {
        const fonte = objetoSeguro(
          item?.resultado ||
          item
        );

        return Array.isArray(fonte.cargos)
          ? fonte.cargos
          : [];
      }
    );

    const cargos = consolidarCargos(
      cargosBrutos
    );

    if (!cargos.length) {
      return json(
        {
          ok: false,
          erro:
            "Nenhum cargo com disciplinas e tópicos válidos foi identificado nos blocos."
        },
        422
      );
    }

    const concurso = objetoSeguro(
      metadados.concurso
    );

    const resultado = {
      concurso: {
        nome:
          textoSeguro(concurso.nome) ||
          "Concurso importado por IA",

        orgao:
          textoSeguro(concurso.orgao),

        banca:
          textoSeguro(concurso.banca),

        numero_edital:
          textoSeguro(
            concurso.numero_edital ||
            concurso.numero
          ),

        data_prova:
          normalizarData(
            concurso.data_prova ||
            concurso.prova
          )
      },

      cargos,

      estrategia:
        textoSeguro(
          metadados.estrategia
        ) ||
        criarEstrategiaMulticargos(
          cargos
        )
    };

    return json({
      ok: true,
      resultado
    });
  } catch (error) {
    console.error(
      "Erro ao finalizar análise:",
      error
    );

    return json(
      {
        ok: false,
        erro: obterMensagemErro(error)
      },
      500
    );
  }
}

async function analisarEditalLegadoEndpoint(
  request,
  env
) {
  const inicio = Date.now();

  try {
    validarBindingAI(env);

    const body = await lerJsonRequest(request);

    const textoOriginal = textoSeguro(
      body.texto_edital ||
      body.textoEdital ||
      body.texto ||
      body.conteudo
    );

    if (textoOriginal.length < 100) {
      return json(
        {
          ok: false,
          erro:
            "Nenhum texto suficiente foi extraído do edital. PDFs escaneados precisam passar por OCR."
        },
        400
      );
    }

    const texto = limparTextoEdital(
      textoOriginal
    ).slice(
      0,
      LIMITE_TEXTO_LEGADO
    );

    const metadadosResposta =
      await chamarEndpointInternoMetadados(
        env,
        texto,
        body
      );

    const blocos = dividirTextoEmBlocos(
      texto,
      TAMANHO_BLOCO,
      SOBREPOSICAO_BLOCO,
      MAXIMO_BLOCOS_LEGADO
    );

    const resultados = [];

    for (
      let indice = 0;
      indice < blocos.length;
      indice += 1
    ) {
      try {
        resultados.push(
          await chamarAnaliseBlocoInterna(
            env,
            blocos[indice],
            indice,
            blocos.length
          )
        );
      } catch (error) {
        console.warn(
          `Bloco ${indice + 1} ignorado:`,
          obterMensagemErro(error)
        );

        resultados.push({
          cargos: []
        });
      }
    }

    const cargos = consolidarCargos(
      resultados.flatMap(
        item =>
          Array.isArray(item.cargos)
            ? item.cargos
            : []
      )
    );

    if (!cargos.length) {
      throw new Error(
        "A IA não conseguiu identificar cargos com disciplinas válidas."
      );
    }

    const concurso = objetoSeguro(
      metadadosResposta.concurso
    );

    const resultado = {
      concurso: {
        nome:
          textoSeguro(concurso.nome) ||
          "Concurso importado por IA",

        orgao:
          textoSeguro(concurso.orgao),

        banca:
          textoSeguro(concurso.banca),

        numero_edital:
          textoSeguro(
            concurso.numero_edital ||
            concurso.numero
          ),

        data_prova:
          normalizarData(
            concurso.data_prova ||
            concurso.prova
          )
      },

      cargos,

      estrategia:
        textoSeguro(
          metadadosResposta.estrategia
        ) ||
        criarEstrategiaMulticargos(
          cargos
        )
    };

    return json({
      ok: true,
      resultado,
      resposta: resultado,
      analise: resultado,
      processamento: {
        modo: "legado_em_blocos",
        blocos: blocos.length,
        duracao_ms:
          Date.now() - inicio
      }
    });
  } catch (error) {
    console.error(
      "Erro ao analisar edital:",
      error
    );

    return json(
      {
        ok: false,
        erro:
          normalizarErroWorkersAI(
            error
          ),
        duracao_ms:
          Date.now() - inicio
      },
      500
    );
  }
}

async function chamarEndpointInternoMetadados(
  env,
  texto,
  body
) {
  const prompt = `
Extraia somente os dados gerais deste edital.

Não invente informações.
Use string vazia quando o dado não estiver presente.
A data da prova deve usar AAAA-MM-DD.

Arquivo: ${
  textoSeguro(
    body.nome_arquivo ||
    body.nomeArquivo
  ) || "não informado"
}

Tipo: ${
  textoSeguro(
    body.tipo_arquivo ||
    body.tipoArquivo
  ) || "não informado"
}

TEXTO:
${texto.slice(0, LIMITE_METADADOS)}
`;

  return executarJsonSchema(
    env,
    prompt,
    ESQUEMA_METADADOS,
    "metadados_legado",
    1000
  );
}

async function chamarAnaliseBlocoInterna(
  env,
  bloco,
  indice,
  total
) {
  const prompt = `
Analise o bloco ${indice + 1} de ${total} deste edital.

Extraia cargos, especialidades, disciplinas e tópicos corretamente vinculados.

Não misture cargos diferentes.
Não invente informações.
Retorne cargos vazio quando não houver conteúdo útil.
Todos os tópicos devem iniciar com status "pendente".

BLOCO:
${bloco}
`;

  return executarJsonSchema(
    env,
    prompt,
    ESQUEMA_BLOCO,
    `bloco_legado_${indice + 1}`,
    2800
  );
}

async function executarJsonSchema(
  env,
  prompt,
  schema,
  nomeSchema,
  maxTokens
) {
  validarBindingAI(env);

  const modelos = [
    MODELO_EXTRACAO,
    MODELO_FALLBACK,
    MODELO_FALLBACK
  ];

  let ultimoErro = null;

  for (
    let tentativa = 0;
    tentativa < MAXIMO_TENTATIVAS_IA;
    tentativa += 1
  ) {
    const modelo = modelos[tentativa];

    try {
      const configuracao = {
        messages: [
          {
            role: "system",
            content:
              "Retorne somente JSON válido conforme o schema, sem markdown, comentários ou texto externo."
          },
          {
            role: "user",
            content: prompt
          }
        ],

        response_format: {
          type: "json_schema",

          json_schema: {
            name: nomeSchema,
            strict: true,
            schema
          }
        },

        temperature: 0
      };

      const resposta = modelo.includes("glm")
        ? await env.AI.run(
            modelo,
            {
              ...configuracao,
              max_completion_tokens:
                maxTokens,
              reasoning_effort: "low"
            }
          )
        : await env.AI.run(
            modelo,
            {
              ...configuracao,
              max_tokens:
                maxTokens
            }
          );

      return interpretarRespostaDaIa(
        resposta
      );
    } catch (error) {
      ultimoErro = error;

      console.warn(
        `Falha na IA, tentativa ${
          tentativa + 1
        }/${MAXIMO_TENTATIVAS_IA}, modelo ${modelo}:`,
        obterMensagemErro(error)
      );

      if (
        tentativa + 1 <
        MAXIMO_TENTATIVAS_IA
      ) {
        await esperar(
          ESPERA_REPETICAO_MS *
          (tentativa + 1)
        );
      }
    }
  }

  throw new Error(
    normalizarErroWorkersAI(
      ultimoErro
    )
  );
}

function interpretarRespostaDaIa(
  resposta
) {
  if (!resposta) {
    throw new Error(
      "A IA retornou uma resposta vazia."
    );
  }

  const candidatos = [
    resposta.parsed,
    resposta.result,
    resposta.response,
    resposta.output,
    resposta?.choices?.[0]
      ?.message?.parsed,
    resposta?.choices?.[0]
      ?.message?.content
  ];

  for (
    const candidato of candidatos
  ) {
    if (
      candidato &&
      typeof candidato === "object" &&
      !Array.isArray(candidato)
    ) {
      return candidato;
    }

    if (
      typeof candidato === "string" &&
      candidato.trim()
    ) {
      const objeto = extrairJson(
        candidato
      );

      if (objeto) {
        return objeto;
      }
    }
  }

  throw new Error(
    "A IA respondeu, mas não foi possível interpretar o JSON."
  );
}

function extrairJson(texto) {
  const bruto = textoSeguro(texto);

  if (!bruto) {
    return null;
  }

  const tentativas = [
    bruto,

    bruto
      .replace(
        /^```json\s*/i,
        ""
      )
      .replace(
        /^```\s*/i,
        ""
      )
      .replace(
        /```$/i,
        ""
      )
      .trim()
  ];

  for (
    const tentativa of tentativas
  ) {
    try {
      return JSON.parse(
        tentativa
      );
    } catch (_) {}
  }

  const inicio = bruto.indexOf(
    "{"
  );

  const fim = bruto.lastIndexOf(
    "}"
  );

  if (
    inicio >= 0 &&
    fim > inicio
  ) {
    try {
      return JSON.parse(
        bruto.slice(
          inicio,
          fim + 1
        )
      );
    } catch (_) {}
  }

  return null;
}

function extrairConteudoResposta(
  resposta
) {
  return (
    resposta?.choices?.[0]
      ?.message?.content ||
    resposta?.response ||
    resposta?.result ||
    resposta?.output ||
    null
  );
}

function consolidarCargos(
  cargosBrutos
) {
  const mapa = new Map();

  for (
    const cargoBruto of cargosBrutos || []
  ) {
    if (
      !cargoBruto ||
      typeof cargoBruto !== "object"
    ) {
      continue;
    }

    const nome = textoSeguro(
      cargoBruto.nome ||
      cargoBruto.cargo
    );

    const especialidade =
      textoSeguro(
        cargoBruto.especialidade ||
        cargoBruto.area
      );

    if (
      !nome &&
      !especialidade
    ) {
      continue;
    }

    const chave = normalizarChave(
      `${nome}|${especialidade}`
    );

    if (!chave) {
      continue;
    }

    const disciplinas =
      consolidarDisciplinas(
        cargoBruto.disciplinas
      );

    if (!disciplinas.length) {
      continue;
    }

    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        {
          codigo:
            textoSeguro(
              cargoBruto.codigo
            ),

          nome:
            nome ||
            especialidade,

          especialidade:
            especialidade &&
            normalizarChave(
              especialidade
            ) !==
              normalizarChave(
                nome
              )
              ? especialidade
              : "",

          nivel:
            textoSeguro(
              cargoBruto.nivel
            ),

          requisitos:
            textoSeguro(
              cargoBruto.requisitos
            ),

          vagas:
            normalizarInteiroOuNull(
              cargoBruto.vagas
            ),

          disciplinas
        }
      );

      continue;
    }

    const existente =
      mapa.get(chave);

    existente.codigo ||=
      textoSeguro(
        cargoBruto.codigo
      );

    existente.nivel ||=
      textoSeguro(
        cargoBruto.nivel
      );

    existente.requisitos ||=
      textoSeguro(
        cargoBruto.requisitos
      );

    existente.vagas ??=
      normalizarInteiroOuNull(
        cargoBruto.vagas
      );

    existente.disciplinas =
      consolidarDisciplinas([
        ...existente.disciplinas,
        ...disciplinas
      ]);
  }

  return Array
    .from(
      mapa.values()
    )
    .sort(
      (a, b) =>
        `${a.nome} ${a.especialidade}`
          .localeCompare(
            `${b.nome} ${b.especialidade}`,
            "pt-BR"
          )
    );
}

function consolidarDisciplinas(
  disciplinasBrutas
) {
  const mapa = new Map();

  for (
    const disciplinaBruta of
    disciplinasBrutas || []
  ) {
    if (!disciplinaBruta) {
      continue;
    }

    const nome = textoSeguro(
      typeof disciplinaBruta ===
        "string"
        ? disciplinaBruta
        : disciplinaBruta.nome
    );

    if (!nome) {
      continue;
    }

    const topicos =
      normalizarTopicos(
        typeof disciplinaBruta ===
          "object"
          ? disciplinaBruta.topicos
          : []
      );

    if (!topicos.length) {
      continue;
    }

    const chave =
      normalizarChave(nome);

    const atual = {
      nome,

      grupo:
        textoSeguro(
          disciplinaBruta.grupo
        ) ||
        "Conteúdo programático",

      prioridade:
        normalizarPrioridade(
          disciplinaBruta.prioridade
        ),

      peso:
        normalizarPeso(
          disciplinaBruta.peso
        ),

      quantidade_questoes:
        normalizarInteiroOuNull(
          disciplinaBruta
            .quantidade_questoes ??
          disciplinaBruta
            .numero_questoes
        ),

      topicos
    };

    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        atual
      );

      continue;
    }

    const existente =
      mapa.get(chave);

    if (
      existente.grupo ===
      "Conteúdo programático"
    ) {
      existente.grupo =
        atual.grupo;
    }

    existente.prioridade =
      maiorPrioridade(
        existente.prioridade,
        atual.prioridade
      );

    existente.peso =
      Math.max(
        existente.peso,
        atual.peso
      );

    existente.quantidade_questoes ??=
      atual.quantidade_questoes;

    existente.topicos =
      normalizarTopicos([
        ...existente.topicos,
        ...atual.topicos
      ]);
  }

  return Array.from(
    mapa.values()
  );
}

function normalizarTopicos(
  topicosBrutos
) {
  const mapa = new Map();

  for (
    const topicoBruto of
    topicosBrutos || []
  ) {
    const nome = textoSeguro(
      typeof topicoBruto ===
        "string"
        ? topicoBruto
        : topicoBruto?.nome
    );

    if (!nome) {
      continue;
    }

    const chave =
      normalizarChave(nome);

    if (
      !chave ||
      mapa.has(chave)
    ) {
      continue;
    }

    mapa.set(
      chave,
      {
        nome,

        status:
          topicoBruto?.status ===
          "concluido"
            ? "concluido"
            : "pendente"
      }
    );
  }

  return Array.from(
    mapa.values()
  );
}

async function salvarEditalEndpoint(
  request,
  env
) {
  try {
    validarSupabase(env);

    const body =
      await lerJsonRequest(
        request
      );

    const userId = textoSeguro(
      body.user_id ||
      body.userId
    );

    const concursoId =
      textoSeguro(
        body.concurso_id ||
        body.concursoId
      );

    if (!userId) {
      return json(
        {
          ok: false,
          erro:
            "O campo user_id é obrigatório."
        },
        400
      );
    }

    if (!concursoId) {
      return json(
        {
          ok: false,
          erro:
            "O campo concurso_id é obrigatório."
        },
        400
      );
    }

    const fonte =
      body.resultado ||
      body.analise ||
      body.resposta ||
      body;

    const dados =
      normalizarParaSalvamento(
        fonte
      );

    const resultado =
      await supabaseRpc(
        env,
        "salvar_edital_verticalizado",
        {
          p_user_id:
            userId,

          p_concurso_id:
            concursoId,

          p_dados:
            dados
        }
      );

    const retorno =
      objetoSeguro(
        resultado
      );

    return json({
      ok:
        retorno.ok !== false,

      mensagem:
        retorno.mensagem ||
        "Edital verticalizado salvo com sucesso.",

      concurso_id:
        retorno.concurso_id ||
        concursoId,

      disciplinas_salvas:
        retorno
          .disciplinas_salvas ??
        dados.disciplinas.length,

      topicos_salvos:
        retorno
          .topicos_salvos ??
        contarTopicos(
          dados.disciplinas
        ),

      resultado
    });
  } catch (error) {
    console.error(
      "Erro ao salvar edital:",
      error
    );

    return json(
      {
        ok: false,
        erro: obterMensagemErro(error)
      },
      500
    );
  }
}

function normalizarParaSalvamento(
  fonte
) {
  if (
    !fonte ||
    typeof fonte !== "object"
  ) {
    throw new Error(
      "Os dados enviados para salvamento são inválidos."
    );
  }

  if (
    fonte.concurso &&
    Array.isArray(
      fonte.disciplinas
    )
  ) {
    const disciplinas =
      consolidarDisciplinas(
        fonte.disciplinas
      );

    if (!disciplinas.length) {
      throw new Error(
        "O cargo selecionado não possui disciplinas válidas."
      );
    }

    return {
      concurso: {
        nome:
          textoSeguro(
            fonte.concurso.nome
          ) ||
          "Concurso importado por IA",

        orgao:
          textoSeguro(
            fonte.concurso.orgao
          ),

        cargo:
          textoSeguro(
            fonte.concurso.cargo
          ),

        banca:
          textoSeguro(
            fonte.concurso.banca
          ),

        data_prova:
          normalizarData(
            fonte.concurso
              .data_prova ||
            fonte.concurso
              .prova
          )
      },

      disciplinas,

      estrategia:
        textoSeguro(
          fonte.estrategia
        ) ||
        criarEstrategiaDisciplinas(
          disciplinas
        )
    };
  }

  if (
    Array.isArray(
      fonte.cargos
    )
  ) {
    const cargos =
      consolidarCargos(
        fonte.cargos
      );

    if (cargos.length !== 1) {
      throw new Error(
        "Selecione exatamente um cargo antes de salvar o edital."
      );
    }

    const concurso =
      objetoSeguro(
        fonte.concurso
      );

    const cargo =
      cargos[0];

    return {
      concurso: {
        nome:
          textoSeguro(
            concurso.nome
          ) ||
          "Concurso importado por IA",

        orgao:
          textoSeguro(
            concurso.orgao
          ),

        cargo:
          montarNomeCargo(
            cargo
          ),

        banca:
          textoSeguro(
            concurso.banca
          ),

        data_prova:
          normalizarData(
            concurso.data_prova ||
            concurso.prova
          )
      },

      disciplinas:
        cargo.disciplinas,

      estrategia:
        textoSeguro(
          fonte.estrategia
        ) ||
        criarEstrategiaDisciplinas(
          cargo.disciplinas
        )
    };
  }

  throw new Error(
    "O formato recebido não contém um cargo selecionado."
  );
}

async function supabaseRpc(
  env,
  nomeFuncao,
  parametros
) {
  const endpoint =
    `${obterSupabaseUrl(env)}/rest/v1/rpc/${nomeFuncao}`;

  let response;

  try {
    response = await fetch(
      endpoint,
      {
        method: "POST",

        headers: {
          ...supabaseHeaders(env),

          Prefer:
            "return=representation"
        },

        body:
          JSON.stringify(
            parametros
          )
      }
    );
  } catch (error) {
    throw new Error(
      `Falha de rede ao acessar o Supabase: ${
        obterMensagemErro(error)
      }`
    );
  }

  const data =
    await lerRespostaHttp(
      response
    );

  if (!response.ok) {
    throw new Error(
      `Supabase respondeu HTTP ${response.status}: ${
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      }`
    );
  }

  return data;
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
    return JSON.parse(
      texto
    );
  } catch (_) {
    return texto;
  }
}

function dividirTextoEmBlocos(
  texto,
  tamanho,
  sobreposicao,
  maximo
) {
  const blocos = [];
  let inicio = 0;

  while (
    inicio < texto.length &&
    blocos.length < maximo
  ) {
    let fim = Math.min(
      inicio + tamanho,
      texto.length
    );

    if (fim < texto.length) {
      const candidatos = [
        texto.lastIndexOf(
          "\n\n",
          fim
        ),

        texto.lastIndexOf(
          "\n",
          fim
        ),

        texto.lastIndexOf(
          ". ",
          fim
        )
      ].filter(
        posicao =>
          posicao >
          inicio +
          tamanho * 0.65
      );

      if (candidatos.length) {
        fim =
          Math.max(
            ...candidatos
          ) + 1;
      }
    }

    const bloco =
      texto
        .slice(
          inicio,
          fim
        )
        .trim();

    if (bloco) {
      blocos.push(
        bloco
      );
    }

    if (fim >= texto.length) {
      break;
    }

    inicio =
      Math.max(
        fim -
        sobreposicao,

        inicio + 1
      );
  }

  return blocos;
}

function criarEstrategiaMulticargos(
  cargos
) {
  return (
    `Foram identificados ${cargos.length} cargo(s). ` +
    "Selecione o cargo desejado antes de gerar a grade. " +
    "Priorize disciplinas específicas e de maior peso, intercalando teoria, questões e revisões."
  );
}

function criarEstrategiaDisciplinas() {
  return (
    "Estude por ciclos, priorizando as disciplinas de maior peso, " +
    "resolva questões após cada bloco teórico e programe revisões periódicas."
  );
}

function contarTopicos(
  disciplinas
) {
  return (
    disciplinas || []
  ).reduce(
    (
      total,
      disciplina
    ) =>
      total +
      (
        Array.isArray(
          disciplina.topicos
        )
          ? disciplina
              .topicos
              .length
          : 0
      ),
    0
  );
}

function montarNomeCargo(
  cargo
) {
  return [
    textoSeguro(
      cargo?.nome
    ),

    textoSeguro(
      cargo?.especialidade
    )
  ]
    .filter(Boolean)
    .join(" — ");
}

function maiorPrioridade(
  a,
  b
) {
  const ordem = {
    alta: 3,
    media: 2,
    baixa: 1
  };

  return ordem[b] >
    ordem[a]
      ? b
      : a;
}

function normalizarPrioridade(
  valor
) {
  const chave =
    normalizarChave(
      valor
    );

  if (
    chave.includes(
      "alta"
    )
  ) {
    return "alta";
  }

  if (
    chave.includes(
      "baixa"
    )
  ) {
    return "baixa";
  }

  return "media";
}

function normalizarPeso(
  valor
) {
  const numero =
    Number(valor);

  return (
    Number.isFinite(numero) &&
    numero >= 1
  )
    ? Math.max(
        1,
        Math.round(numero)
      )
    : 1;
}

function normalizarInteiroOuNull(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero =
    Number(valor);

  return Number.isFinite(
    numero
  )
    ? Math.max(
        0,
        Math.round(numero)
      )
    : null;
}

function normalizarData(
  valor
) {
  const texto =
    textoSeguro(
      valor
    );

  if (!texto) {
    return "";
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      texto
    )
  ) {
    return texto;
  }

  const brasileira =
    texto.match(
      /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/
    );

  if (!brasileira) {
    return "";
  }

  const dia =
    brasileira[1]
      .padStart(
        2,
        "0"
      );

  const mes =
    brasileira[2]
      .padStart(
        2,
        "0"
      );

  return (
    `${brasileira[3]}-${mes}-${dia}`
  );
}

function normalizarChave(
  valor
) {
  return textoSeguro(
    valor
  )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function limparTextoEdital(
  texto
) {
  return String(
    texto || ""
  )
    .replace(
      /\u0000/g,
      ""
    )
    .replace(
      /\r/g,
      "\n"
    )
    .replace(
      /[ \t]+/g,
      " "
    )
    .replace(
      /\n[ \t]+/g,
      "\n"
    )
    .replace(
      /\n{4,}/g,
      "\n\n\n"
    )
    .trim();
}

async function lerJsonRequest(
  request
) {
  const contentType =
    textoSeguro(
      request.headers.get(
        "content-type"
      )
    )
      .toLowerCase();

  if (
    !contentType.includes(
      "application/json"
    )
  ) {
    throw new Error(
      "Esta rota aceita somente application/json."
    );
  }

  try {
    return await request.json();
  } catch (_) {
    throw new Error(
      "O corpo da requisição não contém JSON válido."
    );
  }
}

function validarBindingAI(
  env
) {
  if (!env?.AI) {
    throw new Error(
      "O binding AI não está configurado no Worker."
    );
  }
}

function validarSupabase(
  env
) {
  if (!env?.SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL não está configurada."
    );
  }

  if (
    !env
      ?.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está configurada."
    );
  }
}

function obterSupabaseUrl(
  env
) {
  return textoSeguro(
    env.SUPABASE_URL
  )
    .replace(
      /\/+$/,
      ""
    );
}

function supabaseHeaders(
  env
) {
  return {
    apikey:
      env
        .SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${
        env
          .SUPABASE_SERVICE_ROLE_KEY
      }`,

    "Content-Type":
      "application/json"
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, X-Requested-With",

    "Access-Control-Max-Age":
      "86400"
  };
}

function json(
  dados,
  status = 200
) {
  return new Response(
    JSON.stringify(
      dados,
      null,
      2
    ),
    {
      status,

      headers: {
        ...corsHeaders(),

        "Content-Type":
          "application/json; charset=utf-8",

        "Cache-Control":
          "no-store"
      }
    }
  );
}

function textoSeguro(
  valor
) {
  return (
    valor === null ||
    valor === undefined
  )
    ? ""
    : String(valor)
        .trim();
}

function objetoSeguro(
  valor
) {
  return (
    valor &&
    typeof valor === "object" &&
    !Array.isArray(valor)
  )
    ? valor
    : {};
}

function obterMensagemErro(
  error
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    typeof error === "string"
  ) {
    return error;
  }

  try {
    return JSON.stringify(
      error
    );
  } catch (_) {
    return (
      "Erro interno desconhecido."
    );
  }
}

function normalizarErroWorkersAI(
  error
) {
  const mensagem =
    obterMensagemErro(
      error
    );

  const lower =
    mensagem
      .toLowerCase();

  if (
    lower.includes(
      "content-length header"
    ) ||
    lower.includes(
      "exceeds body"
    )
  ) {
    return (
      "A resposta da IA foi interrompida pela infraestrutura da Cloudflare. " +
      "O sistema tentou novamente, mas não recebeu uma resposta completa."
    );
  }

  if (
    lower.includes(
      "timeout"
    ) ||
    lower.includes(
      "timed out"
    )
  ) {
    return (
      "A análise ultrapassou o tempo disponível da Cloudflare."
    );
  }

  if (
    lower.includes(
      "rate limit"
    ) ||
    lower.includes(
      "too many requests"
    ) ||
    lower.includes(
      "429"
    )
  ) {
    return (
      "O limite momentâneo da IA da Cloudflare foi atingido. Aguarde e tente novamente."
    );
  }

  if (
    lower.includes(
      "json"
    ) ||
    lower.includes(
      "parse"
    )
  ) {
    return (
      "A IA respondeu com JSON incompleto ou inválido após as tentativas automáticas."
    );
  }

  return (
    mensagem ||
    "A Workers AI não conseguiu concluir a análise."
  );
}

function esperar(
  milissegundos
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        milissegundos
      )
  );
}
