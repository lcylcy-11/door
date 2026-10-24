---
name: "문 좀 살살 — 문틈"
description: "한 문을 조작하는 2D 1인칭 공포 프로토타입의 현재 구현"
colors:
  ink: "#ded8c7"
  muted: "#a5afa7"
  night: "#101512"
  paper: "#d7cbb1"
  wood: "#30251c"
  alarm: "#e2ad8a"
  line: "#3c443c"
typography:
  display:
    fontFamily: 'Batang, "Songti SC", serif'
    fontSize: "clamp(27px, 3.3vw, 49px)"
    fontWeight: 400
    letterSpacing: "-.03em"
  body:
    fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
    fontSize: "14px"
  label:
    fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
    fontSize: "11px"
rounded:
  square: "0"
  handle-ring: "13px"
spacing:
  page-desktop: "30px"
  page-tablet: "16px"
  page-mobile: "12px"
  paper-desktop: "30px 29px 24px"
  paper-mobile: "23px"
components:
  primary-button:
    backgroundColor: "#263228"
    textColor: "#eee7d4"
    rounded: "{rounded.square}"
    padding: "15px 17px"
  primary-button-hover:
    backgroundColor: "#3a4936"
  paper-note:
    backgroundColor: "{colors.paper}"
    textColor: "#302b22"
    rounded: "{rounded.square}"
    padding: "{spacing.paper-desktop}"
---

# Design System: 문 좀 살살 — 문틈

## Overview

현재 구현된 한 장면짜리 프로토타입의 기록이다. 사용자가 승인한 범위는 2D 1인칭으로 문 하나를 조작하고 노크와 문틈의 손에 대처하는 시안이다. 아래 시각 값은 구현 상태이며, 전체 게임의 최종 미감에 대한 사용자 승인을 뜻하지 않는다.

어두운 원룸과 중문이 화면 대부분을 차지하고 종이 안내문과 가장자리의 조작 UI가 보조한다. 생성된 래스터 배경·문·손 위에 기하학적인 인터랙션 레이어가 놓인다. 실제 3D 장면이나 자유 카메라는 없다.

## Colors

페이지 바탕은 `night`, 본문은 `ink`, 보조 문장은 `muted`, 시작 안내문은 `paper`다. 이미지에는 차가운 복도와 따뜻한 침실 조명이 대비된다. 실제 PNG 출처와 정확한 생성 프롬프트는 `docs/horror-assets.json`에 기록하고 파일에도 내장했다. `wood`, `alarm`은 선언된 기준색이며 현재 장면 표현은 주로 이미지·문구·명도에 의존한다.

## Typography

제목과 워드마크는 Batang 계열 명조, 본문은 맑은 고딕 계열이다. 본문은 12–14px, 위치와 힌트는 11px이다. 600px 이하 제목은 32px, 결말 제목은 29px이다. 파일 끝 CSS가 앞선 모바일 선언을 덮어쓰므로 최종 cascade를 기준으로 읽는다.

## Layout

기본 장면은 1600 × 900 좌표계다. 중문 개구부는 `(700,80,488,695)`, 문 이동량은 열림 비율당 왼쪽 440 단위다. 901px 이상에서는 장면과 자막이 작은 창 안에 함께 보이도록 가용 높이로 너비를 제한한다.

상단은 제목·목표·제어, 하단은 신호 위치·자막·행동 지시다. 900px 이하에서는 목표가 다음 줄로 이동한다. 600px 이하에서는 장면이 4:5, 배경/SVG가 너비 222.222%, 왼쪽 -81%로 바뀐다. `game.js`의 geometry 함수는 같은 배율과 이동을 써서 손잡이 위치와 드래그 거리를 계산한다. 크롭 변경 시 두 곳을 함께 갱신한다.

## Elevation & Depth

원룸 이미지와 문 레이어, 가장자리 명암이 깊이를 만든다. 종이는 `6px 12px 35px #08070465`, 고리는 `0 3px 10px #06090560` 그림자를 쓴다. 위험은 장면의 손, 자막, 중립적인 어두운 그림자로 표시한다.

## Shapes

장면·종이·버튼은 직사각형이다. 손잡이 고리는 27 × 49px, 반경 13px다. 실제 조작 영역은 기본 너비 6%, 높이 22%, 최소 40 × 52px이고 600px 이하 최소 너비 44px, 높이 25%다.

## Components

- 시작 안내문: 밝은 종이 바탕, 기본 너비 `min(350px,39%)`, 데스크톱 회전 -1.2도. 600px 이하에서는 중앙 최대 315px와 여백 23px, 회전 -.5도. 모션 감소 설정이면 회전하지 않는다.
- 주요 버튼: 각진 짙은 녹색 버튼, 최소 높이 48px, 600px 이하 44px. 호버는 더 밝은 녹색, 키보드 포커스는 2px 밝은 테두리다.
- 상단 제어: 소리·일시정지·재시작. 좁은 화면에서 최종 글자 11px, 최소 높이 40px.
- 문손잡이: 드래그 중 grabbing 커서. 힌트는 열기·멈추기·닫기·손 놓기를 현재 상태에 맞춰 바꾼다. 화살표 키 대체 입력도 있다.
- 상태: 노크 때 배경 명도를 낮추고 바닥에 노크 글자와 선을 표시한다. 손이 나오면 틈의 손 이미지와 즉시 닫기 지시를 표시한다. 일시정지와 결말은 장면 내부 오버레이다.

## Do's and Don'ts

- 신호는 소리, 장면과 자막에 함께 반영한다.
- 문틈의 손을 막는 급한 닫기를 노크 위반으로 계산하지 않는다.
- 좁은 화면의 크롭과 입력 좌표를 함께 유지한다.
- 이 시안의 수치와 표현을 전체 게임의 확정된 미감·밸런스로 확대하지 않는다.
