/**
 * 펀치카드 저장소 — Google Apps Script 판
 * Cloudflare 대신 구글 계정만으로 쓰고 싶을 때 이쪽을 쓰세요. 카드 등록이 필요 없습니다.
 *
 * 1) script.google.com 에서 새 프로젝트를 만들고 이 코드를 붙여넣습니다.
 * 2) 아래 TEAM_KEY 를 팀에서 정한 암호로 바꿉니다.
 * 3) 배포 > 새 배포 > 유형 "웹 앱"
 *      - 실행 계정: 나
 *      - 액세스 권한: 모든 사용자
 *    배포하면 나오는 /exec 주소를 index.html 의 CONFIG.apiUrl 에 넣습니다.
 *
 * 기록은 스크립트 속성에 JSON 한 덩어리로 저장됩니다(수백 KB 까지 여유).
 * 여러 명이 동시에 저장해도 어긋나지 않도록 잠금을 걸고, 판 번호로 충돌을 잡습니다.
 */

var TEAM_KEY = "여기에-팀-암호를-적으세요";
var PROP_STATE = "punchcard.state";
var PROP_VERSION = "punchcard.version";

function doPost(e) {
  var out = handle(e);
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function handle(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return { error: "본문이 JSON 이 아닙니다" };
  }

  if (req.key !== TEAM_KEY) return { error: "팀 암호가 맞지 않습니다" };

  var props = PropertiesService.getScriptProperties();

  if (req.op === "load") {
    return {
      version: Number(props.getProperty(PROP_VERSION) || 0),
      state: JSON.parse(props.getProperty(PROP_STATE) || "null")
    };
  }

  if (req.op === "save") {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);                     // 동시에 저장해도 한 명씩 차례로
    try {
      var version = Number(props.getProperty(PROP_VERSION) || 0);
      // 내가 받아간 판이 최신이 아니면 남의 저장을 덮지 않고 현재 것을 돌려줍니다.
      if (typeof req.version === "number" && req.version !== version) {
        return {
          conflict: true,
          version: version,
          state: JSON.parse(props.getProperty(PROP_STATE) || "null")
        };
      }
      if (!req.state) return { error: "state 가 없습니다" };
      props.setProperty(PROP_STATE, JSON.stringify(req.state));
      props.setProperty(PROP_VERSION, String(version + 1));
      return { ok: true, version: version + 1 };
    } finally {
      lock.releaseLock();
    }
  }

  return { error: "op 은 load 또는 save 여야 합니다" };
}
