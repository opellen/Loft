> [English](README.md) · **한국어**

# Loft — 이미지를 Google Drive에 업로드하고 로컬 임베드를 링크로 대체

> 노트에 이미지를 붙여넣거나 드래그하면 Loft가 본인의 Google Drive에 업로드하고, 렌더링되는 마크다운 이미지 링크를 삽입합니다 — vault를 가볍게 유지하면서.

---

## 왜 Loft인가

- **Vault가 가벼워집니다.** 이미지는 vault가 아니라 본인의 Google Drive에 저장되므로 동기화와 백업이 빠르고 가볍게 유지됩니다.
- **데스크톱과 모바일 모두 지원.** 로그인과 업로드는 옵시디언의 `requestUrl()`과 OAuth 2.0 Device Flow를 사용하여 양쪽 모두에서 동작합니다.
- **최소 권한 `drive.file` 스코프.** Loft는 자신이 만든 파일만 볼 수 있어 나머지 Drive에는 접근하지 않으며, Google 검증(verification)도 필요 없습니다.
- **견고한 링크 처리.** 임베드 URL 포맷은 설정 뒤로 추상화되어 있고, 재해결 명령으로 이미지를 다시 업로드하지 않고도 모든 링크를 복구하거나 포맷을 전환할 수 있습니다.

---

## 주요 기능

- **붙여넣기/드래그 업로드.** 이미지를 노트에 붙여넣거나 드래그하면 본인의 Google Drive로 자동 업로드되고, 커서 위치에 렌더링되는 마크다운 이미지 링크가 삽입됩니다.
- **기존 로컬 이미지 변환.** "Convert local images to Drive links" 명령(에디터 우클릭 메뉴에도 있음)으로 현재 노트에 이미 들어 있는 로컬 이미지를, 또는 선택 영역 안의 이미지만 변환합니다.
- **플러그인 소유 대상 폴더.** 폴더 경로(예: `Attachments/Images`, 하위 폴더는 `/` 사용)를 지정하면 플러그인이 그 폴더를 생성하고 소유합니다. 선택적으로 Parent folder ID를 지정하면 기존 Drive 폴더 아래에 경로를 만듭니다.
- **Google으로 로그인.** OAuth 2.0 Device Flow는 데스크톱과 모바일에서 동작합니다 — `google.com/device`에 짧은 코드를 입력하면 연결됩니다.
- **전환 가능한 임베드 URL 포맷.** `lh3`, `thumbnail`, `apiMedia`(`alt=media`) 중 선택할 수 있습니다. "Re-resolve Drive image links" 명령(현재 노트 또는 vault 전체)이 기존 링크를 선택한 포맷으로 다시 쓰거나, Google이 URL 포맷을 바꿔도 재업로드 없이 복구합니다.
- **중복 업로드 방지.** 동일한 이미지 내용은 콘텐츠 해시로 추적되어 한 번만 업로드됩니다.
- **자동 재시도(backoff).** 요청 한도(HTTP 429) 응답은 지수 백오프로 재시도됩니다.
- **안전한 파일명과 폴백.** 업로드 파일명에는 타임스탬프 접두사가 붙습니다. 업로드가 실패하면 로컬 이미지가 무손실로 보존되며, 선택 설정 "Delete local file after converting"은 업로드 성공 후에만 원본을 휴지통으로 보냅니다.

---

## 요구 사항 / 설정

Loft는 **본인의 Google Drive**에 업로드하므로, 사용자마다 Google Cloud OAuth 클라이언트를 한 번 발급받아야 합니다(약 10분, 무료, 신용카드 불필요). 이후 **Client ID**와 **Client secret**을 Loft 설정에 붙여넣습니다.

요약:

1. [Google Cloud Console](https://console.cloud.google.com)에서 **프로젝트를 생성**합니다.
2. 해당 프로젝트에서 **Google Drive API를 활성화**합니다.
3. **OAuth 동의 화면을 구성**합니다(User type: External, `.../auth/drive.file` 스코프 추가, 본인을 test user로 추가하거나 앱을 게시).
4. **"TVs and Limited Input devices"** 타입의 **OAuth 클라이언트 ID를 생성**하고 Client ID + Client secret을 복사합니다.
5. (선택) 기존 폴더 아래에 업로드를 중첩하려면 Drive 폴더 URL에서 **대상 폴더 ID**를 확보합니다.

단계별 가이드: [docs/reference/google-cloud-setup.ko.md](docs/reference/google-cloud-setup.ko.md).

---

## 설치

### 옵시디언 커뮤니티 플러그인

1. **설정 → 커뮤니티 플러그인 → 탐색(Browse)**
2. "Loft" 검색 → **설치(Install)** → **활성화(Enable)**

### 수동 설치

1. [Releases](https://github.com/opellen/Loft/releases) 페이지에서 최신 릴리스를 다운로드합니다.
2. `main.js`, `manifest.json`, `styles.css`를 vault의 `.obsidian/plugins/loft/` 폴더에 복사합니다.
3. **설정 → 커뮤니티 플러그인**에서 **Loft**를 활성화합니다.

---

## 사용법

1. **로그인.** **설정 → Loft → Account**에서 **Sign in**을 클릭하거나 **"Sign in to Google Drive"** 명령을 실행합니다. 표시된 코드를 `google.com/device`에 입력해 권한을 부여합니다.
2. **대상 폴더 설정.** **Destination folder path**(예: `Attachments/Images`)를 입력하고 **Create / connect folder**를 클릭합니다. 필요하면 **Parent folder ID**를 지정해 기존 Drive 폴더 아래에 중첩합니다.
3. **이미지 추가.** 이미지를 노트에 붙여넣거나 드래그하면 자동 업로드되고, **"Convert local images to Drive links"**를 실행하면 노트에 이미 있는 이미지(또는 선택 영역 안의 이미지)를 변환합니다. 같은 변환 동작은 에디터 **우클릭 메뉴**에서도 사용할 수 있습니다.
4. 임베드 URL 포맷을 바꾼 뒤에는 **"Re-resolve Drive image links"**(현재 노트) 또는 **"Re-resolve Drive image links in vault"**(vault 전체)로 언제든 링크를 전환하거나 복구할 수 있습니다.

---

## 개인정보 및 보안

- 이미지는 **본인의** Google Drive에 업로드되며 **"anyone with the link"(링크가 있는 모든 사용자)**로 공유됩니다 — 노트 안에서 이미지가 바로 렌더링되려면 필요한 설정입니다. 링크나 파일 ID를 가진 사람은 누구나 이미지를 볼 수 있으므로 **민감한 이미지에는 Loft를 사용하지 마세요.**
- OAuth 토큰은 vault 안 플러그인의 `data.json`에 저장됩니다. 아직 OS 키체인으로 암호화되지 **않으므로** vault를 자격 증명 저장소처럼 취급하세요.
- Loft는 `drive.file` 스코프 덕분에 자신이 만든 파일에만 접근하며, 나머지 Drive는 볼 수 없습니다.

---

## 호환성

- Obsidian 1.6.6 이상.
- **데스크톱과 모바일** (`isDesktopOnly: false`).
- 모바일 참고:
  - 드래그 앤 드롭은 모바일에서 동작하지 않습니다 — **붙여넣기** 또는 **변환 명령**을 사용하세요.
  - 잠긴 모바일 브라우저에서는 device 코드 **복사 버튼**이 동작하지 않을 수 있지만, 코드 자체는 선택 가능하므로 수동으로 복사할 수 있습니다.

---

## 크레딧 / 라이선스

[MIT License](LICENSE)로 배포됩니다.

[English](README.md) 문서도 제공됩니다.
