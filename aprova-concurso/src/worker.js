const MODELO_TESTE = "@cf/zai-org/glm-4.7-flash";
const MODELO_EXTRACAO = "@cf/meta/llama-3.1-8b-instruct-fast";
const MODELO_FALLBACK = "@cf/zai-org/glm-4.7-flash";

/*
 * Limites conservadores para reduzir respostas interrompidas
 * e inconsistências no Content-Length da Workers AI.
 */
const LIMITE_CURTO = 14000;
const TAMANHO_BLOCO = 9000;
const SOBREPOSICAO_BLOCO = 900;
const MAXIMO_BLOCOS_LEGADO = 8;
const LIMITE_TEXTO_TOTAL = 68000;

/*
 * Uma chamada por vez. Chamadas simultâneas extensas podem
 * provocar respostas incompletas na infraestrutura da IA.
 */
const CONCORRENCIA_IA = 1;

/*
 * Tentativas automáticas para falhas transitórias da Workers AI.
 */
const MAXIMO_TENTATIVAS_IA = 3;
const ESPERA_REPETICAO_MS = 900;

/* Pipeline em duas passagens: primeiro cataloga vagas; depois vincula conteúdos. */
const LIMITE_CATALOGO_POR_REQUISICAO = 9000;
const LIMITE_MAPEAMENTO_POR_REQUISICAO = 9000;
const MAXIMO_CARGOS_NO_MAPEAMENTO = 80;
const LIMITE_CONTEXTO_FALLBACK_CATALOGO = 22000;
const MAXIMO_CONTEXTOS_AUDITORIA_CATALOGO = 12;
const LIMITE_CONTEXTO_ADJACENTE = 2200;

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


const ESQUEMA_CATALOGO_VAGAS_BLOCO = {
  type: "object",
  additionalProperties: false,
  properties: {
    vagas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chave_documental: { type: "string" },
          codigo: { type: "string" },
          nome: { type: "string" },
          especialidade: { type: "string" },
          nivel: { type: "string" },
          requisitos: { type: "string" },
          vagas: { type: ["integer", "null"], minimum: 0 },
          cadastro_reserva: { type: "boolean" },
          lotacao: { type: "string" },
          jornada: { type: "string" },
          remuneracao: { type: "string" },
          aliases: { type: "array", items: { type: "string" } }
        },
        required: [
          "chave_documental", "codigo", "nome", "especialidade", "nivel",
          "requisitos", "vagas", "cadastro_reserva", "lotacao", "jornada",
          "remuneracao", "aliases"
        ]
      }
    }
  },
  required: ["vagas"]
};

const ESQUEMA_MAPEAMENTO_CONTEUDO_BLOCO = {
  type: "object",
  additionalProperties: false,
  properties: {
    aplicacoes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          chave_cargo: { type: "string" },
          disciplinas: { type: "array", items: ESQUEMA_DISCIPLINA },
          evidencias: { type: "array", items: { type: "string" } }
        },
        required: ["chave_cargo", "disciplinas", "evidencias"]
      }
    }
  },
  required: ["aplicacoes"]
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
          versao: "multicargos-2.3.0-auditoria-integral",
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
            maximo_blocos_legado: MAXIMO_BLOCOS_LEGADO,
            concorrencia: CONCORRENCIA_IA,
            maximo_tentativas_ia: MAXIMO_TENTATIVAS_IA,
            modelo_fallback: MODELO_FALLBACK
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
        url.pathname === "/api/ai/catalogar-vagas-bloco" &&
        request.method === "POST"
      ) {
        return catalogarVagasBlocoEndpoint(request, env);
      }

      if (
        url.pathname === "/api/ai/consolidar-catalogo" &&
        request.method === "POST"
      ) {
        return consolidarCatalogoEndpoint(request, env);
      }

      if (
        url.pathname === "/api/ai/mapear-conteudo-bloco" &&
        request.method === "POST"
      ) {
        return mapearConteudoBlocoEndpoint(request, env);
      }

      if (
        url.pathname === "/api/ai/finalizar-vagas" &&
        request.method === "POST"
      ) {
        return finalizarVagasEndpoint(request, env);
      }

      if (
        url.pathname === "/api/ai/extrair-metadados" &&
        request.method === "POST"
      ) {
        return analisarMetadadosEtapa(request, env);
      }

      if (
        url.pathname === "/api/ai/analisar-bloco" &&
        request.method === "POST"
      ) {
        return analisarBlocoEtapa(request, env);
      }

      if (
        url.pathname === "/api/ai/finalizar-analise" &&
        request.method === "POST"
      ) {
        return finalizarAnaliseEtapa(request);
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



async function catalogarVagasBlocoEndpoint(request, env) {
  try {
    validarBindingAI(env);
    const body = await lerJsonRequest(request);
    const bloco = limparTextoEdital(textoSeguro(body.bloco || body.texto))
      .slice(0, LIMITE_CATALOGO_POR_REQUISICAO);
    const contextoAnterior = limparTextoEdital(textoSeguro(body.contexto_anterior))
      .slice(-LIMITE_CONTEXTO_ADJACENTE);
    const contextoSeguinte = limparTextoEdital(textoSeguro(body.contexto_seguinte))
      .slice(0, LIMITE_CONTEXTO_ADJACENTE);
    const indice = Math.max(0, Number(body.indice) || 0);
    const total = Math.max(1, Number(body.total) || 1);

    if (bloco.length < 80) {
      return json({ ok: true, resultado: { vagas: [] } });
    }

    const prompt = `
Você executa a PRIMEIRA PASSAGEM de leitura de um edital: catalogação de vagas/cargos.

Bloco ${indice + 1} de ${total}.

Extraia SOMENTE registros de cargo, área, especialidade ou vaga realmente identificáveis neste bloco.
Não extraia disciplinas, conteúdos programáticos ou tópicos de estudo nesta etapa.

REGRAS CRÍTICAS:
- "Conhecimentos Gerais", "Conhecimentos Específicos", "Prova Objetiva" e títulos de capítulos NÃO são cargos.
- Requisito de escolaridade, diploma, certificado ou registro profissional deve ir em "requisitos", jamais em "nome".
- Preserve código, nome, área/especialidade, nível, vagas, cadastro de reserva, lotação, jornada e remuneração quando existirem.
- "chave_documental" deve ser a identificação mais estável encontrada no próprio edital: prefira código do cargo; sem código, use nome + especialidade.
- Em "aliases", inclua formas abreviadas ou alternativas explicitamente usadas no bloco.
- Não invente dados. Use string vazia ou null quando ausente.
- Não omita cargo que apareça em quadro de vagas, sumário, requisitos, cronograma de provas ou cabeçalho de conteúdo programático.
- Se uma tabela estiver linearizada, reconstrua código, cargo, especialidade, requisito e vagas pelo contexto.
- Se não houver vaga/cargo identificável, retorne vagas vazio.

CONTEXTO ANTERIOR:
${contextoAnterior || "[ausente]"}

BLOCO CENTRAL:
${bloco}

CONTEXTO SEGUINTE:
${contextoSeguinte || "[ausente]"}
`;

    const resultado = await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_CATALOGO_VAGAS_BLOCO,
      `catalogo_vagas_${indice + 1}`,
      2200
    );

    return json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro ao catalogar vagas:", error);
    return json({ ok: false, erro: normalizarErroWorkersAI(error) }, 500);
  }
}

async function consolidarCatalogoEndpoint(request, env) {
  try {
    const body = await lerJsonRequest(request);

    const resultados = Array.isArray(body.resultados_catalogo)
      ? body.resultados_catalogo
      : [];

    const vagasBrutas = resultados.flatMap(item => {
      const fonte = item?.resultado && typeof item.resultado === "object"
        ? item.resultado
        : item;

      return Array.isArray(fonte?.vagas)
        ? fonte.vagas
        : [];
    });

    let vagas = consolidarCatalogoVagas(vagasBrutas);

    /*
     * Auditoria global obrigatória: procura cargos omitidos mesmo quando a
     * leitura por blocos já encontrou alguns registros.
     */
    const contextosRecebidos = Array.isArray(body.contextos_catalogo)
      ? body.contextos_catalogo
      : [body.contexto_catalogo || body.contexto || body.texto];

    const contextos = contextosRecebidos
      .map(contexto => limparTextoEdital(textoSeguro(contexto)))
      .filter(contexto => contexto.length >= 100)
      .slice(0, MAXIMO_CONTEXTOS_AUDITORIA_CATALOGO);

    const metadados = body.metadados && typeof body.metadados === "object"
      ? body.metadados
      : {};

    const pistas = body.pistas && typeof body.pistas === "object"
      ? body.pistas
      : {};

    for (let indiceAuditoria = 0; indiceAuditoria < contextos.length; indiceAuditoria += 1) {
      const contexto = contextos[indiceAuditoria]
        .slice(0, LIMITE_CONTEXTO_FALLBACK_CATALOGO);

      const prompt = `
Você fará uma AUDITORIA GLOBAL do catálogo de cargos de um edital.

Auditoria ${indiceAuditoria + 1} de ${contextos.length}.

CATÁLOGO PARCIAL JÁ ENCONTRADO:
${JSON.stringify(vagas.map(vaga => ({
  chave_cargo: vaga.chave_cargo,
  codigo: vaga.codigo,
  nome: vaga.nome,
  especialidade: vaga.especialidade
})))}

OBJETIVO:
- Confirmar os cargos já encontrados.
- Acrescentar TODOS os cargos, áreas e especialidades legítimos que estiverem ausentes.
- Reconstruir tabelas linearizadas sem transformar requisitos, atribuições, matérias ou etapas administrativas em cargos.

REGRAS:
- Não limite a resposta ao catálogo parcial.
- Preserve "Técnico Judiciário" quando constar como cargo, mesmo sem código.
- "Conhecimentos Gerais", "Conhecimentos Específicos", "Direito", "Atribuições", "Inscrição", "Heteroidentificação" e similares não são cargos.
- Diploma, certificado e escolaridade são requisitos.
- Use código, nome e especialidade como identificadores separados.
- Não invente dados; use string vazia ou null quando ausentes.

METADADOS:
${JSON.stringify(metadados)}

PISTAS DA TELA (apenas pistas):
${JSON.stringify(pistas)}

CONTEXTO:
${contexto}
`;

      const auditado = await executarJsonSchema(
        env,
        prompt,
        ESQUEMA_CATALOGO_VAGAS_BLOCO,
        `auditoria_catalogo_${indiceAuditoria + 1}`,
        3000
      );

      const novasVagas = Array.isArray(auditado?.vagas)
        ? auditado.vagas
        : [];

      vagas = consolidarCatalogoVagas([
        ...vagas,
        ...novasVagas
      ]);
    }

    if (!vagas.length) {
      validarBindingAI(env);

      const contexto = limparTextoEdital(
        textoSeguro(
          body.contexto_catalogo ||
          body.contexto ||
          body.texto
        )
      ).slice(0, LIMITE_CONTEXTO_FALLBACK_CATALOGO);

      const metadados = body.metadados && typeof body.metadados === "object"
        ? body.metadados
        : {};

      const pistas = body.pistas && typeof body.pistas === "object"
        ? body.pistas
        : {};

      if (contexto.length >= 100) {
        const prompt = `
Você fará uma leitura global de recuperação de cargos de um edital cuja
estrutura de tabelas pode ter sido perdida na extração do PDF.

OBJETIVO EXCLUSIVO:
- Identificar cargos, áreas, especialidades e códigos existentes no edital.
- Separar rigorosamente nome do cargo de requisito de escolaridade.
- Não extrair disciplinas ou conteúdo programático nesta etapa.

REGRAS:
- Procure expressões como cargo, carreira, área, especialidade, código,
  vagas, cadastro de reserva, requisitos, remuneração e jornada.
- Um texto como certificado, diploma, ensino médio, curso superior ou
  registro profissional é requisito; nunca é nome de cargo.
- Títulos como Conhecimentos Gerais, Conhecimentos Específicos, Prova
  Objetiva e Conteúdo Programático não são cargos.
- Quando o mesmo cargo aparecer em vários trechos, retorne um único registro.
- Preserve o código e a especialidade quando existirem.
- Se o edital usar apenas um cargo principal, esse cargo também deve ser
  retornado, mesmo que não apareça em formato de tabela.
- Não invente. Use string vazia ou null para campos ausentes.

METADADOS JÁ EXTRAÍDOS:
${JSON.stringify(metadados)}

PISTAS DO CONCURSO ATIVO:
${JSON.stringify(pistas)}

TRECHOS RELEVANTES DO EDITAL:
${contexto}
`;

        const recuperado = await executarJsonSchema(
          env,
          prompt,
          ESQUEMA_CATALOGO_VAGAS_BLOCO,
          "catalogo_vagas_fallback_global",
          2600
        );

        vagas = consolidarCatalogoVagas(
          Array.isArray(recuperado?.vagas)
            ? recuperado.vagas
            : []
        );
      }
    }

    if (!vagas.length) {
      return json(
        {
          ok: false,
          erro:
            "Nenhuma vaga ou cargo foi identificado. O PDF pode ter perdido " +
            "a estrutura da tabela durante a extração. Verifique se o texto " +
            "do cargo aparece ao selecionar e copiar uma página do documento."
        },
        422
      );
    }

    return json({
      ok: true,
      resultado: {
        vagas,
        auditoria: {
          contextos_processados: contextos.length,
          candidatos_iniciais: vagasBrutas.length,
          cargos_consolidados: vagas.length
        }
      }
    });
  } catch (error) {
    console.error("Erro ao consolidar catálogo:", error);

    return json(
      {
        ok: false,
        erro: normalizarErroWorkersAI(error)
      },
      500
    );
  }
}

async function mapearConteudoBlocoEndpoint(request, env) {
  try {
    validarBindingAI(env);
    const body = await lerJsonRequest(request);
    const bloco = limparTextoEdital(textoSeguro(body.bloco || body.texto))
      .slice(0, LIMITE_MAPEAMENTO_POR_REQUISICAO);
    const indice = Math.max(0, Number(body.indice) || 0);
    const total = Math.max(1, Number(body.total) || 1);
    const catalogo = Array.isArray(body.catalogo) ? body.catalogo : [];

    if (!catalogo.length) {
      return json({ ok: false, erro: "Catálogo de cargos ausente." }, 400);
    }
    if (catalogo.length > MAXIMO_CARGOS_NO_MAPEAMENTO) {
      return json({ ok: false, erro: `O catálogo excede ${MAXIMO_CARGOS_NO_MAPEAMENTO} cargos por análise.` }, 400);
    }
    if (bloco.length < 80) {
      return json({ ok: true, resultado: { aplicacoes: [] } });
    }

    const catalogoCompacto = catalogo.map(vaga => ({
      chave_cargo: textoSeguro(vaga.chave_cargo),
      codigo: textoSeguro(vaga.codigo),
      nome: textoSeguro(vaga.nome),
      especialidade: textoSeguro(vaga.especialidade),
      aliases: Array.isArray(vaga.aliases) ? vaga.aliases.slice(0, 8) : []
    }));

    const prompt = `
Você executa a SEGUNDA PASSAGEM de leitura de um edital: vinculação de conteúdo programático aos cargos já catalogados.

Bloco ${indice + 1} de ${total}.

CATÁLOGO OFICIAL DE CARGOS DESTA ANÁLISE:
${JSON.stringify(catalogoCompacto)}

OBJETIVO:
1. Localizar neste bloco conteúdos de prova, conhecimentos, disciplinas, programas, tópicos e subtópicos.
2. Determinar a quais cargos do catálogo cada conteúdo se aplica.
3. Retornar uma aplicação separada para cada "chave_cargo" afetada.

REGRAS CRÍTICAS:
- Use SOMENTE chaves existentes no catálogo. Nunca crie cargo novo nesta etapa.
- Cargo, função, especialidade, atribuição, requisito, etapa do concurso, procedimento administrativo e política de cotas NÃO são disciplinas.
- Diploma, certificado, escolaridade, experiência, registro profissional, idade, CNH, jornada, salário e requisitos de investidura NÃO são disciplinas nem tópicos de estudo.
- Pagamento de inscrição, DAE, boleto, inscrição, isenção, recurso, heteroidentificação, identificação étnica, pertencimento etnoterritorial, reconhecimento indígena, reserva de vagas, documentação e convocação NÃO são conteúdo programático.
- Ignore capítulos de requisitos, atribuições, remuneração, inscrição, reserva de vagas, cotas, documentação, cronograma e procedimentos, salvo quando houver um anexo explicitamente intitulado CONTEÚDO PROGRAMÁTICO.
- "Conhecimentos Gerais" e "Conhecimentos Específicos" são apenas GRUPOS. Nunca os retorne como disciplina ou tópico.
- O nome de um cargo, por exemplo "Técnico Judiciário", nunca pode ser disciplina nem tópico.
- Nomes genéricos isolados como "Direito", "Atribuições", "Cargo" e "Prova" não são disciplinas válidas. Prefira a denominação completa, como "Direito Constitucional" ou "Noções de Direito Administrativo".
- Um conteúdo comum só deve ser replicado para todos os cargos quando o texto disser claramente "todos os cargos", "todos os candidatos" ou indicar grupo/códigos abrangidos.
- Conteúdo específico deve ser vinculado apenas ao cargo, código, área ou especialidade explicitamente indicado.
- Preserve a literalidade dos nomes das disciplinas e dos tópicos.
- O status inicial de todo tópico é "pendente".
- Peso mínimo 1. Quantidade de questões null quando ausente.
- Em "evidencias", registre pequenos trechos ou títulos do bloco que sustentem o vínculo. Não invente.
- Use o contexto anterior e seguinte para recuperar cabeçalhos de cargo/grupo cortados entre páginas.
- Hierarquia obrigatória: cargo > grupo > disciplina > tópico.
- Se não houver conteúdo programático útil, retorne aplicacoes vazio.

CONTEXTO ANTERIOR:
${contextoAnterior || "[ausente]"}

BLOCO CENTRAL:
${bloco}

CONTEXTO SEGUINTE:
${contextoSeguinte || "[ausente]"}
`;

    const resultado = await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_MAPEAMENTO_CONTEUDO_BLOCO,
      `mapeamento_conteudo_${indice + 1}`,
      3200
    );

    return json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro ao mapear conteúdo:", error);
    return json({ ok: false, erro: normalizarErroWorkersAI(error) }, 500);
  }
}

async function finalizarVagasEndpoint(request, env) {
  try {
    const body = await lerJsonRequest(request);
    const metadados = body.metadados && typeof body.metadados === "object"
      ? body.metadados
      : {};
    const catalogo = Array.isArray(body.catalogo) ? body.catalogo : [];
    const resultados = Array.isArray(body.resultados_mapeamento)
      ? body.resultados_mapeamento
      : [];

    const aplicacoes = resultados.flatMap(item => {
      const fonte = item?.resultado && typeof item.resultado === "object"
        ? item.resultado
        : item;
      return Array.isArray(fonte?.aplicacoes) ? fonte.aplicacoes : [];
    });

    const catalogoPorChave = new Map(
      catalogo
        .map(vaga => [textoSeguro(vaga?.chave_cargo), vaga])
        .filter(([chave]) => Boolean(chave))
    );

    const porChave = new Map();
    for (const aplicacao of aplicacoes) {
      const chave = textoSeguro(aplicacao?.chave_cargo);
      const vagaCatalogada = catalogoPorChave.get(chave);

      /* Ignora qualquer chave criada ou alterada pela IA. */
      if (!chave || !vagaCatalogada) continue;

      const disciplinas = consolidarDisciplinasSeguras(
        aplicacao.disciplinas,
        vagaCatalogada
      );

      const evidencias = Array.isArray(aplicacao.evidencias)
        ? aplicacao.evidencias
            .map(textoSeguro)
            .filter(evidencia => evidencia && !ehTextoAdministrativo(evidencia))
        : [];

      if (!disciplinas.length) continue;

      if (!porChave.has(chave)) {
        porChave.set(chave, { disciplinas: [], evidencias: [] });
      }

      const atual = porChave.get(chave);
      atual.disciplinas = consolidarDisciplinasSeguras(
        [...atual.disciplinas, ...disciplinas],
        vagaCatalogada
      );
      atual.evidencias = Array.from(
        new Set([...atual.evidencias, ...evidencias])
      ).slice(0, 20);
    }

    const cargos = catalogo.map(vaga => {
      const chave = textoSeguro(vaga.chave_cargo);
      const mapeado = porChave.get(chave) || { disciplinas: [], evidencias: [] };
      return {
        codigo: textoSeguro(vaga.codigo),
        nome: textoSeguro(vaga.nome),
        especialidade: textoSeguro(vaga.especialidade),
        nivel: textoSeguro(vaga.nivel),
        requisitos: textoSeguro(vaga.requisitos),
        vagas: normalizarInteiroOuNull(vaga.vagas),
        cadastro_reserva: Boolean(vaga.cadastro_reserva),
        lotacao: textoSeguro(vaga.lotacao),
        jornada: textoSeguro(vaga.jornada),
        remuneracao: textoSeguro(vaga.remuneracao),
        evidencias_conteudo: mapeado.evidencias,
        disciplinas: mapeado.disciplinas
      };
    }).filter(cargo => cargo.nome);

    if (!cargos.length) {
      return json({ ok: false, erro: "Nenhum cargo válido permaneceu após a consolidação." }, 422);
    }

    const cargosComConteudo = cargos.filter(cargo => cargo.disciplinas.length);
    if (!cargosComConteudo.length) {
      return json({
        ok: false,
        erro: "Os cargos foram encontrados, mas nenhum conteúdo programático foi vinculado. Verifique se o anexo de conteúdos foi extraído integralmente."
      }, 422);
    }

    const concursoBruto = metadados.concurso && typeof metadados.concurso === "object"
      ? metadados.concurso
      : {};

    const resultado = {
      concurso: {
        nome: textoSeguro(concursoBruto.nome) || "Concurso importado por IA",
        orgao: textoSeguro(concursoBruto.orgao),
        banca: textoSeguro(concursoBruto.banca),
        numero_edital: textoSeguro(concursoBruto.numero_edital || concursoBruto.numero),
        data_prova: normalizarData(concursoBruto.data_prova || concursoBruto.prova)
      },
      cargos,
      diagnostico: {
        cargos_catalogados: cargos.length,
        cargos_com_conteudo: cargosComConteudo.length,
        cargos_sem_conteudo: cargos
          .filter(cargo => !cargo.disciplinas.length)
          .map(cargo => montarNomeCargo(cargo))
      },
      estrategia: textoSeguro(metadados.estrategia) || criarEstrategiaMulticargos(cargos)
    };

    return json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro ao finalizar vagas:", error);
    return json({ ok: false, erro: obterMensagemErro(error) }, 500);
  }
}

function consolidarCatalogoVagas(
  vagasBrutas
) {
  const mapa = new Map();
  const indicePorNome = new Map();
  const indicePorCodigo = new Map();

  for (
    const vagaBruta of
    vagasBrutas || []
  ) {
    if (
      !vagaBruta ||
      typeof vagaBruta !== "object"
    ) {
      continue;
    }

    const codigo =
      textoSeguro(
        vagaBruta.codigo
      );

    const nome =
      textoSeguro(
        vagaBruta.nome
      );

    const especialidade =
      textoSeguro(
        vagaBruta.especialidade
      );

    if (
      !nome &&
      !especialidade
    ) {
      continue;
    }

    const codigoNormalizado =
      normalizarChave(
        codigo
      );

    const nomeNormalizado =
      normalizarChave(
        `${nome}|${especialidade}`
      );

    const chavePorCodigo =
      codigoNormalizado
        ? `codigo:${codigoNormalizado}`
        : "";

    const chavePorNome =
      nomeNormalizado
        ? `cargo:${nomeNormalizado}`
        : "";

    let chaveBase =
      (
        chavePorCodigo &&
        indicePorCodigo.get(
          codigoNormalizado
        )
      ) ||
      (
        chavePorNome &&
        indicePorNome.get(
          nomeNormalizado
        )
      ) ||
      chavePorCodigo ||
      chavePorNome;

    if (!chaveBase) {
      continue;
    }

    const atual = {
      chave_cargo:
        chaveBase,

      chave_documental:
        textoSeguro(
          vagaBruta.chave_documental
        ),

      codigo,

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
          vagaBruta.nivel
        ),

      requisitos:
        textoSeguro(
          vagaBruta.requisitos
        ),

      vagas:
        normalizarInteiroOuNull(
          vagaBruta.vagas
        ),

      cadastro_reserva:
        Boolean(
          vagaBruta.cadastro_reserva
        ),

      lotacao:
        textoSeguro(
          vagaBruta.lotacao
        ),

      jornada:
        textoSeguro(
          vagaBruta.jornada
        ),

      remuneracao:
        textoSeguro(
          vagaBruta.remuneracao
        ),

      aliases:
        Array.isArray(
          vagaBruta.aliases
        )
          ? vagaBruta.aliases
              .map(
                textoSeguro
              )
              .filter(Boolean)
          : []
    };

    if (!mapa.has(chaveBase)) {
      mapa.set(
        chaveBase,
        atual
      );
    } else {
      const existente =
        mapa.get(
          chaveBase
        );

      for (
        const campo of [
          "chave_documental",
          "codigo",
          "nome",
          "especialidade",
          "nivel",
          "requisitos",
          "lotacao",
          "jornada",
          "remuneracao"
        ]
      ) {
        if (
          !existente[campo] &&
          atual[campo]
        ) {
          existente[campo] =
            atual[campo];
        }
      }

      existente.vagas =
        existente.vagas ??
        atual.vagas;

      existente.cadastro_reserva =
        existente.cadastro_reserva ||
        atual.cadastro_reserva;

      existente.aliases =
        Array.from(
          new Set([
            ...existente.aliases,
            ...atual.aliases
          ])
        ).slice(
          0,
          12
        );
    }

    const consolidado =
      mapa.get(
        chaveBase
      );

    consolidado.chave_cargo =
      chaveBase;

    if (codigoNormalizado) {
      indicePorCodigo.set(
        codigoNormalizado,
        chaveBase
      );
    }

    if (nomeNormalizado) {
      indicePorNome.set(
        nomeNormalizado,
        chaveBase
      );
    }
  }

  return Array.from(
    mapa.values()
  ).sort(
    (a, b) =>
      `${a.nome} ${a.especialidade}`
        .localeCompare(
          `${b.nome} ${b.especialidade}`,
          "pt-BR"
        )
  );
}

function consolidarDisciplinasSeguras(
  disciplinasBrutas,
  cargo = {}
) {
  const filtradas = (disciplinasBrutas || [])
    .map(disciplina => sanitizarDisciplina(disciplina, cargo))
    .filter(Boolean);

  return consolidarDisciplinas(filtradas);
}

function sanitizarDisciplina(disciplina, cargo = {}) {
  if (!disciplina || typeof disciplina !== "object") {
    return null;
  }

  const nome = textoSeguro(disciplina.nome);

  if (!ehNomeDisciplinaValido(nome, cargo)) {
    return null;
  }

  const topicos = (Array.isArray(disciplina.topicos)
    ? disciplina.topicos
    : [])
    .map(topico => {
      const nomeTopico = textoSeguro(
        typeof topico === "string" ? topico : topico?.nome
      );

      if (!ehTopicoProgramaticoValido(nomeTopico, nome, cargo)) {
        return null;
      }

      return {
        nome: nomeTopico,
        status:
          topico?.status === "concluido"
            ? "concluido"
            : "pendente"
      };
    })
    .filter(Boolean);

  if (!topicos.length) {
    return null;
  }

  return {
    ...disciplina,
    nome,
    grupo: normalizarGrupoDisciplina(disciplina.grupo),
    prioridade: normalizarPrioridade(disciplina.prioridade),
    peso: normalizarPeso(disciplina.peso),
    quantidade_questoes: normalizarInteiroOuNull(
      disciplina.quantidade_questoes ?? disciplina.numero_questoes
    ),
    topicos
  };
}

function normalizarGrupoDisciplina(valor) {
  const grupo = textoSeguro(valor);
  const chave = normalizarChave(grupo);

  if (chave.includes("conhecimentos gerais")) {
    return "Conhecimentos Gerais";
  }

  if (chave.includes("conhecimentos especificos")) {
    return "Conhecimentos Específicos";
  }

  return grupo || "Conteúdo programático";
}

function ehNomeDisciplinaValido(nome, cargo = {}) {
  const chave = normalizarChave(nome);

  if (!chave || nome.length > 160) {
    return false;
  }

  if (
    ehRotuloDeGrupo(nome) ||
    ehTextoAdministrativo(nome) ||
    ehTextoDeRequisito(nome) ||
    ehNomeGenericoInvalido(nome) ||
    coincideComCargo(nome, cargo)
  ) {
    return false;
  }

  return true;
}

function ehTopicoProgramaticoValido(
  nomeTopico,
  nomeDisciplina,
  cargo = {}
) {
  if (!nomeTopico || nomeTopico.length > 500) {
    return false;
  }

  if (
    ehRotuloDeGrupo(nomeTopico) ||
    ehTextoAdministrativo(nomeTopico) ||
    ehTextoDeRequisito(nomeTopico) ||
    coincideComCargo(nomeTopico, cargo)
  ) {
    return false;
  }

  const chaveTopico = normalizarChave(nomeTopico);
  const chaveDisciplina = normalizarChave(nomeDisciplina);

  /* Evita que o próprio nome da disciplina seja salvo como tópico. */
  if (
    chaveTopico === chaveDisciplina ||
    chaveTopico === "conteudo programatico"
  ) {
    return false;
  }

  return true;
}

function ehRotuloDeGrupo(valor) {
  const texto = normalizarChave(valor);

  return /^(conhecimentos gerais|conhecimentos especificos|conteudo programatico|programa de provas|prova objetiva|provas objetivas|disciplinas|materias|cargo|cargos)$/.test(
    texto
  );
}

function ehNomeGenericoInvalido(valor) {
  const texto = normalizarChave(valor);

  return /^(direito|atribuicoes|atribuicao|tecnico judiciario|analista judiciario|oficial de justica|funcao|funcoes|etapa|etapas|prova|avaliacao|concurso)$/.test(
    texto
  );
}

function coincideComCargo(valor, cargo = {}) {
  const texto = normalizarChave(valor);

  if (!texto) return false;

  const referencias = [
    cargo.nome,
    cargo.especialidade,
    cargo.codigo,
    ...(Array.isArray(cargo.aliases) ? cargo.aliases : [])
  ]
    .map(normalizarChave)
    .filter(Boolean);

  return referencias.some(referencia =>
    texto === referencia ||
    (referencia.length >= 8 && texto.includes(referencia))
  );
}

function ehTextoAdministrativo(valor) {
  const texto = normalizarChave(valor);

  return /(?:^|\b)(?:procedimento de inscricao|pagamento da inscricao|taxa de inscricao|gerenciamento do documento de arrecadacao|documento de arrecadacao estadual|dae|boleto|isencao da taxa|pedido de isencao|inscricao preliminar|inscricao definitiva|confirmacao de inscricao|recurso administrativo|interposicao de recurso|heteroidentificacao|identificacao etnica|pertencimento etnoterritorial|reconhecimento do povo indigena|reserva de vagas|cotas raciais|cotas para negros|cotas para indigenas|pessoa com deficiencia|documentacao comprobatória|documentacao comprobatoria|envio de documentos|convocacao|nomeacao|posse|exercicio|cronograma|calendario|local de prova|cartao de confirmacao|resultado preliminar|resultado final|atribuicoes do cargo|descricao das atribuicoes|remuneracao|jornada de trabalho)(?:\b|$)/.test(
    texto
  );
}

function ehTextoDeRequisito(valor) {
  const texto = normalizarChave(valor);

  return /requisit|investidura|certificado|diploma|curso superior|ensino medio|registro profissional|conselho regional|experiencia minima|carteira nacional|\bcnh\b|idade minima|aptidao fisica|escolaridade minima|formacao academica/.test(
    texto
  );
}

async function analisarMetadadosEtapa(request, env) {
  try {
    validarBindingAI(env);
    const body = await lerJsonRequest(request);
    const texto = limparTextoEdital(
      textoSeguro(body.texto || body.texto_edital || body.conteudo)
    ).slice(0, 14000);

    if (texto.length < 100) {
      return json({ ok: false, erro: "Texto insuficiente para extrair metadados." }, 400);
    }

    const resultado = await extrairMetadados(env, {
      texto,
      nomeArquivo: textoSeguro(body.nome_arquivo || body.nomeArquivo),
      tipoArquivo: textoSeguro(body.tipo_arquivo || body.tipoArquivo)
    });

    return json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro na etapa de metadados:", error);
    return json({ ok: false, erro: normalizarErroWorkersAI(error) }, 500);
  }
}

async function analisarBlocoEtapa(request, env) {
  try {
    validarBindingAI(env);
    const body = await lerJsonRequest(request);
    const bloco = limparTextoEdital(textoSeguro(body.bloco || body.texto));
    const indice = Math.max(0, Number(body.indice) || 0);
    const total = Math.max(1, Number(body.total) || 1);

    if (bloco.length < 80) {
      return json({ ok: true, resultado: { cargos: [] }, aviso: "Bloco sem texto suficiente." });
    }

    const resultado = await analisarBlocoDeCargos(env, {
      bloco: bloco.slice(0, TAMANHO_BLOCO),
      indice,
      total
    });

    return json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro na etapa de bloco:", error);
    return json({ ok: false, erro: normalizarErroWorkersAI(error) }, 500);
  }
}

async function finalizarAnaliseEtapa(request) {
  try {
    const body = await lerJsonRequest(request);
    const metadados = body.metadados && typeof body.metadados === "object"
      ? body.metadados
      : {};
    const resultados = Array.isArray(body.resultados_blocos)
      ? body.resultados_blocos
      : [];

    const cargosBrutos = resultados.flatMap(item =>
      Array.isArray(item?.cargos) ? item.cargos : []
    );
    const cargos = consolidarCargos(cargosBrutos);

    if (!cargos.length) {
      return json({
        ok: false,
        erro: "Nenhum cargo com disciplinas e tópicos válidos foi identificado nos blocos."
      }, 422);
    }

    const resultado = normalizarEditalMulticargos({
      concurso: metadados.concurso || {},
      cargos,
      estrategia:
        textoSeguro(metadados.estrategia) ||
        criarEstrategiaMulticargos(cargos)
    });

    return json({ ok: true, resultado });
  } catch (error) {
    console.error("Erro ao finalizar análise:", error);
    return json({ ok: false, erro: obterMensagemErro(error) }, 500);
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

    const normalizado =
      normalizarEditalMulticargos(resultado);

    const hash =
      await gerarHashTexto(textoUtil);

    return json({
      ok: true,
      resultado: normalizado,
      resposta: normalizado,
      analise: normalizado,
      arquivo: {
        nome: nomeArquivo || null,
        tipo: tipoArquivo || null,
        caracteres_recebidos:
          textoOriginal.length,
        caracteres_analisados:
          textoUtil.length,
        texto_cortado:
          textoLimpo.length >
          LIMITE_TEXTO_TOTAL,
        hash
      },
      processamento: {
        modo,
        blocos: blocosUsados,
        duracao_ms:
          Date.now() - inicio
      },
      modelo: MODELO_EXTRACAO
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
          normalizarErroWorkersAI(error),
        modelo: MODELO_EXTRACAO,
        duracao_ms:
          Date.now() - inicio
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

  const resposta =
    await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_EDITAL_MULTICARGOS,
      "edital_multicargos",
      4200
    );

  return resposta;
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
  const trechoInicial =
    textoCompleto.slice(0, 14000);

  const promessaMetadados =
    extrairMetadados(
      env,
      {
        texto: trechoInicial,
        nomeArquivo,
        tipoArquivo
      }
    );

  const tarefas = blocos.map(
    (bloco, indice) =>
      async () => {
        try {
          return await analisarBlocoDeCargos(
            env,
            {
              bloco,
              indice,
              total: blocos.length
            }
          );
        } catch (error) {
          console.warn(
            `O bloco ${indice + 1} de ${blocos.length} ` +
            "não pôde ser analisado:",
            obterMensagemErro(error)
          );

          /*
           * Um bloco defeituoso não encerra os demais.
           */
          return {
            cargos: [],
            erro_bloco:
              normalizarErroWorkersAI(
                error
              )
          };
        }
      }
  );

  const promessaBlocos =
    executarEmLotes(
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

  const cargosBrutos =
    resultadosBlocos.flatMap(
      item =>
        Array.isArray(item?.cargos)
          ? item.cargos
          : []
    );

  const cargos =
    consolidarCargos(cargosBrutos);

  if (!cargos.length) {
    throw new Error(
      "A IA não conseguiu identificar cargos com disciplinas válidas."
    );
  }

  return {
    concurso:
      metadados.concurso || {},
    cargos,
    estrategia:
      textoSeguro(
        metadados.estrategia
      ) ||
      criarEstrategiaMulticargos(
        cargos
      )
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

  const resposta =
    await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_METADADOS,
      "metadados_concurso",
      1200
    );

  return resposta;
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

  const resposta =
    await executarJsonSchema(
      env,
      prompt,
      ESQUEMA_BLOCO_CARGOS,
      `bloco_cargos_${indice + 1}`,
      3200
    );

  return {
    cargos:
      Array.isArray(
        resposta?.cargos
      )
        ? resposta.cargos
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

  const modelos = [
    MODELO_EXTRACAO,
    MODELO_FALLBACK
  ];

  let ultimoErro = null;

  for (
    let tentativa = 1;
    tentativa <= MAXIMO_TENTATIVAS_IA;
    tentativa += 1
  ) {
    const modelo =
      modelos[
        Math.min(
          tentativa - 1,
          modelos.length - 1
        )
      ];

    try {
      const resultado =
        await executarChamadaIa(
          env,
          {
            modelo,
            prompt,
            schema,
            nomeSchema,
            maxTokens
          }
        );

      /*
       * Valida a resposta ainda dentro da tentativa.
       * JSON vazio ou interrompido também ativa a repetição.
       */
      const interpretado =
        interpretarRespostaDaIa(
          resultado
        );

      return interpretado;
    } catch (error) {
      ultimoErro = error;

      const mensagem =
        obterMensagemErro(error);

      console.warn(
        `Falha na IA. Tentativa ${tentativa} de ` +
        `${MAXIMO_TENTATIVAS_IA}. Modelo: ${modelo}.`,
        mensagem
      );

      if (
        tentativa <
        MAXIMO_TENTATIVAS_IA
      ) {
        await esperar(
          ESPERA_REPETICAO_MS *
          tentativa
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

async function executarChamadaIa(
  env,
  {
    modelo,
    prompt,
    schema,
    nomeSchema,
    maxTokens
  }
) {
  const configuracaoBase = {
    messages: [
      {
        role: "system",
        content:
          "Retorne somente JSON válido conforme o schema. " +
          "Não use markdown, comentários ou texto fora do JSON. " +
          "Se o trecho não possuir dados úteis, retorne arrays vazios."
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

  /*
   * O GLM usa max_completion_tokens.
   * O Llama da Workers AI é mais estável com max_tokens.
   */
  if (modelo.includes("glm")) {
    return env.AI.run(
      modelo,
      {
        ...configuracaoBase,
        max_completion_tokens:
          maxTokens,
        reasoning_effort: "low"
      }
    );
  }

  return env.AI.run(
    modelo,
    {
      ...configuracaoBase,
      max_tokens: maxTokens
    }
  );
}

function normalizarErroWorkersAI(
  error
) {
  const mensagem =
    obterMensagemErro(error);

  const mensagemLower =
    mensagem.toLowerCase();

  if (
    mensagemLower.includes(
      "content-length header"
    ) ||
    mensagemLower.includes(
      "exceeds body"
    )
  ) {
    return (
      "A resposta da IA foi interrompida pela infraestrutura da Cloudflare. " +
      "O sistema realizou novas tentativas, mas não recebeu uma resposta completa. " +
      "Tente novamente; se persistir, envie um edital menor ou em formato TXT."
    );
  }

  if (
    mensagemLower.includes(
      "timeout"
    ) ||
    mensagemLower.includes(
      "timed out"
    )
  ) {
    return (
      "A análise ultrapassou o tempo disponível da Cloudflare. " +
      "O documento pode ser extenso demais para uma única execução."
    );
  }

  if (
    mensagemLower.includes(
      "rate limit"
    ) ||
    mensagemLower.includes(
      "too many requests"
    ) ||
    mensagemLower.includes("429")
  ) {
    return (
      "O limite momentâneo da IA da Cloudflare foi atingido. " +
      "Aguarde alguns instantes e tente novamente."
    );
  }

  if (
    mensagemLower.includes("json") ||
    mensagemLower.includes("parse")
  ) {
    return (
      "A IA respondeu, mas o JSON veio incompleto ou inválido. " +
      "O sistema tentou novamente sem conseguir concluir a estrutura."
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
  return new Promise(resolve => {
    setTimeout(
      resolve,
      milissegundos
    );
  });
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
      const objeto =
        extrairJson(candidato);

      if (objeto) {
        return objeto;
      }
    }
  }

  throw new Error(
    "A IA respondeu, mas não foi possível interpretar o JSON."
  );
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

function extrairJson(texto) {
  const bruto =
    String(texto || "").trim();

  if (!bruto) {
    return null;
  }

  try {
    return JSON.parse(bruto);
  } catch (_) {}

  const semMarkdown = bruto
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
    .trim();

  try {
    return JSON.parse(
      semMarkdown
    );
  } catch (_) {}

  const inicio =
    semMarkdown.indexOf("{");

  const fim =
    semMarkdown.lastIndexOf("}");

  if (
    inicio >= 0 &&
    fim > inicio
  ) {
    try {
      return JSON.parse(
        semMarkdown.slice(
          inicio,
          fim + 1
        )
      );
    } catch (_) {}
  }

  return null;
}

function normalizarEditalMulticargos(
  resultado
) {
  const concursoBruto =
    resultado?.concurso &&
    typeof resultado.concurso ===
      "object"
      ? resultado.concurso
      : {};

  let cargosBrutos =
    Array.isArray(
      resultado?.cargos
    )
      ? resultado.cargos
      : [];

  /*
   * Compatibilidade com respostas antigas que possuíam apenas
   * concurso.cargo e disciplinas na raiz.
   */
  if (
    !cargosBrutos.length &&
    Array.isArray(
      resultado?.disciplinas
    )
  ) {
    cargosBrutos = [
      {
        codigo: "",
        nome:
          textoSeguro(
            concursoBruto.cargo
          ) ||
          "Cargo não identificado",
        especialidade: "",
        nivel: "",
        requisitos: "",
        vagas: null,
        disciplinas:
          resultado.disciplinas
      }
    ];
  }

  const cargos =
    consolidarCargos(
      cargosBrutos
    );

  if (!cargos.length) {
    throw new Error(
      "A IA não retornou cargos com disciplinas e tópicos válidos."
    );
  }

  return {
    concurso: {
      nome:
        textoSeguro(
          concursoBruto.nome
        ) ||
        "Concurso importado por IA",

      orgao:
        textoSeguro(
          concursoBruto.orgao
        ),

      banca:
        textoSeguro(
          concursoBruto.banca
        ),

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
      textoSeguro(
        resultado?.estrategia
      ) ||
      criarEstrategiaMulticargos(
        cargos
      )
  };
}

function consolidarCargos(
  cargosBrutos
) {
  const mapa = new Map();

  for (
    const cargoBruto of
    cargosBrutos || []
  ) {
    if (
      !cargoBruto ||
      typeof cargoBruto !==
        "object"
    ) {
      continue;
    }

    const nome =
      textoSeguro(
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

    const chave =
      normalizarChave(
        `${nome}|${especialidade}`
      );

    if (!chave) {
      continue;
    }

    const disciplinas =
      consolidarDisciplinas(
        cargoBruto.disciplinas
      );

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
              normalizarChave(nome)
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

    existente.codigo =
      existente.codigo ||
      textoSeguro(
        cargoBruto.codigo
      );

    existente.nivel =
      existente.nivel ||
      textoSeguro(
        cargoBruto.nivel
      );

    existente.requisitos =
      existente.requisitos ||
      textoSeguro(
        cargoBruto.requisitos
      );

    existente.vagas =
      existente.vagas ??
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
    .from(mapa.values())
    .filter(
      cargo =>
        cargo.disciplinas.length
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

    const nome =
      textoSeguro(
        typeof disciplinaBruta ===
          "string"
          ? disciplinaBruta
          : disciplinaBruta.nome
      );

    if (!nome) {
      continue;
    }

    const chave =
      normalizarChave(nome);

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

    const disciplina = {
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
            .quantidade_questoes ||
          disciplinaBruta
            .numero_questoes
        ),

      topicos
    };

    if (!mapa.has(chave)) {
      mapa.set(
        chave,
        disciplina
      );
      continue;
    }

    const existente =
      mapa.get(chave);

    existente.grupo =
      existente.grupo !==
      "Conteúdo programático"
        ? existente.grupo
        : disciplina.grupo;

    existente.prioridade =
      maiorPrioridade(
        existente.prioridade,
        disciplina.prioridade
      );

    existente.peso =
      Math.max(
        existente.peso,
        disciplina.peso
      );

    existente.quantidade_questoes =
      existente
        .quantidade_questoes ??
      disciplina
        .quantidade_questoes;

    existente.topicos =
      normalizarTopicos([
        ...existente.topicos,
        ...disciplina.topicos
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
    const nome =
      textoSeguro(
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

async function salvarEdital(
  request,
  env
) {
  try {
    validarSupabase(env);

    const body =
      await lerJsonRequest(
        request
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
      resultado &&
      typeof resultado ===
        "object" &&
      !Array.isArray(resultado)
        ? resultado
        : {
            resultado
          };

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
        retorno.topicos_salvos ??
        contarTopicos(
          dados.disciplinas
        ),

      resultado:
        retorno
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
          obterMensagemErro(error)
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

  /*
   * O frontend multicargos deve enviar o cargo já selecionado
   * no formato antigo: concurso + disciplinas.
   */
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
            fonte.concurso.prova
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

  /*
   * Segurança adicional: aceita o edital multicargos somente
   * quando houver exatamente um cargo.
   */
  if (
    Array.isArray(
      fonte.cargos
    )
  ) {
    const edital =
      normalizarEditalMulticargos(
        fonte
      );

    if (
      edital.cargos.length !== 1
    ) {
      throw new Error(
        "Selecione um cargo antes de salvar o edital."
      );
    }

    const cargo =
      edital.cargos[0];

    return {
      concurso: {
        nome:
          edital.concurso.nome,

        orgao:
          edital.concurso.orgao,

        cargo:
          montarNomeCargo(cargo),

        banca:
          edital.concurso.banca,

        data_prova:
          edital.concurso
            .data_prova
      },

      disciplinas:
        cargo.disciplinas,

      estrategia:
        edital.estrategia
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
      blocos.push(bloco);
    }

    if (fim >= texto.length) {
      break;
    }

    inicio =
      Math.max(
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
  const resultados =
    new Array(
      tarefas.length
    );

  let proximo = 0;

  async function executar() {
    while (true) {
      const indice =
        proximo;

      proximo += 1;

      if (
        indice >=
        tarefas.length
      ) {
        return;
      }

      resultados[indice] =
        await tarefas[indice]();
    }
  }

  const quantidade =
    Math.min(
      concorrencia,
      tarefas.length
    );

  await Promise.all(
    Array.from(
      {
        length: quantidade
      },
      () => executar()
    )
  );

  return resultados;
}

function limparTextoEdital(
  texto
) {
  return String(texto || "")
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

function criarEstrategiaMulticargos(
  cargos
) {
  const totalCargos =
    cargos.length;

  return (
    `Foram identificados ${totalCargos} cargo(s). ` +
    "Selecione o cargo desejado antes de gerar a grade. " +
    "Priorize disciplinas específicas e de maior peso, " +
    "intercalando teoria, questões e revisões periódicas."
  );
}

function criarEstrategiaDisciplinas(
  disciplinas
) {
  return (
    "Estude por ciclos, priorizando as disciplinas de maior peso, " +
    "resolva questões após cada bloco teórico e programe revisões " +
    "de curto, médio e longo prazo."
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

function normalizarPeso(
  valor
) {
  const numero =
    Number(valor);

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

  if (
    !Number.isFinite(numero)
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round(numero)
  );
}

function normalizarData(
  valor
) {
  const texto =
    textoSeguro(valor);

  if (!texto) {
    return "";
  }

  const iso =
    texto.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (iso) {
    return texto;
  }

  const brasileira =
    texto.match(
      /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/
    );

  if (brasileira) {
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

    const ano =
      brasileira[3];

    return (
      `${ano}-${mes}-${dia}`
    );
  }

  return "";
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

function textoSeguro(
  valor
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  return String(valor)
    .trim();
}

async function gerarHashTexto(
  texto
) {
  const bytes =
    new TextEncoder()
      .encode(texto);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      bytes
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(
            2,
            "0"
          )
    )
    .join("");
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
