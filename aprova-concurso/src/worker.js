const MODELO_TESTE = "@cf/zai-org/glm-4.7-flash";
const MODELO_EXTRACAO = "@cf/meta/llama-3.1-8b-instruct-fast";

const LIMITE_CURTO = 22000;
const TAMANHO_BLOCO = 14000;
const SOBREPOSICAO_BLOCO = 1200;
const MAXIMO_BLOCOS = 6;
const CONCORRENCIA_IA = 3;
const LIMITE_TEXTO_TOTAL = 80000;

const ESQUEMA_EDITAL_COMPLETO = {
  type: "object",
  properties: {
    concurso: {
      type: "object",
      properties: {
        nome: { type: "string" },
        orgao: { type: "string" },
        cargo: { type: "string" },
        banca: { type: "string" },
        data_prova: { type: "string" },
      },
      required: [
        "nome",
        "orgao",
        "cargo",
        "banca",
        "data_prova",
      ],
    },

    disciplinas: {
      type: "array",
      minItems: 1,

      items: {
        type: "object",

        properties: {
          nome: {
            type: "string",
          },

          prioridade: {
            type: "string",
            enum: [
              "alta",
              "media",
              "baixa",
            ],
          },

          peso: {
            type: "integer",
            minimum: 1,
          },

          topicos: {
            type: "array",
            minItems: 1,

            items: {
              type: "object",

              properties: {
                nome: {
                  type: "string",
                },
              },

              required: [
                "nome",
              ],
            },
          },
        },

        required: [
          "nome",
          "prioridade",
          "peso",
          "topicos",
        ],
      },
    },

    estrategia: {
      type: "string",
    },
  },

  required: [
    "concurso",
    "disciplinas",
    "estrategia",
  ],
};

const ESQUEMA_METADADOS = {
  type: "object",

  properties: {
    concurso: {
      type: "object",

      properties: {
        nome: {
          type: "string",
        },

        orgao: {
          type: "string",
        },

        cargo: {
          type: "string",
        },

        banca: {
          type: "string",
        },

        data_prova: {
          type: "string",
        },
      },

      required: [
        "nome",
        "orgao",
        "cargo",
        "banca",
        "data_prova",
      ],
    },

    estrategia: {
      type: "string",
    },
  },

  required: [
    "concurso",
    "estrategia",
  ],
};

const ESQUEMA_BLOCO = {
  type: "object",

  properties: {
    disciplinas: {
      type: "array",

      items: {
        type: "object",

        properties: {
          nome: {
            type: "string",
          },

          prioridade: {
            type: "string",
            enum: [
              "alta",
              "media",
              "baixa",
            ],
          },

          peso: {
            type: "integer",
            minimum: 1,
          },

          topicos: {
            type: "array",

            items: {
              type: "object",

              properties: {
                nome: {
                  type: "string",
                },
              },

              required: [
                "nome",
              ],
            },
          },
        },

        required: [
          "nome",
          "prioridade",
          "peso",
          "topicos",
        ],
      },
    },
  },

  required: [
    "disciplinas",
  ],
};

export default {
  async fetch(request, env) {
    const url = new URL(
      request.url
    );

    try {
      if (
        request.method ===
        "OPTIONS"
      ) {
        return new Response(
          null,
          {
            status: 204,
            headers:
              corsHeaders(),
          }
        );
      }

      if (
        url.pathname ===
          "/api/health" &&
        request.method ===
          "GET"
      ) {
        return json({
          ok: true,

          service:
            "Aprova Concurso DEV",

          modelo_teste:
            MODELO_TESTE,

          modelo_extracao:
            MODELO_EXTRACAO,

          ai:
            Boolean(
              env.AI
            ),

          assets:
            Boolean(
              env.ASSETS
            ),

          supabase:
            Boolean(
              env.SUPABASE_URL &&
              env.SUPABASE_SERVICE_ROLE_KEY
            ),

          processamento_extenso: {
            limite_curto:
              LIMITE_CURTO,

            tamanho_bloco:
              TAMANHO_BLOCO,

            maximo_blocos:
              MAXIMO_BLOCOS,

            concorrencia:
              CONCORRENCIA_IA,
          },

          debug: {
            tem_AI:
              Boolean(
                env.AI
              ),

            tem_ASSETS:
              Boolean(
                env.ASSETS
              ),

            tem_SUPABASE_URL:
              Boolean(
                env.SUPABASE_URL
              ),

            tem_SUPABASE_SERVICE_ROLE_KEY:
              Boolean(
                env.SUPABASE_SERVICE_ROLE_KEY
              ),
          },
        });
      }

      if (
        url.pathname ===
          "/api/ai/teste" &&
        request.method ===
          "GET"
      ) {
        return testarWorkersAI(
          env
        );
      }

      if (
        url.pathname ===
          "/api/ai/analisar-edital" &&
        request.method ===
          "POST"
      ) {
        return analisarEdital(
          request,
          env
        );
      }

      if (
        url.pathname ===
          "/api/ai/salvar-edital" &&
        request.method ===
          "POST"
      ) {
        return salvarEdital(
          request,
          env
        );
      }

      if (
        url.pathname.startsWith(
          "/api/"
        )
      ) {
        return json(
          {
            ok: false,

            erro:
              "Rota da API não encontrada.",

            path:
              url.pathname,
          },
          404
        );
      }

      if (env.ASSETS) {
        return env.ASSETS.fetch(
          request
        );
      }

      return new Response(
        "Aprova Concurso DEV",
        {
          status: 200,

          headers: {
            "Content-Type":
              "text/plain; charset=utf-8",
          },
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

          erro:
            obterMensagemErro(
              error
            ),
        },
        500
      );
    }
  },
};

async function testarWorkersAI(
  env
) {
  try {
    validarBindingAI(
      env
    );

    const inicio =
      Date.now();

    const resultado =
      await env.AI.run(
        MODELO_TESTE,
        {
          messages: [
            {
              role:
                "system",

              content:
                "Responda somente com a palavra OK. Não explique.",
            },

            {
              role:
                "user",

              content:
                "Responda OK.",
            },
          ],

          max_completion_tokens:
            500,

          reasoning_effort:
            "low",

          temperature:
            0,
        }
      );

    const escolha =
      resultado
        ?.choices?.[0] ||
      null;

    const conteudo =
      escolha
        ?.message
        ?.content ||
      resultado
        ?.response ||
      resultado
        ?.result ||
      null;

    return json({
      ok: true,

      modelo:
        MODELO_TESTE,

      duracao_ms:
        Date.now() -
        inicio,

      teste: {
        conteudo,

        finish_reason:
          escolha
            ?.finish_reason ||
          null,

        completion_tokens:
          resultado
            ?.usage
            ?.completion_tokens ||
          null,
      },

      resultado_completo:
        resultado,
    });
  } catch (error) {
    console.error(
      "Falha no teste do Workers AI:",
      error
    );

    return json(
      {
        ok: false,

        etapa:
          "inferencia",

        modelo:
          MODELO_TESTE,

        erro:
          obterMensagemErro(
            error
          ),

        tipo:
          error?.name ||
          null,
      },
      500
    );
  }
}

async function analisarEdital(
  request,
  env
) {
  const inicioTotal =
    Date.now();

  try {
    validarBindingAI(
      env
    );

    const dados =
      await lerDadosDaRequisicao(
        request
      );

    const textoOriginal =
      textoSeguro(
        dados.texto_edital ||
        dados.textoEdital ||
        dados.texto ||
        dados.conteudo
      );

    const nomeArquivo =
      textoSeguro(
        dados.nome_arquivo ||
        dados.nomeArquivo ||
        dados.filename
      );

    const tipoArquivo =
      textoSeguro(
        dados.tipo_arquivo ||
        dados.tipoArquivo ||
        dados.type
      );

    if (!textoOriginal) {
      return json(
        {
          ok: false,

          erro:
            "Nenhum texto foi extraído do edital. Se o PDF for escaneado, aplique OCR antes da análise.",
        },
        400
      );
    }

    if (
      textoOriginal.length <
      100
    ) {
      return json(
        {
          ok: false,

          erro:
            "O texto extraído possui menos de 100 caracteres e não é suficiente para verticalizar o edital.",
        },
        400
      );
    }

    const trechoProgramatico =
      extrairTrechoConteudoProgramatico(
        textoOriginal
      );

    const textoUtil =
      trechoProgramatico
        .slice(
          0,
          LIMITE_TEXTO_TOTAL
        )
        .trim();

    if (
      textoUtil.length <
      100
    ) {
      return json(
        {
          ok: false,

          erro:
            "Não foi possível localizar conteúdo programático suficiente no arquivo.",
        },
        400
      );
    }

    const hashTexto =
      await gerarHashTexto(
        textoUtil
      );

    let resultado;
    let modo;
    let blocosUsados =
      1;

    if (
      textoUtil.length <=
      LIMITE_CURTO
    ) {
      modo =
        "unico";

      resultado =
        await analisarEditalCurto(
          env,
          {
            textoEdital:
              textoUtil,

            nomeArquivo,

            tipoArquivo,
          }
        );
    } else {
      modo =
        "blocos_paralelos";

      const blocos =
        dividirTextoEmBlocos(
          textoUtil,
          TAMANHO_BLOCO,
          SOBREPOSICAO_BLOCO,
          MAXIMO_BLOCOS
        );

      blocosUsados =
        blocos.length;

      resultado =
        await analisarEditalExtenso(
          env,
          {
            textoCompleto:
              textoUtil,

            blocos,

            nomeArquivo,

            tipoArquivo,
          }
        );
    }

    const normalizado =
      normalizarResultado(
        resultado
      );

    return json({
      ok: true,

      resultado:
        normalizado,

      resposta:
        normalizado,

      analise:
        normalizado,

      arquivo: {
        nome:
          nomeArquivo ||
          null,

        tipo:
          tipoArquivo ||
          null,

        caracteres_recebidos:
          textoOriginal.length,

        caracteres_filtrados:
          trechoProgramatico.length,

        caracteres_analisados:
          textoUtil.length,

        texto_cortado:
          trechoProgramatico.length >
          LIMITE_TEXTO_TOTAL,

        hash:
          hashTexto,
      },

      processamento: {
        modo,

        blocos:
          blocosUsados,

        concorrencia:
          modo ===
          "blocos_paralelos"
            ? CONCORRENCIA_IA
            : 1,

        duracao_ms:
          Date.now() -
          inicioTotal,
      },

      modelo:
        MODELO_EXTRACAO,
    });
  } catch (error) {
    console.error(
      "Erro ao analisar edital:",
      {
        erro:
          obterMensagemErro(
            error
          ),

        stack:
          error?.stack ||
          null,
      }
    );

    return json(
      {
        ok: false,

        erro:
          obterMensagemErro(
            error
          ),

        modelo:
          MODELO_EXTRACAO,

        duracao_ms:
          Date.now() -
          inicioTotal,
      },
      500
    );
  }
}

async function analisarEditalCurto(
  env,
  {
    textoEdital,
    nomeArquivo,
    tipoArquivo,
  }
) {
  const prompt =
    montarPromptCompleto({
      textoEdital,
      nomeArquivo,
      tipoArquivo,
    });

  const resposta =
    await executarJsonMode(
      env,
      prompt,
      ESQUEMA_EDITAL_COMPLETO,
      5000
    );

  return interpretarRespostaDaIa(
    resposta
  );
}

async function analisarEditalExtenso(
  env,
  {
    textoCompleto,
    blocos,
    nomeArquivo,
    tipoArquivo,
  }
) {
  const textoMetadados =
    textoCompleto.slice(
      0,
      14000
    );

  const promessaMetadados =
    extrairMetadados(
      env,
      {
        textoEdital:
          textoMetadados,

        nomeArquivo,

        tipoArquivo,
      }
    );

  const promessaBlocos =
    executarEmLotes(
      blocos.map(
        (
          bloco,
          indice
        ) =>
          async () =>
            analisarBlocoProgramatico(
              env,
              {
                bloco,
                indice,
                total:
                  blocos.length,
              }
            )
      ),

      CONCORRENCIA_IA
    );

  const [
    metadados,
    resultadosBlocos,
  ] =
    await Promise.all([
      promessaMetadados,
      promessaBlocos,
    ]);

  const disciplinas =
    consolidarDisciplinas(
      resultadosBlocos.flatMap(
        (item) =>
          item.disciplinas ||
          []
      )
    );

  if (
    !disciplinas.length
  ) {
    throw new Error(
      "A IA não identificou disciplinas válidas nos blocos do edital."
    );
  }

  return {
    concurso:
      metadados.concurso ||
      {},

    disciplinas,

    estrategia:
      textoSeguro(
        metadados.estrategia
      ) ||
      criarEstrategiaLocal(
        disciplinas
      ),
  };
}

async function extrairMetadados(
  env,
  {
    textoEdital,
    nomeArquivo,
    tipoArquivo,
  }
) {
  const prompt = `
Extraia somente os metadados gerais do edital abaixo.
Retorne JSON válido conforme o schema solicitado.
Não invente dados.
Use string vazia para informação ausente.
A data da prova deve usar AAAA-MM-DD.

Arquivo: ${
  nomeArquivo ||
  "não informado"
}

Tipo: ${
  tipoArquivo ||
  "não informado"
}

EDITAL:

${textoEdital}
`;

  const resposta =
    await executarJsonMode(
      env,
      prompt,
      ESQUEMA_METADADOS,
      1200
    );

  const objeto =
    interpretarObjetoJson(
      resposta
    );

  return {
    concurso:
      objeto?.concurso &&
      typeof objeto.concurso ===
        "object"
        ? objeto.concurso
        : {},

    estrategia:
      textoSeguro(
        objeto?.estrategia
      ),
  };
}

async function analisarBlocoProgramatico(
  env,
  {
    bloco,
    indice,
    total,
  }
) {
  const prompt = `
Você está analisando o bloco ${
  indice + 1
} de ${total} do conteúdo programático de um edital.

Extraia somente disciplinas e seus tópicos que apareçam neste bloco.
Não invente informações.
Não repita um tópico apenas porque ele aparece no início e no fim do bloco.
Quando uma disciplina começar em um bloco e continuar em outro, preserve exatamente o mesmo nome da disciplina.
A prioridade deve ser alta, media ou baixa.
O peso deve ser inteiro e no mínimo 1.
Cada tópico deve conter somente o campo nome.
Retorne JSON válido conforme o schema solicitado.

BLOCO:

${bloco}
`;

  const resposta =
    await executarJsonMode(
      env,
      prompt,
      ESQUEMA_BLOCO,
      3200
    );

  const objeto =
    interpretarObjetoJson(
      resposta
    );

  return {
    disciplinas:
      Array.isArray(
        objeto?.disciplinas
      )
        ? objeto.disciplinas
        : [],
  };
}

async function executarJsonMode(
  env,
  prompt,
  schema,
  maxTokens
) {
  try {
    return await env.AI.run(
      MODELO_EXTRACAO,
      {
        messages: [
          {
            role:
              "system",

            content:
              "Extraia dados de editais de concursos públicos. Responda somente com JSON válido.",
          },

          {
            role:
              "user",

            content:
              prompt,
          },
        ],

        response_format: {
          type:
            "json_schema",

          json_schema:
            schema,
        },

        max_tokens:
          maxTokens,

        temperature:
          0,
      }
    );
  } catch (error) {
    const mensagem =
      obterMensagemErro(
        error
      );

    const erroDeFormato =
      /json|schema|structured|format/i.test(
        mensagem
      );

    if (!erroDeFormato) {
      throw error;
    }

    console.warn(
      "JSON Mode não pôde ser atendido. Tentando JSON simples:",
      mensagem
    );

    return env.AI.run(
      MODELO_EXTRACAO,
      {
        messages: [
          {
            role:
              "system",

            content:
              "Responda exclusivamente com um objeto JSON válido, sem markdown, comentários ou explicações.",
          },

          {
            role:
              "user",

            content:
              prompt,
          },
        ],

        max_tokens:
          maxTokens,

        temperature:
          0,
      }
    );
  }
}

async function executarEmLotes(
  tarefas,
  limite
) {
  const resultados =
    [];

  for (
    let inicio = 0;
    inicio <
    tarefas.length;
    inicio += limite
  ) {
    const lote =
      tarefas.slice(
        inicio,
        inicio + limite
      );

    const respostas =
      await Promise.all(
        lote.map(
          (tarefa) =>
            tarefa()
        )
      );

    resultados.push(
      ...respostas
    );
  }

  return resultados;
}

function dividirTextoEmBlocos(
  texto,
  tamanho,
  sobreposicao,
  maximoBlocos
) {
  const blocos =
    [];

  let inicio =
    0;

  while (
    inicio <
      texto.length &&
    blocos.length <
      maximoBlocos
  ) {
    let fim =
      Math.min(
        inicio +
          tamanho,

        texto.length
      );

    if (
      fim <
      texto.length
    ) {
      const janelaInicio =
        Math.max(
          inicio +
            Math.floor(
              tamanho *
              0.65
            ),

          inicio
        );

      const trechoBusca =
        texto.slice(
          janelaInicio,
          fim
        );

      const ultimoParagrafo =
        trechoBusca.lastIndexOf(
          "\n\n"
        );

      const ultimaLinha =
        trechoBusca.lastIndexOf(
          "\n"
        );

      const corteLocal =
        Math.max(
          ultimoParagrafo,
          ultimaLinha
        );

      if (
        corteLocal >
        0
      ) {
        fim =
          janelaInicio +
          corteLocal;
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

    if (
      fim >=
      texto.length
    ) {
      break;
    }

    inicio =
      Math.max(
        fim -
          sobreposicao,

        inicio +
          1
      );
  }

  if (
    inicio <
      texto.length &&
    blocos.length ===
      maximoBlocos
  ) {
    const restante =
      texto
        .slice(
          inicio
        )
        .trim();

    if (restante) {
      blocos[
        blocos.length -
        1
      ] =
        `${
          blocos[
            blocos.length -
            1
          ]
        }\n\n${restante}`;
    }
  }

  return blocos;
}

function extrairTrechoConteudoProgramatico(
  texto
) {
  const original =
    textoSeguro(
      texto
    );

  if (!original) {
    return "";
  }

  const normalizado =
    removerAcentos(
      original
    ).toLowerCase();

  const marcadoresInicio =
    [
      "conteudo programatico",
      "objetos de avaliacao",
      "conhecimentos gerais",
      "conhecimentos basicos",
      "conhecimentos especificos",
      "programa da prova",
      "programas das provas",
      "anexo de conteudos",
      "anexo dos conteudos",
    ];

  let inicio =
    -1;

  for (
    const marcador
    of marcadoresInicio
  ) {
    const posicao =
      normalizado.indexOf(
        marcador
      );

    if (
      posicao >=
        0 &&
      (
        inicio ===
          -1 ||
        posicao <
          inicio
      )
    ) {
      inicio =
        posicao;
    }
  }

  if (
    inicio ===
    -1
  ) {
    return original;
  }

  const trecho =
    original.slice(
      inicio
    );

  const normalizadoTrecho =
    removerAcentos(
      trecho
    ).toLowerCase();

  const marcadoresFim =
    [
      "cronograma de atividades",
      "calendario de atividades",
      "modelo de declaracao",
      "formulario de recurso",
      "anexo de vagas",
      "requisitos para investidura",
    ];

  let fim =
    trecho.length;

  for (
    const marcador
    of marcadoresFim
  ) {
    const posicao =
      normalizadoTrecho.indexOf(
        marcador,
        1000
      );

    if (
      posicao >
        0 &&
      posicao <
        fim
    ) {
      fim =
        posicao;
    }
  }

  return trecho
    .slice(
      0,
      fim
    )
    .trim();
}

function consolidarDisciplinas(
  disciplinasBrutas
) {
  const mapa =
    new Map();

  for (
    const item
    of disciplinasBrutas
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      continue;
    }

    const nome =
      textoSeguro(
        item.nome ||
        item.materia ||
        item.disciplina
      );

    if (!nome) {
      continue;
    }

    const chave =
      chaveComparacao(
        nome
      );

    const topicosFonte =
      Array.isArray(
        item.topicos
      )
        ? item.topicos
        : Array.isArray(
            item.assuntos
          )
          ? item.assuntos
          : [];

    if (
      !mapa.has(
        chave
      )
    ) {
      mapa.set(
        chave,
        {
          nome,

          prioridade:
            normalizarPrioridade(
              item.prioridade
            ),

          peso:
            normalizarPeso(
              item.peso
            ),

          topicos:
            [],

          _topicos:
            new Set(),
        }
      );
    }

    const atual =
      mapa.get(
        chave
      );

    atual.prioridade =
      maiorPrioridade(
        atual.prioridade,

        normalizarPrioridade(
          item.prioridade
        )
      );

    atual.peso =
      Math.max(
        atual.peso,

        normalizarPeso(
          item.peso
        )
      );

    for (
      const topico
      of topicosFonte
    ) {
      const nomeTopico =
        textoSeguro(
          typeof topico ===
            "string"
            ? topico
            : topico?.nome ||
              topico?.assunto ||
              topico?.topico ||
              topico?.conteudo
        );

      if (!nomeTopico) {
        continue;
      }

      const chaveTopico =
        chaveComparacao(
          nomeTopico
        );

      if (
        !atual
          ._topicos
          .has(
            chaveTopico
          )
      ) {
        atual
          ._topicos
          .add(
            chaveTopico
          );

        atual
          .topicos
          .push({
            nome:
              nomeTopico,
          });
      }
    }
  }

  return Array
    .from(
      mapa.values()
    )
    .map(
      ({
        _topicos,
        ...disciplina
      }) =>
        disciplina
    )
    .filter(
      (disciplina) =>
        disciplina
          .topicos
          .length >
        0
    );
}

function criarEstrategiaLocal(
  disciplinas
) {
  const altas =
    disciplinas
      .filter(
        (item) =>
          item.prioridade ===
          "alta"
      )
      .map(
        (item) =>
          item.nome
      )
      .slice(
        0,
        4
      );

  if (
    altas.length
  ) {
    return `Priorize ${altas.join(
      ", "
    )}, intercalando teoria, questões e revisões periódicas.`;
  }

  return "Estude por ciclos, priorizando as disciplinas de maior peso e revisando os tópicos por questões.";
}

function maiorPrioridade(
  a,
  b
) {
  const ordem = {
    baixa: 1,
    media: 2,
    alta: 3,
  };

  return ordem[b] >
    ordem[a]
    ? b
    : a;
}

function chaveComparacao(
  valor
) {
  return removerAcentos(
    textoSeguro(
      valor
    )
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function montarPromptCompleto({
  textoEdital,
  nomeArquivo,
  tipoArquivo,
}) {
  return `
Analise o edital de concurso público abaixo.

Extraia concurso, órgão, cargo, banca, data da prova, todas as disciplinas e todos os tópicos e subtópicos do conteúdo programático.
Não invente informações.
Use string vazia para informações ausentes.
A data deve usar AAAA-MM-DD.
A prioridade deve ser alta, media ou baixa.
O peso deve ser inteiro e no mínimo 1.
Cada tópico deve conter somente o campo nome.
Retorne JSON válido conforme o schema solicitado.

Arquivo: ${
  nomeArquivo ||
  "não informado"
}

Tipo: ${
  tipoArquivo ||
  "não informado"
}

EDITAL:

${textoEdital}
`;
}

function interpretarRespostaDaIa(
  resposta
) {
  const objeto =
    interpretarObjetoJson(
      resposta
    );

  if (
    !possuiEstruturaDeEdital(
      objeto
    )
  ) {
    throw new Error(
      "A resposta da IA não contém uma verticalização reconhecível."
    );
  }

  return objeto;
}

function interpretarObjetoJson(
  resposta
) {
  if (!resposta) {
    throw new Error(
      "A IA retornou uma resposta vazia."
    );
  }

  if (
    typeof resposta ===
      "object" &&
    !Array.isArray(
      resposta
    )
  ) {
    if (
      resposta.response &&
      typeof resposta.response ===
        "object"
    ) {
      return resposta.response;
    }

    const parsed =
      resposta
        ?.choices?.[0]
        ?.message
        ?.parsed;

    if (
      parsed &&
      typeof parsed ===
        "object"
    ) {
      return parsed;
    }

    const conteudo =
      resposta
        ?.choices?.[0]
        ?.message
        ?.content;

    if (
      typeof conteudo ===
        "string" &&
      conteudo.trim()
    ) {
      return extrairJson(
        conteudo
      );
    }

    if (
      typeof resposta.response ===
      "string"
    ) {
      return extrairJson(
        resposta.response
      );
    }

    if (
      typeof resposta.result ===
      "string"
    ) {
      return extrairJson(
        resposta.result
      );
    }

    if (
      resposta.result &&
      typeof resposta.result ===
        "object"
    ) {
      return resposta.result;
    }

    if (
      !Object
        .prototype
        .hasOwnProperty
        .call(
          resposta,
          "choices"
        ) &&
      !Object
        .prototype
        .hasOwnProperty
        .call(
          resposta,
          "response"
        )
    ) {
      return resposta;
    }
  }

  throw new Error(
    "A IA respondeu em um formato JSON não reconhecido."
  );
}

function possuiEstruturaDeEdital(
  valor
) {
  return Boolean(
    valor &&
    typeof valor ===
      "object" &&
    !Array.isArray(
      valor
    ) &&
    Array.isArray(
      valor.disciplinas
    ) &&
    valor.disciplinas
      .length >
      0
  );
}

function extrairJson(
  valor
) {
  const texto =
    textoSeguro(
      valor
    );

  if (!texto) {
    throw new Error(
      "A IA retornou texto vazio."
    );
  }

  const semMarkdown =
    texto
      .replace(
        /^```(?:json)?\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  for (
    const candidato
    of [
      texto,
      semMarkdown,
    ]
  ) {
    try {
      return JSON.parse(
        candidato
      );
    } catch {
      // Continua.
    }
  }

  const inicio =
    semMarkdown.indexOf(
      "{"
    );

  const fim =
    semMarkdown.lastIndexOf(
      "}"
    );

  if (
    inicio <
      0 ||
    fim <=
      inicio
  ) {
    throw new Error(
      "JSON não reconhecido na resposta da IA."
    );
  }

  return JSON.parse(
    semMarkdown.slice(
      inicio,
      fim + 1
    )
  );
}

function normalizarResultado(
  resultado
) {
  if (
    !resultado ||
    typeof resultado !==
      "object" ||
    Array.isArray(
      resultado
    )
  ) {
    throw new Error(
      "A estrutura retornada pela IA é inválida."
    );
  }

  const concurso =
    resultado.concurso &&
    typeof resultado.concurso ===
      "object"
      ? resultado.concurso
      : {};

  const origem =
    Array.isArray(
      resultado.disciplinas
    )
      ? resultado.disciplinas
      : Array.isArray(
          resultado.materias
        )
        ? resultado.materias
        : [];

  const disciplinas =
    consolidarDisciplinas(
      origem
    ).map(
      (
        disciplina,
        indice
      ) => ({
        nome:
          disciplina.nome,

        prioridade:
          normalizarPrioridade(
            disciplina.prioridade
          ),

        peso:
          normalizarPeso(
            disciplina.peso
          ),

        ordem:
          indice,

        topicos:
          disciplina
            .topicos
            .map(
              (
                topico,
                ordem
              ) => ({
                nome:
                  textoSeguro(
                    topico.nome
                  ),

                concluido:
                  false,

                status:
                  "pendente",

                ordem,
              })
            ),
      })
    );

  if (
    !disciplinas.length
  ) {
    throw new Error(
      "A IA não retornou disciplinas com tópicos válidos."
    );
  }

  return {
    concurso: {
      nome:
        textoSeguro(
          concurso.nome ||
          concurso.titulo ||
          resultado.nome_concurso
        ),

      orgao:
        textoSeguro(
          concurso.orgao ||
          concurso["órgão"] ||
          resultado.orgao
        ),

      cargo:
        textoSeguro(
          concurso.cargo ||
          resultado.cargo
        ),

      banca:
        textoSeguro(
          concurso.banca ||
          resultado.banca
        ),

      data_prova:
        normalizarData(
          concurso.data_prova ||
          concurso.prova ||
          resultado.data_prova
        ),
    },

    disciplinas,

    estrategia:
      textoSeguro(
        resultado.estrategia ||
        concurso.estrategia
      ) ||
      criarEstrategiaLocal(
        disciplinas
      ),
  };
}

async function salvarEdital(
  request,
  env
) {
  try {
    validarSupabase(
      env
    );

    const contentType =
      textoSeguro(
        request.headers.get(
          "content-type"
        )
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

    const body =
      await request.json();

    const dados =
      normalizarResultado(
        body.resultado ||
        body.analise ||
        body.resposta ||
        body
      );

    const userId =
      textoSeguro(
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
            "O campo user_id é obrigatório.",
        },
        400
      );
    }

    if (!concursoId) {
      return json(
        {
          ok: false,

          erro:
            "O campo concurso_id é obrigatório.",
        },
        400
      );
    }

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
            dados,
        }
      );

    return json(
      resultado &&
      typeof resultado ===
        "object"
        ? resultado
        : {
            ok: true,

            mensagem:
              "Edital verticalizado salvo com sucesso.",

            resultado,
          }
    );
  } catch (error) {
    console.error(
      "Erro ao salvar edital:",
      {
        erro:
          obterMensagemErro(
            error
          ),

        stack:
          error?.stack ||
          null,
      }
    );

    return json(
      {
        ok: false,

        erro:
          obterMensagemErro(
            error
          ),
      },
      500
    );
  }
}

async function supabaseRpc(
  env,
  nomeFuncao,
  parametros
) {
  const response =
    await fetch(
      `${obterSupabaseUrl(
        env
      )}/rest/v1/rpc/${nomeFuncao}`,
      {
        method:
          "POST",

        headers: {
          ...supabaseHeaders(
            env
          ),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify(
            parametros
          ),
      }
    );

  const data =
    await lerRespostaHttp(
      response
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Erro na função ${nomeFuncao}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}

async function gerarHashTexto(
  texto
) {
  const bytes =
    new TextEncoder()
      .encode(
        texto
      );

  const hash =
    await crypto
      .subtle
      .digest(
        "SHA-256",
        bytes
      );

  return Array
    .from(
      new Uint8Array(
        hash
      )
    )
    .map(
      (byte) =>
        byte
          .toString(
            16
          )
          .padStart(
            2,
            "0"
          )
    )
    .join(
      ""
    );
}

async function lerDadosDaRequisicao(
  request
) {
  const contentType =
    textoSeguro(
      request.headers.get(
        "content-type"
      )
    ).toLowerCase();

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    const body =
      await request.json();

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(
        body
      )
    ) {
      throw new Error(
        "O corpo JSON possui estrutura inválida."
      );
    }

    return body;
  }

  if (
    contentType.includes(
      "multipart/form-data"
    ) ||
    contentType.includes(
      "application/x-www-form-urlencoded"
    )
  ) {
    const formData =
      await request.formData();

    const dados = {};

    for (
      const [
        chave,
        valor,
      ]
      of formData.entries()
    ) {
      if (
        typeof valor ===
        "string"
      ) {
        dados[chave] =
          valor;
      }
    }

    const arquivo =
      formData.get(
        "arquivo"
      );

    if (
      arquivo &&
      typeof arquivo.text ===
        "function"
    ) {
      dados.texto_edital =
        await arquivo.text();

      dados.nome_arquivo =
        arquivo.name ||
        "";

      dados.tipo_arquivo =
        arquivo.type ||
        "";
    }

    return dados;
  }

  if (
    contentType.includes(
      "text/plain"
    )
  ) {
    return {
      texto_edital:
        await request.text(),

      tipo_arquivo:
        "text/plain",
    };
  }

  throw new Error(
    `Content-Type não suportado: ${
      contentType ||
      "não informado"
    }.`
  );
}

function validarBindingAI(
  env
) {
  if (!env.AI) {
    throw new Error(
      "Binding Workers AI não encontrado."
    );
  }
}

function validarSupabase(
  env
) {
  if (
    !textoSeguro(
      env.SUPABASE_URL
    ) ||
    !textoSeguro(
      env.SUPABASE_SERVICE_ROLE_KEY
    )
  ) {
    throw new Error(
      "Variáveis do Supabase não configuradas na Cloudflare."
    );
  }
}

function obterSupabaseUrl(
  env
) {
  return textoSeguro(
    env.SUPABASE_URL
  ).replace(
    /\/+$/,
    ""
  );
}

function supabaseHeaders(
  env
) {
  const chave =
    textoSeguro(
      env.SUPABASE_SERVICE_ROLE_KEY
    );

  if (!chave) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY está vazia."
    );
  }

  const headers = {
    apikey:
      chave,

    "Content-Type":
      "application/json",
  };

  if (
    chave
      .split(
        "."
      )
      .length ===
    3
  ) {
    headers.Authorization =
      `Bearer ${chave}`;
  }

  return headers;
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
  } catch {
    return texto;
  }
}

function normalizarPrioridade(
  valor
) {
  const prioridade =
    removerAcentos(
      textoSeguro(
        valor ||
        "media"
      )
    ).toLowerCase();

  return prioridade ===
    "alta" ||
    prioridade ===
      "baixa"
    ? prioridade
    : "media";
}

function normalizarPeso(
  valor
) {
  const peso =
    Number(
      valor
    );

  return Number.isFinite(
    peso
  ) &&
    peso >=
      1
    ? Math.round(
        peso
      )
    : 1;
}

function normalizarData(
  valor
) {
  const texto =
    textoSeguro(
      valor
    );

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      texto
    )
  ) {
    return texto;
  }

  if (
    /^\d{2}\/\d{2}\/\d{4}$/.test(
      texto
    )
  ) {
    const [
      dia,
      mes,
      ano,
    ] =
      texto.split(
        "/"
      );

    return `${ano}-${mes}-${dia}`;
  }

  return "";
}

function removerAcentos(
  valor
) {
  return textoSeguro(
    valor
  )
    .normalize(
      "NFD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}

function textoSeguro(
  valor
) {
  return valor ===
      null ||
    valor ===
      undefined
    ? ""
    : String(
        valor
      ).trim();
}

function obterMensagemErro(
  error
) {
  return error instanceof
    Error
    ? error.message
    : textoSeguro(
        error ||
        "Erro desconhecido."
      );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":
      "*",

    "Access-Control-Allow-Methods":
      "GET, POST, PATCH, DELETE, OPTIONS",

    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
  };
}

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
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
