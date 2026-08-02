const MODELO_TESTE = "@cf/zai-org/glm-4.7-flash";
const MODELO_EXTRACAO = "@cf/meta/llama-3.1-8b-instruct-fast";
const LIMITE_CARACTERES_EDITAL = 60000;

const ESQUEMA_EDITAL = {
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

                concluido: {
                  type: "boolean",
                },

                status: {
                  type: "string",
                  enum: [
                    "pendente",
                  ],
                },
              },

              required: [
                "nome",
                "concluido",
                "status",
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "OPTIONS") {
        return new Response(
          null,
          {
            status: 204,
            headers: corsHeaders(),
          }
        );
      }

      if (
        url.pathname === "/api/health" &&
        request.method === "GET"
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
            Boolean(env.AI),

          assets:
            Boolean(env.ASSETS),

          supabase:
            Boolean(
              env.SUPABASE_URL &&
              env.SUPABASE_SERVICE_ROLE_KEY
            ),

          debug: {
            tem_AI:
              Boolean(env.AI),

            tem_ASSETS:
              Boolean(env.ASSETS),

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
        url.pathname === "/api/ai/teste" &&
        request.method === "GET"
      ) {
        return testarWorkersAI(env);
      }

      if (
        url.pathname ===
          "/api/ai/analisar-edital" &&
        request.method === "POST"
      ) {
        return analisarEdital(
          request,
          env
        );
      }

      if (
        url.pathname ===
          "/api/ai/salvar-edital" &&
        request.method === "POST"
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
    if (!env.AI) {
      return json(
        {
          ok: false,

          etapa:
            "binding",

          erro:
            "Binding AI não encontrado.",
        },
        500
      );
    }

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
  try {
    if (!env.AI) {
      return json(
        {
          ok: false,

          erro:
            "Binding Workers AI não encontrado.",
        },
        500
      );
    }

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

    const textoEdital =
      textoOriginal.slice(
        0,
        LIMITE_CARACTERES_EDITAL
      );

    const prompt =
      montarPrompt({
        textoEdital,
        nomeArquivo,
        tipoArquivo,
      });

    const respostaBruta =
      await executarExtracaoEstruturada(
        env,
        prompt
      );

    const respostaInterpretada =
      interpretarRespostaDaIa(
        respostaBruta
      );

    const resultado =
      normalizarResultado(
        respostaInterpretada
      );

    return json({
      ok: true,

      resultado,

      resposta:
        resultado,

      analise:
        resultado,

      arquivo: {
        nome:
          nomeArquivo ||
          null,

        tipo:
          tipoArquivo ||
          null,

        caracteres_recebidos:
          textoOriginal.length,

        caracteres_analisados:
          textoEdital.length,

        texto_cortado:
          textoOriginal.length >
          LIMITE_CARACTERES_EDITAL,
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
      },
      500
    );
  }
}

async function executarExtracaoEstruturada(
  env,
  prompt
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
              "Você extrai conteúdo programático de editais de concursos. Use apenas informações existentes no documento.",
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
            ESQUEMA_EDITAL,
        },

        max_tokens:
          8000,

        temperature:
          0,
      }
    );
  } catch (erroJsonMode) {
    console.warn(
      "JSON Mode falhou. Executando tentativa de recuperação:",
      obterMensagemErro(
        erroJsonMode
      )
    );

    return env.AI.run(
      MODELO_EXTRACAO,
      {
        messages: [
          {
            role:
              "system",

            content:
              "Extraia o conteúdo do edital e retorne exclusivamente JSON válido, sem markdown nem explicações.",
          },

          {
            role:
              "user",

            content:
              prompt,
          },
        ],

        max_tokens:
          8000,

        temperature:
          0,
      }
    );
  }
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
      Array.isArray(body)
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
      const [chave, valor]
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

function montarPrompt({
  textoEdital,
  nomeArquivo,
  tipoArquivo,
}) {
  return `
Analise o edital de concurso público abaixo.

Retorne somente JSON válido.
Não use markdown.
Não escreva comentários.
Não escreva explicações.
Não escreva texto antes ou depois do JSON.

Use esta estrutura:

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
      "prioridade": "alta|media|baixa",
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

1. Identifique concurso, órgão, cargo, banca e data da prova.
2. Extraia todas as disciplinas do conteúdo programático.
3. Extraia todos os tópicos e subtópicos.
4. Preserve os nomes e a terminologia do edital.
5. Não invente informações.
6. Use string vazia para informações ausentes.
7. A data deve usar o formato AAAA-MM-DD.
8. A prioridade deve ser alta, media ou baixa.
9. O peso deve ser inteiro e no mínimo 1.
10. Todo tópico deve começar com concluido=false.
11. Todo tópico deve começar com status="pendente".
12. Não omita disciplinas existentes no conteúdo programático.
13. Não misture tópicos de disciplinas diferentes.

DADOS DO ARQUIVO:

Nome: ${
  nomeArquivo ||
  "não informado"
}

Tipo: ${
  tipoArquivo ||
  "não informado"
}

CONTEÚDO DO EDITAL:

${textoEdital}
`;
}

function interpretarRespostaDaIa(
  resposta
) {
  if (!resposta) {
    throw new Error(
      "A IA retornou uma resposta vazia."
    );
  }

  if (
    possuiEstruturaDeEdital(
      resposta
    )
  ) {
    return resposta;
  }

  if (
    possuiEstruturaDeEdital(
      resposta.response
    )
  ) {
    return resposta.response;
  }

  const escolha =
    resposta
      ?.choices?.[0] ||
    null;

  const parsed =
    escolha
      ?.message
      ?.parsed;

  if (
    possuiEstruturaDeEdital(
      parsed
    )
  ) {
    return parsed;
  }

  const finishReason =
    escolha
      ?.finish_reason ||
    null;

  const conteudo =
    escolha
      ?.message
      ?.content;

  if (
    finishReason ===
      "length" &&
    !conteudo
  ) {
    throw new Error(
      "A IA atingiu o limite de tokens antes de produzir o JSON."
    );
  }

  const candidatos = [
    resposta.response,
    resposta.result,
    resposta.result
      ?.response,
    resposta.text,
    resposta.output_text,
    conteudo,
    escolha?.text,
  ];

  for (
    const candidato
    of candidatos
  ) {
    if (
      possuiEstruturaDeEdital(
        candidato
      )
    ) {
      return candidato;
    }

    if (
      typeof candidato ===
        "string" &&
      candidato.trim()
    ) {
      try {
        const objeto =
          extrairJson(
            candidato
          );

        if (
          possuiEstruturaDeEdital(
            objeto
          )
        ) {
          return objeto;
        }
      } catch {
        // Continua testando os demais formatos.
      }
    }
  }

  if (
    Array.isArray(
      resposta.output
    )
  ) {
    for (
      const item
      of resposta.output
    ) {
      if (
        possuiEstruturaDeEdital(
          item
        )
      ) {
        return item;
      }

      const partes = [
        item,
        item?.text,
        item?.content,
      ];

      for (
        const parte
        of partes
      ) {
        if (
          typeof parte ===
            "string" &&
          parte.trim()
        ) {
          try {
            const objeto =
              extrairJson(
                parte
              );

            if (
              possuiEstruturaDeEdital(
                objeto
              )
            ) {
              return objeto;
            }
          } catch {
            // Continua.
          }
        }
      }

      if (
        Array.isArray(
          item?.content
        )
      ) {
        for (
          const parte
          of item.content
        ) {
          if (
            typeof parte?.text ===
              "string"
          ) {
            try {
              const objeto =
                extrairJson(
                  parte.text
                );

              if (
                possuiEstruturaDeEdital(
                  objeto
                )
              ) {
                return objeto;
              }
            } catch {
              // Continua.
            }
          }
        }
      }
    }
  }

  console.error(
    "Resposta da IA não reconhecida:",
    JSON.stringify(
      resposta
    ).slice(
      0,
      10000
    )
  );

  throw new Error(
    `A resposta da IA não contém uma verticalização reconhecível. finish_reason: ${
      finishReason ||
      "não informado"
    }.`
  );
}

function possuiEstruturaDeEdital(
  valor
) {
  return Boolean(
    valor &&
    typeof valor ===
      "object" &&
    !Array.isArray(valor) &&
    Array.isArray(
      valor.disciplinas
    ) &&
    valor.disciplinas
      .length > 0
  );
}

function extrairJson(
  valor
) {
  if (
    valor &&
    typeof valor ===
      "object" &&
    !Array.isArray(valor)
  ) {
    return valor;
  }

  const texto =
    textoSeguro(valor);

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
    inicio < 0 ||
    fim <= inicio
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
    Array.isArray(resultado)
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
    origem
      .map(
        (
          item,
          indice
        ) => {
          const disciplina =
            item &&
            typeof item ===
              "object"
              ? item
              : {
                  nome:
                    textoSeguro(
                      item
                    ),
                };

          const topicosOrigem =
            Array.isArray(
              disciplina.topicos
            )
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

          const topicos =
            topicosOrigem
              .map(
                (
                  topico,
                  ordem
                ) => ({
                  nome:
                    textoSeguro(
                      typeof topico ===
                        "string"
                        ? topico
                        : topico
                            ?.nome ||
                          topico
                            ?.assunto ||
                          topico
                            ?.topico ||
                          topico
                            ?.conteudo
                    ),

                  concluido:
                    false,

                  status:
                    "pendente",

                  ordem,
                })
              )
              .filter(
                (topico) =>
                  topico.nome
              );

          return {
            nome:
              textoSeguro(
                disciplina.nome ||
                disciplina.materia ||
                disciplina.disciplina ||
                `Disciplina ${
                  indice + 1
                }`
              ),

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

            topicos,
          };
        }
      )
      .filter(
        (disciplina) =>
          disciplina.nome &&
          disciplina.topicos
            .length
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
      ),
  };
}

async function salvarEdital(
  request,
  env
) {
  try {
    validarSupabase(env);

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

    await supabaseUpdate(
      env,
      "concursos",
      {
        titulo:
          dados.concurso.nome ||
          null,

        nome:
          dados.concurso.nome ||
          null,

        orgao:
          dados.concurso.orgao ||
          null,

        cargo:
          dados.concurso.cargo ||
          null,

        banca:
          dados.concurso.banca ||
          null,

        data_prova:
          dados.concurso
            .data_prova ||
          null,

        estado:
          "ativo",

        ativo:
          true,

        updated_at:
          new Date()
            .toISOString(),
      },
      {
        id:
          concursoId,

        user_id:
          userId,
      }
    );

    await excluirVerticalizacaoAnterior(
      env,
      concursoId,
      userId
    );

    let totalDisciplinas =
      0;

    let totalTopicos =
      0;

    for (
      const [
        indice,
        disciplina,
      ]
      of dados.disciplinas
        .entries()
    ) {
      const criada =
        await supabaseInsert(
          env,
          "disciplinas",
          {
            concurso_id:
              concursoId,

            user_id:
              userId,

            nome:
              disciplina.nome,

            prioridade:
              disciplina.prioridade,

            peso:
              disciplina.peso,

            ordem:
              indice,
          }
        );

      if (!criada?.id) {
        throw new Error(
          `O Supabase não retornou o ID da disciplina "${disciplina.nome}".`
        );
      }

      totalDisciplinas++;

      for (
        const [
          ordem,
          topico,
        ]
        of disciplina.topicos
          .entries()
      ) {
        await supabaseInsert(
          env,
          "topicos",
          {
            disciplina_id:
              criada.id,

            concurso_id:
              concursoId,

            user_id:
              userId,

            nome:
              topico.nome,

            status:
              "pendente",

            concluido:
              false,

            ordem,
          }
        );

        totalTopicos++;
      }
    }

    return json({
      ok: true,

      mensagem:
        "Edital verticalizado salvo com sucesso.",

      concurso_id:
        concursoId,

      disciplinas_salvas:
        totalDisciplinas,

      topicos_salvos:
        totalTopicos,
    });
  } catch (error) {
    console.error(
      "Erro ao salvar edital:",
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
}

async function excluirVerticalizacaoAnterior(
  env,
  concursoId,
  userId
) {
  const disciplinas =
    await supabaseSelect(
      env,
      "disciplinas",
      {
        concurso_id:
          concursoId,

        user_id:
          userId,
      },
      "id"
    );

  for (
    const disciplina
    of disciplinas
  ) {
    await supabaseDelete(
      env,
      "topicos",
      {
        disciplina_id:
          disciplina.id,

        concurso_id:
          concursoId,

        user_id:
          userId,
      }
    );
  }

  await supabaseDelete(
    env,
    "disciplinas",
    {
      concurso_id:
        concursoId,

      user_id:
        userId,
    }
  );
}

async function supabaseSelect(
  env,
  tabela,
  filtros = {},
  campos = "*"
) {
  const parametros =
    montarFiltros(
      filtros
    );

  parametros.set(
    "select",
    campos
  );

  parametros.set(
    "limit",
    "10000"
  );

  const response =
    await fetch(
      `${obterSupabaseUrl(
        env
      )}/rest/v1/${tabela}?${parametros.toString()}`,
      {
        method:
          "GET",

        headers:
          supabaseHeaders(
            env
          ),
      }
    );

  const data =
    await lerRespostaHttp(
      response
    );

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar ${tabela}: ${JSON.stringify(
        data
      )}`
    );
  }

  return Array.isArray(
    data
  )
    ? data
    : [];
}

async function supabaseInsert(
  env,
  tabela,
  payload
) {
  const response =
    await fetch(
      `${obterSupabaseUrl(
        env
      )}/rest/v1/${tabela}`,
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
            payload
          ),
      }
    );

  const data =
    await lerRespostaHttp(
      response
    );

  if (!response.ok) {
    throw new Error(
      `Erro ao inserir em ${tabela}: ${JSON.stringify(
        data
      )}`
    );
  }

  if (
    !Array.isArray(
      data
    ) ||
    !data[0]
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
  const parametros =
    montarFiltros(
      filtros
    );

  const response =
    await fetch(
      `${obterSupabaseUrl(
        env
      )}/rest/v1/${tabela}?${parametros.toString()}`,
      {
        method:
          "PATCH",

        headers: {
          ...supabaseHeaders(
            env
          ),

          Prefer:
            "return=representation",
        },

        body:
          JSON.stringify(
            payload
          ),
      }
    );

  const data =
    await lerRespostaHttp(
      response
    );

  if (!response.ok) {
    throw new Error(
      `Erro ao atualizar ${tabela}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}

async function supabaseDelete(
  env,
  tabela,
  filtros
) {
  const parametros =
    montarFiltros(
      filtros
    );

  const response =
    await fetch(
      `${obterSupabaseUrl(
        env
      )}/rest/v1/${tabela}?${parametros.toString()}`,
      {
        method:
          "DELETE",

        headers: {
          ...supabaseHeaders(
            env
          ),

          Prefer:
            "return=minimal",
        },
      }
    );

  const data =
    await lerRespostaHttp(
      response
    );

  if (!response.ok) {
    throw new Error(
      `Erro ao excluir em ${tabela}: ${JSON.stringify(
        data
      )}`
    );
  }

  return data;
}

function montarFiltros(
  filtros = {}
) {
  const parametros =
    new URLSearchParams();

  for (
    const [campo, valor]
    of Object.entries(
      filtros
    )
  ) {
    if (
      valor !== null &&
      valor !== undefined &&
      valor !== ""
    ) {
      parametros.set(
        campo,
        `eq.${valor}`
      );
    }
  }

  return parametros;
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
    chave.split(
      "."
    ).length === 3
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
    Number(valor);

  return Number.isFinite(
    peso
  ) &&
    peso >= 1
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
