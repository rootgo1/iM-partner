# 프론트엔드 글꼴 사용 기록

## 현재 UI 글꼴: Noto Sans KR

- iM뱅크 공식 홈페이지 CSS 확인 경로: `https://www.imbank.co.kr/cms/css/common/ebz_base.css`
- 공식 홈페이지 사용 계열: `noto-r`, `noto-m`, `noto-b`, `Malgun Gothic`
- 로컬 파일 출처: iM뱅크 홈페이지의 `/cms/cmshtml/fonts/noto-sans-*.woff2`
- 라이선스: SIL Open Font License 1.1 (`NOTO_SANS_KR_OFL.txt`)
- 내려받은 날짜: 2026-09-04

`NotoSansKR-Light.woff2`, `NotoSansKR-Regular.woff2`, `NotoSansKR-Medium.woff2`, `NotoSansKR-Bold.woff2`를 `noto-sans-kr.css`에서 불러옵니다. 현재 메인 화면 전체에는 공식 홈페이지와 같은 고딕 계열의 이 글꼴을 사용합니다.

## 보관 글꼴: iM혜민체

- 출처: `https://www.imbank.co.kr/cms/imhyemin/`
- 폰트 배포본: `https://www.imbank.co.kr/cms/imhyemin/download/IM_HYEMIN.zip`
- 공식 라이선스: `https://www.imbank.co.kr/cms/imhyemin/download/IM_HYEMIN_LICENSE.pdf`
- 내려받은 날짜: 2026-09-04

`IM_Hyemin-Regular.ttf`, `IM_Hyemin-Bold.ttf`, `IM_HYEMIN_LICENSE.pdf`는 공식 배포 원본이며 수정하지 않습니다.

공식 라이선스에서 허용하지 않는 CI/BI 용도인 회사명·브랜드명·상품명·로고·마크·슬로건·캐치프레이즈에는 사용하지 않습니다. 사용자 검토 결과 공식 홈페이지 UI와 형태 차이가 커서 현재 메인 화면에는 적용하지 않고 원본만 보관합니다.

Noto Sans KR 로컬 파일이 로드되지 않을 때는 설치된 Noto Sans KR, 맑은 고딕, Arial 순서로 대체합니다.
