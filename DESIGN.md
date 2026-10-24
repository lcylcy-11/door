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

현재 구현된 한 장면짜리 프로토타입의 기록이다. H2는 사용자가 선택한 밀어 버티기를 반영한다. 느린 문 열기는 유지하며, 손이 문을 잡은 뒤의 단순한 급한 닫기를 힘 조절로 대체한다. 사용자가 승인한 범위는 2D 1인칭으로 문 하나를 조작하고 노크와 문틈의 손에 대처하는 시안이다. 아래 시각 값은 구현 상태이며, 전체 게임의 최종 미감에 대한 사용자 승인을 뜻하지 않는다.

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
- 문손잡이: 평상시 드래그는 문을 움직인다. 손이 문을 잡으면 오른쪽 이동은 힘을 높이고 왼쪽은 낮춘다. 포인터 위치로 문을 즉시 닫을 수 없다. 화살표 키는 같은 방향 조절, Space는 놓기다. 손이 빠진 뒤에 문을 닫는다.
- 힘 표시: 손이 있는 활성 상태에서 왼쪽 아래에 표시한다(left 4%, bottom 7%, width 250px). 600px 이하에서는 left 5%, bottom 3%, width 90%다. 어두운 녹색 패널 안에 8px 힘 막대와 현재 목표 구간을 표시한다. 밀어올 때 74–96%, 느슨할 때 16–48%는 현재 시안의 UI 값이며 최종 밸런스 결정이 아니다. 과한 삐걱거림에는 테두리 #cc9872와 막대 #c89770을 쓴다.
- 상태: TV가 끊기는 정적 뒤 불규칙한 노크가 울리고, 바닥 신호와 작은 충격이 대응한다. 손은 접근 이미지에서 문을 쥔 이미지로 바뀌며 문 가장자리에 붙어 움직인다. 손의 예고·밀기·느슨해짐에 맞춰 지시를 바꾼다. 접촉·노크·과한 압력의 흔들림은 모션 감소 설정에서 제거한다. 저항 부족, 소음 과다, 노크 위반은 서로 다른 결말 문구를 낸다. 실패 음향은 결과 화면 뒤에도 자신의 짧은 감쇠를 마친다.

## Do's and Don'ts

- 신호는 소리, 장면과 자막에 함께 반영한다.
- 손이 문을 잡은 동안은 힘 조절과 문 이동을 구분하며, 손이 빠진 뒤에 닫는다.
- 좁은 화면의 크롭과 입력 좌표를 함께 유지한다.
- 이 시안의 수치와 표현을 전체 게임의 확정된 미감·밸런스로 확대하지 않는다.
