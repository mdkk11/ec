# `$ship` 開発オーケストレーションSkill追加計画

## 1. 背景と目的

改善済みの`ship` Skillは現在`~/.codex/skills/ship`へインストールされているが、このdirectoryはGit管理されていない。そのため、再現可能なsource、変更履歴、レビュー可能な差分が`ec`リポジトリに残らない。

本変更では、改善済みSkillをrepository-localな`.agents/skills/ship`へ追加する。依存Skillの事前確認、既存PRからのphase復元、明示checkpointからの再開、stale remoteとmerge済みPRの照合、同一PR head/baseに対する最終監査の一回性を、Git管理されたSkillとして利用可能にする。

本計画の承認後に実装を開始する。計画作成時点ではSkill本体を追加しない。

## 2. 現状調査

- `origin/main`にはrepository-local Skillとして`.agents/skills/explained-code-review`が存在する。
- `.agents/skills/ship`は存在しない。
- インストール済み`ship` Skillは次の6ファイル、合計597行で構成される。
  - `SKILL.md`
  - `agents/openai.yaml`
  - `evals/evals.json`
  - `references/pr-review-protocol.md`
  - `references/runtime-preflight.md`
  - `references/workflow.md`
- Skillは`grill-with-docs`、`grilling`、`domain-modeling`、`babysit-pr`、`gh-stack`を必須依存として宣言し、不足時はrepository調査や代替実行へ進まず停止する。
- 3件のdry-run評価では、改善版が11/11 assertion、改善前snapshotが9/11 assertionを満たした。評価workspaceと生成viewerは`~/.codex/skills/ship-workspace`にあり、Skill配布物には含まれない。
- ECアプリケーションの機能、API、DB、UI、テストscenarioには変更を加えない。

## 3. 解決する問題

- Skill sourceが個人のインストール先にしかなく、PRで内容を確認・共有できない。
- repository cloneから同じSkill定義を復元できない。
- 今回追加したphase recovery、checkpoint、remote/PR reconciliation、final audit順序の改善にGit上の変更履歴が残らない。

## 4. 採用する方針

- インストール済み`~/.codex/skills/ship`の6ファイルを、内容を変えず`.agents/skills/ship`へ追加する。
- Skill本体、Codex表示metadata、参照文書、再開・remote・checkpointを扱う3件のeval定義を同じPRへ含める。
- repository-local版とインストール済み版を`diff -ru`で比較し、追加時点で一致することを確認する。
- frontmatterと`agents/openai.yaml`をYAML parser、`evals/evals.json`をJSON parserで検証する。
- `SKILL.md`から参照する3文書がrepository-local directory内に存在することを確認する。
- 計画とSkill追加を目的別の2コミットに分け、単一のDraft PRとして`main`へ提出する。

## 5. 採用しない方針

- 必須依存SkillをこのPRへ複製しない。`ship`自身のpreflightが現在のsessionとインストール先を確認し、不足時に導入許可を求めて停止する責務を維持する。
- `ship-workspace`、改善前snapshot、grader出力、benchmark、生成viewerをcommitしない。これらは開発時の一時評価成果物でありruntime配布物ではない。
- Skill用のpackage、build script、install script、独自validatorを追加しない。今回のSkillはMarkdown、YAML、JSONだけで実行できる。
- `README.md`、ECアプリケーション、package scripts、CI、設計文書、テストscenarioを変更しない。Skillの呼び出し方と停止条件は`SKILL.md`と参照文書に含まれている。
- global版とrepository-local版を自動同期する仕組みを追加しない。同期の必要性が実際に発生するまでは、PR差分と`diff -ru`で十分である。

## 6. 変更対象

- `docs/plans/add-ship-skill.md`
  - 本変更のscope、検証、非対象を記録する。
- `.agents/skills/ship/SKILL.md`
  - `$ship TASK`のtrigger、責務境界、安全規則、状態記録、完了条件を追加する。
- `.agents/skills/ship/agents/openai.yaml`
  - Codex上の表示名、説明、既定promptを追加する。
- `.agents/skills/ship/references/runtime-preflight.md`
  - 必須依存確認、remote refresh、PR/stack照合、repository規約調査を追加する。
- `.agents/skills/ship/references/workflow.md`
  - phase state machine、checkpoint、resume evidence、stabilization、最終監査、readiness gateを追加する。
- `.agents/skills/ship/references/pr-review-protocol.md`
  - Reviewer Guideと`[SHIP:*]`会話prefixの契約を追加する。
- `.agents/skills/ship/evals/evals.json`
  - Draft PR再開、stale remote、Draft checkpointの3評価caseを追加する。

## 7. 実装手順

1. 承認後、worktreeが計画書以外に変更されておらず、branchが`feature/add-ship-skill`、baseが最新`origin/main`であることを確認する。
2. `.agents/skills/ship`へインストール済みSkillの6ファイルを同一path構成・同一内容で追加する。
3. repository-local版と`~/.codex/skills/ship`を`diff -ru`で比較し、評価workspaceを除く全配布物が一致することを確認する。
4. YAML frontmatter、agent metadata、eval JSON、Markdown参照pathを検証する。
5. 絶対path、token、評価workspace、改善前snapshot、生成viewerが追加差分へ混入していないことを`rg`と`git diff`で確認する。
6. `git diff --check`を実行し、Skill追加がroot applicationやpackage設定を変更していないことを確認する。
7. 計画だけを`docs: $ship Skillの追加計画を作成`、Skillの6ファイルだけを`feat: $ship 開発オーケストレーションSkillを追加`としてcommitする。
8. branchを`origin`へpushし、変更内容、目的、検証結果、依存Skill不足時の停止動作を記載したDraft PRを`main`向けに作成する。

## 8. テスト・検証方法

- source一致
  - `diff -ru ~/.codex/skills/ship .agents/skills/ship`
  - 出力がなく、6ファイルの内容とpathが一致することを確認する。
- 構文検証
  - Ruby標準YAML parserで`SKILL.md` frontmatterと`agents/openai.yaml`を読み込む。
  - `python3 -m json.tool .agents/skills/ship/evals/evals.json`を実行する。
- 参照・安全確認
  - `SKILL.md`が参照する`references/*.md`がすべて存在することを確認する。
  - `rg`で`/Users/`、`.codex/skills/ship-workspace`、tokenらしい文字列が追加ファイルに含まれないことを確認する。
- 差分確認
  - `git diff --check`
  - `git diff --stat`
  - `git diff --name-only`
- `pnpm lint`、`pnpm typecheck`、アプリケーションtest、buildは実行しない。rootのTypeScript、package、アプリケーション、test、build入力を変更せず、Markdown、YAML、JSONだけを追加するためである。

## 9. リスク

- repository-local版とglobal版が将来別々に更新される可能性がある。追加時点の完全一致を確認し、以後の変更はrepository-local sourceをPRでレビューしてからglobalへ反映する運用で扱う。
- clone先に必須依存Skillがない場合、`$ship`を最後まで実行できない。これはpreflightが全不足Skillを報告し、導入許可を求めて停止する設計であり、暗黙の代替実行より安全である。
- 個人環境の絶対pathや評価成果物が混入すると移植性が失われる。配布対象を6ファイルに限定し、`rg`と差分一覧で確認する。
- repository-local Skillとglobal Skillの優先順位はCodex環境に依存する。両者の内容を追加時点で同一にし、どちらが選ばれても挙動が変わらない状態にする。

## 10. 未確定事項

なし。

## 11. 完了条件

- `.agents/skills/ship`に6ファイルが追加され、インストール済み改善版と一致する。
- `$ship TASK`のtrigger、必須依存不足時の停止、phase recovery、checkpoint、remote/PR照合、stabilization後の最終監査、human-review readinessが文書化されている。
- 3件のeval定義が有効なJSONとして含まれる。
- YAML、JSON、Markdown参照、絶対path混入、whitespaceを検証済みである。
- Skill開発workspace、snapshot、benchmark、viewer、追加dependency、application変更がPRに含まれない。
- 計画とSkill本体が目的別の2コミットになっている。
- `feature/add-ship-skill`がpushされ、`main`向けDraft PRが作成されている。
