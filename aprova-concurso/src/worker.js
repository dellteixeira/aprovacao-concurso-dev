export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ping") {
      return new Response(JSON.stringify({
        ok: true,
        rota: "/api/ping",
        mensagem: "Worker DEV respondendo corretamente.",
        path: url.pathname
      }, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname === "/api/ai/teste") {
      try {
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

        return new Response(JSON.stringify({
          ok: true,
          rota: "/api/ai/teste",
          resposta
        }, null, 2), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store"
          }
        });

      } catch (error) {
        return new Response(JSON.stringify({
          ok: false,
          rota: "/api/ai/teste",
          erro: error.message || "Erro ao chamar Workers AI."
        }, null, 2), {
          status: 500,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store"
          }
        });
      }
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({
        ok: false,
        erro: "Rota de API não encontrada.",
        path: url.pathname
      }, null, 2), {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
