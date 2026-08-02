const MODELO_TESTE = "@cf/zai-org/glm-4.7-flash";
const MODELO_EXTRACAO = "@cf/meta/llama-3.1-8b-instruct-fast";

const LIMITE_CURTO = 22000;
const TAMANHO_BLOCO = 14000;
const SOBREPOSICAO_BLOCO = 1200;
const MAXIMO_BLOCOS = 6;
const LIMITE_TEXTO_TOTAL = 80000;
const CONCORRENCIA_IA = 3;

const PRIORIDADES = ["alta", "media", "baixa"];

const ESQUEMA_DISCIPLINA = {
  type: "object",
  additionalProperties: false,
  properties: {
    nome: {
      type: "string"
    },
    grupo: {
      type: "string"
    },
    prioridade: {
      type: "string",
      enum: PRIORIDADES
    },
    peso: {
      type: "integer",
      minimum: 1
    },
    quantidade_questoes: {
      type: ["integer", "null"],
      minimum: 0
    },
    topicos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nome: {
            type: "string"
          },
          status: {
            type: "string",
            enum: ["pendente", "concluido"]
          }
        },
        required: ["nome", "status"]
      }
    }
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
    codigo: {
      type: "string"
    },
    nome: {
      type: "string"
    },
    especialidade: {
      type: "string"
    },
    nivel: {
      type: "string"
    },
    requisitos: {
      type: "string"
    },
    vagas: {
      type: ["integer", "null"],
      minimum: 0
    },
    disciplinas: {
      type: "array",
      items: ESQUEMA_DISCIPLINA
    }
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

const ESQUEMA_EDITAL_MULTICARGOS = {
  type: "object",
  additionalProperties: false,
  properties: {
    concurso: {
      type: "object",
      additionalProperties: false,
      properties: {
        nome: {
          type: "string"
        },
        orgao: {
          type: "string"
        },
        banca: {
          type: "string"
        },
        numero_edital: {
          type: "string"
        },
        data_prova: {
          type: "string"
        }
      },
      required: [
        "nome",
        "orgao",
        "banca",
        "numero_edital",
        "data_prova"
      ]
    },
    cargos: {
      type: "array",
      items: ESQUEMA_CARGO
    },
    estrategia: {
      type: "string"
    }
  },
  required: [
    "concurso",
    "cargos",
    "estrategia"
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
        nome: {
          type: "string"
        },
        orgao: {
          type: "string"
        },
        banca: {
          type: "string"
        },
        numero_edital: {
          type: "string"
        },
        data_prova: {
          type: "string"
        }
      },
      required: [
        "nome",
        "orgao",
        "banca",
        "numero_edital",
        "data_prova"
      ]
    },
    estrategia: {
      type: "string"
    }
  },
  required: [
    "concurso",
    "estrategia"
  ]
};

const ESQUEMA_BLOCO_CARGOS = {
  type: "object",
  additionalProperties: false,
  properties: {
    cargos: {
      type: "array",
      items: ESQUEMA_CARGO
    }
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
        url.pathname === "/api/health" &&
        request.method === "GET"
      ) {
        return json({
          ok: true,
          service: "Aprova Concurso DEV",
          versao: "multicargos-1.0.0",
          modelo_teste: MODELO_TESTE,
          modelo_extracao: MODELO_EXTRACAO,
          ai: Boolean(env.AI),
          assets: Boolean(env.ASSETS),
          supabase: Boolean(
            env.SUPABASE_URL &&
            env.SUPABASE_SERVICE_ROLE_KEY
          ),
          processamento_extenso: {
            limite_curto: LIMITE_CURTO,
            tamanho_bloco: TAMANHO_BLOCO,
            maximo_blocos: MAXIMO_BLOCOS,
            concorrencia: CONCORRENCIA_IA
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
        url.pathname === "/api/ai/teste" &&
        request.method === "GET"
      ) {
        return testarWorkersAI(env);
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
            erro: "Rota da API não encontrada.",
            path: url.pathname
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
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    } catch (error) {
      console.error("Erro não tratado no Worker:", error);

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
        max_completion_tokens: 300,
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

async function analisarEdital(request, env) {
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

    const nomeArquivo = textoSeguro(
      body.nome_arquivo ||
      body.nomeArquivo ||
      body.filename
    );

    const tipoArquivo = textoSeguro(
      body.tipo_arquivo ||
      body.tipoArquivo ||
      body.type
    );

    if (!textoOriginal || textoOriginal.length < 100) {
      return json(
        {
          ok: false,
          erro:
            "Nenhum texto suficiente foi extraído do edital. " +
            "PDFs escaneados precisam passar por OCR."
        },
        400
      );
    }

    const textoLimpo = limparTextoEdital(textoOriginal);
    const textoUtil = textoLimpo
      .slice(0, LIMITE_TEXTO_TOTAL)
      .trim();

    if (textoUtil.length < 100) {
      return json(
        {
          ok: false,
          erro:
            "O texto do edital ficou vazio ou insuficiente após a limpeza."
        },
        400
      );
    }

    let resultado;
    let modo;
    let blocosUsados = 1;

    if (textoUtil.length <= LIMITE_CURTO) {
      modo = "documento_unico";

      resultado = await analisarDocumentoUnico(
        env,
        {
          texto: textoUtil,
          nomeArquivo,
          tipoArquivo
        }
      );
    } else {
      modo = "blocos_multicargos";

      const blocos = dividirTextoEmBlocos(
        textoUtil,
        TAMANHO_BLOCO,
        SOBREPOSICAO_BLOCO,
        MAXIMO_BLOCOS
      );

      blocosUsados = blocos.length;

      resultado = await analisarDocumentoExtenso(
        env,
        {
          textoCompleto: textoUtil,
          blocos,
          nomeArquivo,
          tipoArquivo
        }
      );
    }

    const normalizado = normalizarEditalMulticargos(resultado);
    const hash = await gerarHashTexto(textoUtil);

    return json({
      ok: true,
      resultado: normalizado,
      resposta: normalizado,
      analise: normalizado,
      arquivo: {
        nome: nomeArquivo || null,
        tipo: tipoArquivo || null,
        caracteres_recebidos: textoOriginal.length,
        caracteres_analisados: textoUtil.length,
        texto_cortado: textoLimpo.length > LIMITE_TEXTO_TOTAL,
        hash
      },
      processamento: {
        modo,
        blocos: blocosUsados,
        duracao_ms: Date.now() - inicio
      },
      modelo: MODELO_EXTRACAO
    });
  } catch (error) {
    console.error("Erro ao analisar edital:", error);

    return json(
      {
        ok: false,
        erro: obterMensagemErro(error),
        modelo: MODELO_EXTRACAO,
        duracao_ms: Date.now() - inicio
      },
      500
    );
  }
}

async function analisarDocumentoUnico(
  env,
  {
    texto,
    nomeArquivo,
    tipoArquivo
  }
) {
  const prompt = `
Você é um especialista em verticalização de editais de concursos públicos.

Analise integralmente o edital abaixo.

OBJETIVO:
1. Identificar os dados gerais do concurso.
2. Identificar TODOS os cargos e especialidades.
3. Para cada cargo, identificar somente as disciplinas aplicáveis a ele.
4. Para cada disciplina, listar todos os tópicos e subtópicos do conteúdo programático.
5. Não misturar nomes de cargos com nomes de disciplinas.
6. Não misturar conteúdos de cargos diferentes.
7. Não inventar informações ausentes.
8. Quando um dado não existir, use string vazia ou null.
9. A data deve estar no formato AAAA-MM-DD.
10. O status inicial de todos os tópicos deve ser "pendente".

REGRAS DE INTERPRETAÇÃO:
- "Conhecimentos Gerais" e "Conhecimentos Específicos" são grupos, não cargos.
- Um cargo pode possuir especialidade.
- Disciplinas comuns devem aparecer em cada cargo ao qual se aplicam.
- Preserve a literalidade dos tópicos sempre que possível.
- Prioridade alta: disciplina específica, de maior peso ou maior número de questões.
- Prioridade média: disciplina geral relevante.
- Prioridade baixa: disciplina de menor incidência.
- Se peso ou quantidade de questões não forem informados, use peso 1 e quantidade_questoes null.

Arquivo: ${nomeArquivo || "não informado"}
Tipo: ${tipoArquivo || "não informado"}

TEXTO DO EDITAL:
${texto}
`;

  const resposta = await executarJsonSchema(
    env,
    prompt,
    ESQUEMA_EDITAL_MULTICARGOS,
    "edital_multicargos",
    7600
  );

  return interpretarRespostaDaIa(resposta);
}

async function analisarDocumentoExtenso(
  env,
  {
    textoCompleto,
    blocos,
    nomeArquivo,
    tipoArquivo
  }
) {
  const trechoInicial = textoCompleto.slice(0, 16000);

  const promessaMetadados = extrairMetadados(
    env,
    {
      texto: trechoInicial,
      nomeArquivo,
      tipoArquivo
    }
  );

  const tarefas = blocos.map(
    (bloco, indice) =>
      async () =>
        analisarBlocoDeCargos(
          env,
          {
            bloco,
            indice,
            total: blocos.length
          }
        )
  );

  const promessaBlocos = executarEmLotes(
    tarefas,
    CONCORRENCIA_IA
  );

  const [
    metadados,
    resultadosBlocos
  ] = await Promise.all([
    promessaMetadados,
    promessaBlocos
  ]);

  const cargosBrutos = resultadosBlocos.flatMap(
    item =>
      Array.isArray(item?.cargos)
        ? item.cargos
        : []
  );

  const cargos = consolidarCargos(cargosBrutos);

  if (!cargos.length) {
    throw new Error(
      "A IA não conseguiu identificar cargos com disciplinas válidas."
    );
  }

  return {
    concurso: metadados.concurso || {},
    cargos,
    estrategia:
      textoSeguro(metadados.estrategia) ||
      criarEstrategiaMulticargos(cargos)
  };
}

async function extrairMetadados(
  env,
  {
    texto,
    nomeArquivo,
    tipoArquivo
  }
) {
  const prompt = `
Extraia somente os dados gerais do concurso.

Não extraia disciplinas.
Não invente informações.
Use string vazia quando o dado não estiver presente.
A data da prova deve usar AAAA-MM-DD.

Arquivo: ${nomeArquivo || "não informado"}
Tipo: ${tipoArquivo || "não informado"}

TEXTO:
${texto}
`;

  const resposta = await executarJsonSchema(
    env,
    prompt,
    ESQUEMA_METADADOS,
    "metadados_concurso",
    1600
  );

  return interpretarRespostaDaIa(resposta);
}

async function analisarBlocoDeCargos(
  env,
  {
    bloco,
    indice,
    total
  }
) {
  const prompt = `
Você está analisando o bloco ${indice + 1} de ${total} de um edital de concurso.

Extraia somente informações realmente presentes neste bloco.

OBJETIVO:
- Identificar cargos, áreas e especialidades.
- Vincular as disciplinas ao cargo correto.
- Extrair os tópicos e subtópicos de cada disciplina.
- Não tratar cargo como disciplina.
- Não misturar conteúdos de cargos diferentes.
- Não inventar dados.
- Se este bloco não possuir cargos ou conteúdo programático útil, retorne cargos vazio.
- O status inicial de cada tópico deve ser "pendente".
- Use peso 1 quando não houver peso expresso.
- Use quantidade_questoes null quando não houver quantidade expressa.

BLOCO:
${bloco}
`;

  const resposta = await executarJsonSchema(
    env,
    prompt,
    ESQUEMA_BLOCO_CARGOS,
    `bloco_cargos_${indice + 1}`,
    5600
  );

  const interpretado = interpretarRespostaDaIa(resposta);

  return {
    cargos: Array.isArray(interpretado?.cargos)
      ? interpretado.cargos
      : []
  };
}

async function executarJsonSchema(
  env,
  prompt,
  schema,
  nomeSchema,
  maxTokens
) {
  validarBindingAI(env);

  return env.AI.run(
    MODELO_EXTRACAO,
    {
      messages: [
        {
          role: "system",
          content:
            "Retorne somente JSON válido conforme o schema. " +
            "Não use markdown, comentários ou texto fora do JSON."
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
      max_completion_tokens: maxTokens,
      temperature: 0
    }
  );
}

function interpretarRespostaDaIa(resposta) {
  if (!resposta) {
    throw new Error("A IA retornou uma resposta vazia.");
  }

  const candidatos = [
    resposta.parsed,
    resposta.result,
    resposta.response,
    resposta.output,
    resposta?.choices?.[0]?.message?.parsed,
    resposta?.choices?.[0]?.message?.content
  ];

  for (const candidato of candidatos) {
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
      const objeto = extrairJson(candidato);

      if (objeto) {
        return objeto;
      }
    }
  }

  throw new Error(
    "A IA respondeu, mas não foi possível interpretar o JSON."
  );
}

function extrairConteudoResposta(resposta) {
  return (
    resposta?.choices?.[0]?.message?.content ||
    resposta?.response ||
    resposta?.result ||
    resposta?.output ||
    null
  );
}

function extrairJson(texto) {
  const bruto = String(texto || "").trim();

  if (!bruto) {
    return null;
  }

  try {
    return JSON.parse(bruto);
  } catch (_) {}

  const semMarkdown = bruto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(semMarkdown);
  } catch (_) {}

  const inicio = semMarkdown.indexOf("{");
  const fim = semMarkdown.lastIndexOf("}");

  if (inicio >= 0 && fim > inicio) {
    try {
      return JSON.parse(
        semMarkdown.slice(inicio, fim + 1)
      );
    } catch (_) {}
  }

  return null;
}

function normalizarEditalMulticargos(resultado) {
  const concursoBruto =
    resultado?.concurso &&
    typeof resultado.concurso === "object"
      ? resultado.concurso
      : {};

  let cargosBrutos = Array.isArray(resultado?.cargos)
    ? resultado.cargos
    : [];

  /*
   * Compatibilidade com respostas antigas que possuíam apenas
   * concurso.cargo e disciplinas na raiz.
   */
  if (
    !cargosBrutos.length &&
    Array.isArray(resultado?.disciplinas)
  ) {
    cargosBrutos = [
      {
        codigo: "",
        nome:
          textoSeguro(concursoBruto.cargo) ||
          "Cargo não identificado",
        especialidade: "",
        nivel: "",
        requisitos: "",
        vagas: null,
        disciplinas: resultado.disciplinas
      }
    ];
  }

  const cargos = consolidarCargos(cargosBrutos);

  if (!cargos.length) {
    throw new Error(
      "A IA não retornou cargos com disciplinas e tópicos válidos."
    );
  }

  return {
    concurso: {
      nome:
        textoSeguro(concursoBruto.nome) ||
        "Concurso importado por IA",
      orgao:
        textoSeguro(concursoBruto.orgao),
      banca:
        textoSeguro(concursoBruto.banca),
      numero_edital:
        textoSeguro(
          concursoBruto.numero_edital ||
          concursoBruto.numero
        ),
      data_prova:
        normalizarData(
          concursoBruto.data_prova ||
          concursoBruto.prova
        )
    },
    cargos,
    estrategia:
      textoSeguro(resultado?.estrategia) ||
      criarEstrategiaMulticargos(cargos)
  };
}

function consolidarCargos(cargosBrutos) {
  const mapa = new Map();

  for (const cargoBruto of cargosBrutos || []) {
    if (!cargoBruto || typeof cargoBruto !== "object") {
      continue;
    }

    const nome = textoSeguro(
      cargoBruto.nome ||
      cargoBruto.cargo
    );

    const especialidade = textoSeguro(
      cargoBruto.especialidade ||
      cargoBruto.area
    );

    if (!nome && !especialidade) {
      continue;
    }

    const chave = normalizarChave(
      `${nome}|${especialidade}`
    );

    if (!chave) {
      continue;
    }

    const disciplinas = consolidarDisciplinas(
      cargoBruto.disciplinas
    );

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        codigo: textoSeguro(cargoBruto.codigo),
        nome: nome || especialidade,
        especialidade:
          especialidade &&
          normalizarChave(especialidade) !== normalizarChave(nome)
            ? especialidade
            : "",
        nivel: textoSeguro(cargoBruto.nivel),
        requisitos: textoSeguro(cargoBruto.requisitos),
        vagas: normalizarInteiroOuNull(cargoBruto.vagas),
        disciplinas
      });

      continue;
    }

    const existente = mapa.get(chave);

    existente.codigo =
      existente.codigo ||
      textoSeguro(cargoBruto.codigo);

    existente.nivel =
      existente.nivel ||
      textoSeguro(cargoBruto.nivel);

    existente.requisitos =
      existente.requisitos ||
      textoSeguro(cargoBruto.requisitos);

    existente.vagas =
      existente.vagas ??
      normalizarInteiroOuNull(cargoBruto.vagas);

    existente.disciplinas = consolidarDisciplinas([
      ...existente.disciplinas,
      ...disciplinas
    ]);
  }

  return Array.from(mapa.values())
    .filter(cargo => cargo.disciplinas.length)
    .sort((a, b) =>
      `${a.nome} ${a.especialidade}`.localeCompare(
        `${b.nome} ${b.especialidade}`,
        "pt-BR"
      )
    );
}

function consolidarDisciplinas(disciplinasBrutas) {
  const mapa = new Map();

  for (const disciplinaBruta of disciplinasBrutas || []) {
    if (!disciplinaBruta) {
      continue;
    }

    const nome = textoSeguro(
      typeof disciplinaBruta === "string"
        ? disciplinaBruta
        : disciplinaBruta.nome
    );

    if (!nome) {
      continue;
    }

    const chave = normalizarChave(nome);

    const topicos = normalizarTopicos(
      typeof disciplinaBruta === "object"
        ? disciplinaBruta.topicos
        : []
    );

    if (!topicos.length) {
      continue;
    }

    const disciplina = {
      nome,
      grupo:
        textoSeguro(disciplinaBruta.grupo) ||
        "Conteúdo programático",
      prioridade: normalizarPrioridade(
        disciplinaBruta.prioridade
      ),
      peso: normalizarPeso(
        disciplinaBruta.peso
      ),
      quantidade_questoes: normalizarInteiroOuNull(
        disciplinaBruta.quantidade_questoes ||
        disciplinaBruta.numero_questoes
      ),
      topicos
    };

    if (!mapa.has(chave)) {
      mapa.set(chave, disciplina);
      continue;
    }

    const existente = mapa.get(chave);

    existente.grupo =
      existente.grupo !== "Conteúdo programático"
        ? existente.grupo
        : disciplina.grupo;

    existente.prioridade = maiorPrioridade(
      existente.prioridade,
      disciplina.prioridade
    );

    existente.peso = Math.max(
      existente.peso,
      disciplina.peso
    );

    existente.quantidade_questoes =
      existente.quantidade_questoes ??
      disciplina.quantidade_questoes;

    existente.topicos = normalizarTopicos([
      ...existente.topicos,
      ...disciplina.topicos
    ]);
  }

  return Array.from(mapa.values());
}

function normalizarTopicos(topicosBrutos) {
  const mapa = new Map();

  for (const topicoBruto of topicosBrutos || []) {
    const nome = textoSeguro(
      typeof topicoBruto === "string"
        ? topicoBruto
        : topicoBruto?.nome
    );

    if (!nome) {
      continue;
    }

    const chave = normalizarChave(nome);

    if (!chave || mapa.has(chave)) {
      continue;
    }

    mapa.set(chave, {
      nome,
      status:
        topicoBruto?.status === "concluido"
          ? "concluido"
          : "pendente"
    });
  }

  return Array.from(mapa.values());
}

async function salvarEdital(request, env) {
  try {
    validarSupabase(env);

    const body = await lerJsonRequest(request);

    const userId = textoSeguro(
      body.user_id ||
      body.userId
    );

    const concursoId = textoSeguro(
      body.concurso_id ||
      body.concursoId
    );

    if (!userId) {
      return json(
        {
          ok: false,
          erro: "O campo user_id é obrigatório."
        },
        400
      );
    }

    if (!concursoId) {
      return json(
        {
          ok: false,
          erro: "O campo concurso_id é obrigatório."
        },
        400
      );
    }

    const fonte =
      body.resultado ||
      body.analise ||
      body.resposta ||
      body;

    const dados = normalizarParaSalvamento(fonte);

    const resultado = await supabaseRpc(
      env,
      "salvar_edital_verticalizado",
      {
        p_user_id: userId,
        p_concurso_id: concursoId,
        p_dados: dados
      }
    );

    const retorno =
      resultado &&
      typeof resultado === "object" &&
      !Array.isArray(resultado)
        ? resultado
        : {
            resultado
          };

    return json({
      ok: retorno.ok !== false,
      mensagem:
        retorno.mensagem ||
        "Edital verticalizado salvo com sucesso.",
      concurso_id:
        retorno.concurso_id ||
        concursoId,
      disciplinas_salvas:
        retorno.disciplinas_salvas ??
        dados.disciplinas.length,
      topicos_salvos:
        retorno.topicos_salvos ??
        contarTopicos(dados.disciplinas),
      resultado: retorno
    });
  } catch (error) {
    console.error("Erro ao salvar edital:", error);

    return json(
      {
        ok: false,
        erro: obterMensagemErro(error)
      },
      500
    );
  }
}

function normalizarParaSalvamento(fonte) {
  if (!fonte || typeof fonte !== "object") {
    throw new Error(
      "Os dados enviados para salvamento são inválidos."
    );
  }

  /*
   * O frontend multicargos deve enviar o cargo já selecionado
   * no formato antigo: concurso + disciplinas.
   */
  if (
    fonte.concurso &&
    Array.isArray(fonte.disciplinas)
  ) {
    const disciplinas = consolidarDisciplinas(
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
          textoSeguro(fonte.concurso.nome) ||
          "Concurso importado por IA",
        orgao: textoSeguro(fonte.concurso.orgao),
        cargo: textoSeguro(fonte.concurso.cargo),
        banca: textoSeguro(fonte.concurso.banca),
        data_prova: normalizarData(
          fonte.concurso.data_prova ||
          fonte.concurso.prova
        )
      },
      disciplinas,
      estrategia:
        textoSeguro(fonte.estrategia) ||
        criarEstrategiaDisciplinas(disciplinas)
    };
  }

  /*
   * Segurança adicional: aceita o edital multicargos somente
   * quando houver exatamente um cargo.
   */
  if (Array.isArray(fonte.cargos)) {
    const edital = normalizarEditalMulticargos(fonte);

    if (edital.cargos.length !== 1) {
      throw new Error(
        "Selecione um cargo antes de salvar o edital."
      );
    }

    const cargo = edital.cargos[0];

    return {
      concurso: {
        nome: edital.concurso.nome,
        orgao: edital.concurso.orgao,
        cargo: montarNomeCargo(cargo),
        banca: edital.concurso.banca,
        data_prova: edital.concurso.data_prova
      },
      disciplinas: cargo.disciplinas,
      estrategia: edital.estrategia
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
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...supabaseHeaders(env),
        Prefer: "return=representation"
      },
      body: JSON.stringify(parametros)
    });
  } catch (error) {
    throw new Error(
      `Falha de rede ao acessar o Supabase: ${obterMensagemErro(error)}`
    );
  }

  const data = await lerRespostaHttp(response);

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

async function lerRespostaHttp(response) {
  const texto = await response.text();

  if (!texto) {
    return null;
  }

  try {
    return JSON.parse(texto);
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
        texto.lastIndexOf("\n\n", fim),
        texto.lastIndexOf("\n", fim),
        texto.lastIndexOf(". ", fim)
      ].filter(posicao => posicao > inicio + tamanho * 0.65);

      if (candidatos.length) {
        fim = Math.max(...candidatos) + 1;
      }
    }

    const bloco = texto.slice(inicio, fim).trim();

    if (bloco) {
      blocos.push(bloco);
    }

    if (fim >= texto.length) {
      break;
    }

    inicio = Math.max(
      fim - sobreposicao,
      inicio + 1
    );
  }

  return blocos;
}

async function executarEmLotes(
  tarefas,
  concorrencia
) {
  const resultados = new Array(tarefas.length);
  let proximo = 0;

  async function executar() {
    while (true) {
      const indice = proximo;
      proximo += 1;

      if (indice >= tarefas.length) {
        return;
      }

      resultados[indice] = await tarefas[indice]();
    }
  }

  const quantidade = Math.min(
    concorrencia,
    tarefas.length
  );

  await Promise.all(
    Array.from(
      { length: quantidade },
      () => executar()
    )
  );

  return resultados;
}

function limparTextoEdital(texto) {
  return String(texto || "")
    .replace(/\u0000/g, "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function criarEstrategiaMulticargos(cargos) {
  const totalCargos = cargos.length;

  return (
    `Foram identificados ${totalCargos} cargo(s). ` +
    "Selecione o cargo desejado antes de gerar a grade. " +
    "Priorize disciplinas específicas e de maior peso, " +
    "intercalando teoria, questões e revisões periódicas."
  );
}

function criarEstrategiaDisciplinas(disciplinas) {
  return (
    "Estude por ciclos, priorizando as disciplinas de maior peso, " +
    "resolva questões após cada bloco teórico e programe revisões " +
    "de curto, médio e longo prazo."
  );
}

function contarTopicos(disciplinas) {
  return (disciplinas || []).reduce(
    (total, disciplina) =>
      total +
      (Array.isArray(disciplina.topicos)
        ? disciplina.topicos.length
        : 0),
    0
  );
}

function montarNomeCargo(cargo) {
  return [
    textoSeguro(cargo?.nome),
    textoSeguro(cargo?.especialidade)
  ]
    .filter(Boolean)
    .join(" — ");
}

function maiorPrioridade(a, b) {
  const ordem = {
    alta: 3,
    media: 2,
    baixa: 1
  };

  return ordem[b] > ordem[a]
    ? b
    : a;
}

function normalizarPrioridade(valor) {
  const chave = normalizarChave(valor);

  if (
    chave === "alta" ||
    chave.includes("alta")
  ) {
    return "alta";
  }

  if (
    chave === "baixa" ||
    chave.includes("baixa")
  ) {
    return "baixa";
  }

  return "media";
}

function normalizarPeso(valor) {
  const numero = Number(valor);

  if (
    Number.isFinite(numero) &&
    numero >= 1
  ) {
    return Math.max(
      1,
      Math.round(numero)
    );
  }

  return 1;
}

function normalizarInteiroOuNull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return Math.max(
    0,
    Math.round(numero)
  );
}

function normalizarData(valor) {
  const texto = textoSeguro(valor);

  if (!texto) {
    return "";
  }

  const iso = texto.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (iso) {
    return texto;
  }

  const brasileira = texto.match(
    /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/
  );

  if (brasileira) {
    const dia = brasileira[1].padStart(2, "0");
    const mes = brasileira[2].padStart(2, "0");
    const ano = brasileira[3];

    return `${ano}-${mes}-${dia}`;
  }

  return "";
}

function normalizarChave(valor) {
  return textoSeguro(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textoSeguro(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(valor).trim();
}

async function gerarHashTexto(texto) {
  const bytes = new TextEncoder().encode(texto);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    bytes
  );

  return Array.from(new Uint8Array(hash))
    .map(byte =>
      byte
        .toString(16)
        .padStart(2, "0")
    )
    .join("");
}

async function lerJsonRequest(request) {
  const contentType = textoSeguro(
    request.headers.get("content-type")
  ).toLowerCase();

  if (!contentType.includes("application/json")) {
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

function validarBindingAI(env) {
  if (!env?.AI) {
    throw new Error(
      "O binding AI não está configurado no Worker."
    );
  }
}

function validarSupabase(env) {
  if (!env?.SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL não está configurada."
    );
  }

  if (!env?.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está configurada."
    );
  }
}

function obterSupabaseUrl(env) {
  return textoSeguro(env.SUPABASE_URL)
    .replace(/\/+$/, "");
}

function supabaseHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, X-Requested-With",
    "Access-Control-Max-Age": "86400"
  };
}

function json(dados, status = 200) {
  return new Response(
    JSON.stringify(dados, null, 2),
    {
      status,
      headers: {
        ...corsHeaders(),
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function obterMensagemErro(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch (_) {
    return "Erro interno desconhecido.";
  }
}
