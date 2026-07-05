> [English](google-cloud-setup.md) · **한국어**

# Google Cloud 설정 가이드 — Device Flow 인증용 (M2 선결 조건)

이 플러그인은 사용자 **본인의 Google Drive**에 이미지를 업로드한다. 이를 위해 사용자마다 Google Cloud에서 OAuth 클라이언트를 한 번 발급받아야 한다. 아래는 **'TVs and Limited Input devices'**(= OAuth 2.0 Device Flow) 클라이언트를 만드는 절차다.

> 소요 시간 ~10분. 무료. 신용카드 불필요.  
> 콘솔 UI는 수시로 바뀐다(최근 'APIs & Services' → 'Google Auth Platform'으로 일부 이동). 메뉴 이름이 다르면 검색창에 굵은 키워드를 입력해 찾는다.

---

## 0\. 왜 이 방식인가 (요약)

*   **Device Flow / 'Limited Input' 클라이언트**: client\_secret이 비기밀로 취급돼 오픈소스 배포에 적합하고, 데스크톱·모바일 공통으로 동작한다.
*   **스코프는** `**drive.file**`: 앱이 **직접 만든 파일에만** 접근. 사용자의 나머지 Drive는 못 본다 → 최소 권한 + Google 검증(verification) 불필요.

---

## 1\. 프로젝트 생성

1.  https://console.cloud.google.com 접속 (Google 계정 로그인).
2.  상단 파란 바 왼쪽의 **프로젝트 선택 드롭다운** 클릭 → **새 프로젝트(New Project)**.
3.  이름: 예 `obsidian-drive-images` → **만들기(Create)**.
4.  생성 후 드롭다운에서 방금 만든 프로젝트가 **선택**되어 있는지 확인.

## 2\. Drive API 활성화

1.  상단 검색창에 `**Google Drive API**` 입력 → 결과 클릭.
2.  **사용(Enable)** 버튼 클릭.
    *   이미 사용 중이면 'Manage'가 보인다 — 그대로 두면 됨.

## 3\. OAuth 동의 화면(consent screen) 구성

좌측 메뉴 **APIs & Services → OAuth consent screen** (또는 검색창에 `OAuth consent`).

1.  **User Type**: **External** 선택 → 만들기(Create).
    *   (조직 Workspace 계정이면 Internal도 가능하나, 개인 Gmail은 External.)
2.  **App information**:
    *   App name: 예 `Obsidian Drive Images`
    *   User support email: 본인 이메일 선택
    *   Developer contact information: 본인 이메일
    *   나머지(로고/도메인)는 비워도 됨 → **저장 후 계속(Save and Continue)**.
3.  **Scopes** 단계:
    *   **Add or Remove Scopes** 클릭 → 필터에 `drive.file` 입력.
    *   `.../auth/drive.file` ("See, edit, create, and delete only the specific Google Drive files you use with this app") 체크 → **Update** → **Save and Continue**.
4.  **Test users** 단계:
    *   **Add Users** → 본인 Google 이메일 추가 → **Save and Continue**.
    *   ⚠ 앱이 'Testing' 상태인 동안에는 **여기 추가된 사용자만** 로그인 가능하고, **refresh token이 7일 후 만료**된다.
5.  **Summary** → Back to Dashboard.

### (권장) 앱을 'Production'으로 게시

*   `drive.file`은 비민감 스코프라 **검증 없이** 게시 가능하고, 게시하면 refresh token 7일 만료 제한이 사라진다.
*   **OAuth consent screen** 대시보드에서 **Publish App** → 확인. ("Needs verification"이 떠도 `drive.file`만 쓰면 실사용에 지장 없음.)

## 4\. OAuth 클라이언트 ID 발급 (핵심)

좌측 **APIs & Services → Credentials** (검색창 `Credentials`).

1.  상단 **\+ Create Credentials → OAuth client ID**.
2.  **Application type** 드롭다운 → **TVs and Limited Input devices** 선택.
    *   이 항목이 안 보이면: 동의 화면(3단계)이 완료돼야 나타난다. 완료 후 다시 시도.
3.  Name: 예 `obsidian-device-client` → **Create**.
4.  팝업에 뜨는 **Client ID** 와 **Client Secret** 을 복사해 안전한 곳에 보관.
    *   Device Flow에서 이 secret은 '비기밀'로 취급되지만, 그래도 아무 데나 노출하진 말 것.
    *   나중에 다시 보려면 Credentials 목록에서 해당 클라이언트 클릭.

## 5\. 테스트용 대상 폴더 ID 확보

1.  https://drive.google.com 에서 업로드 목적지로 쓸 **폴더 하나 생성**(예: `Obsidian Images`).
2.  그 폴더를 열면 주소창이 `https://drive.google.com/drive/folders/**<이 부분이 폴더 ID>**` 형태.
3.  `folders/` 뒤의 문자열이 **폴더 ID**. 복사해 둔다.

---

## 확보해야 할 값 체크리스트 (M2에서 사용)

플러그인 설정/PoC에 넣을 값들:

*   `client_id` (4단계)
*   `client_secret` (4단계)
*   대상 폴더 ID (5단계)
*   Drive API enabled (2단계)
*   본인 계정이 test user에 추가됨 or 앱 Published (3단계)

> 이 값들은 저장소(git)에 커밋하지 말 것. 개발 중에는 로컬 `data.json`/환경변수로만 다룬다.

---

## Device Flow 동작 미리보기 (구현 시 참고)

1.  플러그인이 `POST https://oauth2.googleapis.com/device/code` (client\_id + scope) → `device_code`, `user_code`, `verification_url`, `interval` 수신.
2.  사용자에게 "`google.com/device` 에서 코드 `XXXX-XXXX` 입력" 안내.
3.  플러그인이 `POST https://oauth2.googleapis.com/token` (grant\_type=`urn:ietf:params:oauth:grant-type:device_code`, device\_code, client\_id, client\_secret)을 `interval`마다 폴링 → 승인되면 `access_token` + `refresh_token` 수신.
4.  이후 `refresh_token`으로 access token 갱신, `access_token`으로 Drive `files.create` 업로드.

참고 문서: https://developers.google.com/identity/protocols/oauth2/limited-input-device
