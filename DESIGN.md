---
name: "문 좀 살살 — 문틈"
description: "문 열기, 한 번의 힘겨루기, 눈을 피하며 닫기로 압축한 1인칭 공포 게임"
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

## Current focus cut — 2026-10-28

The user requested discarding unfun gimmicks. The active flow is slow opening → a brief blackout → one H2 hand fight → blind closing → a one-click lock. Only the sound strip, force panel, gaze control and final lock can appear as active guidance. Slow movement never requires waiting for an outside sound; sound cover permits faster travel. Wedge/drawer, switch choice, mimic, detent/rhythm and the repeated finale are removed. Existing room art, camera hit-testing, sound captions, pause and retry remain.

All H4 descriptions below are historical design documentation, not a requirement to restore removed mechanics. Current rules are in `night.js`; focused values are in `tuning.js` under `focus`.

## Historical H4 design

## Overview

H4 구현의 기록이다. 한 장면(원룸 중문)에서 일곱 긴장 기믹과 H2의 손 힘겨루기를 장(章)별로 가르치고 겹친다. 느린 문 열기가 중심이며, 모든 수치는 사람 체감 검토 전 임시값으로 `dist/horror/tuning.js`에 모여 있다. 아래 시각 값은 구현 상태이며 최종 미감에 대한 사용자 승인을 뜻하지 않는다.

장면은 1600 × 900 세계 좌표의 SVG 두 장(정면 · 뒤쪽 방)이다. 배경판은 SVG 안에 있고, 카메라는 각 SVG의 viewBox다. 입력 판정(손잡이·걸쇠·스위치·슬리퍼)은 렌더링과 같은 viewBox 변환을 쓴다.

## Colors

페이지 바탕 `night`, 본문 `ink`, 보조 `muted`, 시작 안내문 `paper`. 장면 색은 이미지가 정한다: 따뜻한 방, 차가운 청록 복도. 방 불을 켜면 배경판(front-lit)만 교차 페이드하고 문·손·눈은 밝기만 0.85→1.0(손 0.8→1.0)으로 바뀐다. 경고는 붉은 기운의 비네트(danger), 손잡이 고리는 바깥 소리가 덮는 동안 밝은 링으로 빛난다.

## Typography

제목·결말은 Batang 계열 명조, 본문은 맑은 고딕 계열. 자막 14px(좁은 화면 12px), 위치 태그·보조 11–12px.

## Layout

카메라 창(세계 좌표):

| 보기 | 16:9 | ≤600px (4:5) |
|---|---|---|
| 정면 | 0,0,1600,900 | 583,0,720,900 |
| 시선 아래(1.55×) | 470,319,1032,581 | 752,319,464,581 |
| 걸쇠 기울기(1.5×, P0·F3, C7에서 걸쇠를 잡는 동안) | 620,300,1067,600 | 910,300,480,600 |
| 뒤쪽 방 | 0,0,1600,900 | 322,0,720,900 |

뒤돌아보기는 0.45초 어깨 너머 팬(모션 감소 설정에서는 교차 페이드)이다. 상단은 제목·목표·제어, 하단은 위치 태그·자막·지시의 세 줄 캡션이다.

## Elevation & Depth

방 이미지, 문 레이어, 비네트, 시선을 내릴 때의 눈썹 그늘(상단 22% 그라데이션), 등 뒤 서랍이 열릴 때 왼쪽 가장자리 비네트가 깊이를 만든다. 흔들림(접촉·충격·떨림)은 모션 감소 설정에서 제거한다.

## Shapes

장면·종이·버튼·HUD 패널은 직사각형. 손잡이 고리 27×49px(반경 13px), 실제 조작 영역 최소 56×110px. 걸쇠 손잡이 64×64 세계 단위(최소 44px, 좁은 화면 48px), 스위치 영역 85×115 세계 단위, 슬리퍼 190×95 세계 단위. 걸쇠 드래그 전체 행정은 max(96px, 장면 높이 20%).

## Components

- 시작 안내문: 왼쪽 버튼/오른쪽 버튼/바깥 소리 세 규칙과 '눌러서 전환' 설정.
- 손잡이: 왼쪽 버튼 드래그. 문이 자유로우면 이동, 손이 붙잡으면 힘(→ 싣기, ← 빼기). 손가락이 따라 끄는 동안 고리 옆에 「지금 ▶」.
- 걸쇠: 문 오른쪽 아래 기둥의 바닥 걸쇠. 몸판 → 봉 → 가이드 고리 순으로 그려 봉이 고리 뒤를 지난다. 잡는 동안 행정 선과 걸림쇠 표시가 보인다. 어두우면 밝기 0.45, 불을 켜면 1.0과 바닥 구멍 표시.
- 「↶ 뒤 / ↷ 문」: 장면 왼쪽(뒤쪽 방에서는 오른쪽) 가장자리 56×120px. 손잡이를 놓고, 시선을 든 상태에서만 활성. 서랍이 열리면 깜박인다.
- 「시선 ↓」: 오른쪽 아래 56px 토글(C4부터, 또는 '눌러서 전환' 모드). 시선을 내리면 「시선 아래」 배지.
- 좁은 화면 「불」: 스위치가 잘려 보이지 않으므로 왼쪽 가장자리에 같은 동작의 버튼.
- HUD는 동시에 최대 둘: 힘 패널(H2 동안) 또는 걸쇠 체크리스트+노크 박자(F3)와, 「바깥 소리」 막대(가림 L, 0.6 눈금, 기척 A ≥ 0.25일 때 두 번째 막대). '숫자 표시' 설정은 모든 계기 값을 보인다.
- 「빛이 샌다」 칩: 불이 켜진 채 문이 0.12 이상 열려 있을 때.
- 결말 카드: 원인별 제목과 한 줄 교훈, 같은 장면 두 번째 실패부터 보조 힌트. 「이 장면부터 다시」(기본 포커스)와 「처음부터」.
- 일시정지: 시간·오디오 정지, 설정(시선 전환 방식, 숫자 표시).

## Do's and Don'ts

- 모든 소리 신호에는 자막(위치 태그)과 화면 신호가 있어야 한다. 소리를 꺼도 규칙은 같다.
- 한 마우스로 서로 다른 시점 답을 동시에 요구하지 않는다(시선 내리기와 뒤돌아보기는 같은 순간에 필요하지 않다).
- 바깥 소리는 소리만 덮는다. 눈·손·서랍·손가락에는 효과가 없음을 알린다.
- 렌더링과 입력은 같은 카메라 창을 쓴다. 좁은 화면 크롭을 따로 계산하지 않는다.
- 이 시안의 수치와 표현을 확정된 미감·밸런스로 확대하지 않는다.
