/**
 * 펀치카드 저장소 — Cloudflare Worker
 *
 * 설정 두 가지가 필요합니다(README.md 참고):
 *   - KV 네임스페이스를 만들어 변수 이름 PUNCHCARD 로 바인딩
 *   - 환경변수(Secret) TEAM_KEY 에 팀 공용 암호
 *   - 환경변수 ALLOW_ORIGIN 에 GitHub Pages 주소 (예: https://내계정.github.io)
 *
 * 하는 일은 두 가지뿐입니다. 팀 기록 JSON 을 읽어주고, 받아서 저장합니다.
 * 저장할 때 판 번호를 비교해, 누가 먼저 저장했으면 덮어쓰지 않고 알려줍니다.
 */

const SLOT = "state";

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json;charset=utf-8" },
      });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "POST 만 받습니다" }, 405);

    let req;
    try {
      req = await request.json();
    } catch {
      return json({ error: "본문이 JSON 이 아닙니다" }, 400);
    }

    // 팀 공용 암호 확인. 주소를 알아도 암호가 없으면 읽지도 쓰지도 못합니다.
    if (!env.TEAM_KEY || req.key !== env.TEAM_KEY) {
      return json({ error: "팀 암호가 맞지 않습니다" }, 403);
    }

    const stored = await env.PUNCHCARD.get(SLOT, { type: "json" });
    const current = stored || { version: 0, state: null };

    if (req.op === "load") {
      return json({ version: current.version, state: current.state });
    }

    if (req.op === "save") {
      // 내가 받아간 판 번호가 최신이 아니면, 남의 저장을 덮어쓰지 않고 현재 것을 돌려줍니다.
      if (typeof req.version === "number" && req.version !== current.version) {
        return json({ conflict: true, version: current.version, state: current.state });
      }
      if (!req.state || typeof req.state !== "object") {
        return json({ error: "state 가 없습니다" }, 400);
      }
      const next = { version: current.version + 1, state: req.state };
      await env.PUNCHCARD.put(SLOT, JSON.stringify(next));
      return json({ ok: true, version: next.version });
    }

    return json({ error: "op 은 load 또는 save 여야 합니다" }, 400);
  },
};
