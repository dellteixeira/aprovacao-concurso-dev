export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/ping") {
      return new Response(JSON.stringify({
        ok: true,
        mensagem: "Worker interceptou a rota /api/ping",
        path: url.pathname
      }, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({
        ok: false,
        erro: "API existe, mas rota não encontrada",
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
