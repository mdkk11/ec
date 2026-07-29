# Explained Code Review Skill v2 改訂実装計画

## Summary

- planと現在のworkspaceを、人間が理解・承認するTweet型レビュー画面へ変換する汎用Skillとして再構築する。
- 既定対象はbaseのmerge-baseから現在workspaceまで。コミット済み・staged・unstaged・未追跡を含め、selected planと`.review/**`は除外する。
- runtimeをNode.js 20＋Gitだけにし、TypeScript・tsx・Zod・移植先package.jsonへの依存を廃止する。
- project-localとglobalの同一Skillフォルダをサポートする。
- Blind保証は独立contextと入力分離による手続的隔離とし、filesystem sandboxとは表現しない。

## Workspace snapshotとGit収集

- `git diff <merge-base> --`のnet差分を正とし、commit・staged・unstagedを加算しない。
- untrackedは通常fileだけをadded hunkとして収集し、未追跡renameは推測しない。
- 収集前後のtracked patch、porcelain status、untracked manifestをSHA-256比較し、変化時は停止する。
- `.review/**`とselected planを、path、stat、hunk、Blind入力から除外する。
- fileごとに`changeSources`を記録し、reportへscope、収集時刻、workspace fingerprint、Git OID、各状態件数を残す。
- baseは`origin/HEAD`、`origin/main`、`main`、`origin/master`、`master`の順で解決し、fetchしない。
- merge-baseなし、shallow不足、unborn repositoryを明示エラーにする。detached HEADは短縮SHAを表示する。
- tracked symlink、submodule、mode-onlyはmeta hunk。untrackedの通常file以外は拒否する。
- Git引数配列、ext-diff/textconv無効化、NUL区切り、pathspec separatorを使う。
- 25 MiB、単一text file 5 MiB、250,000 diff行、20,000 hunkを上限とし、truncateせず停止する。

## Planと二段階レビュー

- `--plan`を優先し、branch対応または変更中の`plans/**/*.md`が一意なら自動採用する。`--no-plan`で探索を止める。
- planはrepository内の通常fileに限定し、symlink escapeを拒否する。
- selected planがruleと同じpathならBlind入力への混入を防ぐため停止する。
- Stage 1は履歴を継承しないsubagentへplan raw contentとplan hunkを渡さず、selected planを読まないよう明示する。
- Stage 2で初めてplanを読み、要件、漏れ、不一致、未記載影響、plan自体を確認する。
- Stage 1 finding集合を完全一致で検証し、Stage 2は`planAssessment`だけを更新できる。
- reportへplan pathとassessmentは含めてよいが、plan raw contentとplan hunkは含めない。

## Runtime・Schema・安全な再生成

- scriptsを`.mjs`とし、Node標準moduleだけで通常実行する。
- `report-schema.json` v2を唯一のfinal report契約とし、Ajv standalone ESM validatorをcommitする。
- dev依存はSkill内package manifestへ隔離し、通常runtimeにAjvやnode_modulesを要求しない。
- 入力は厳密parserで未知field、不正enum、欠落fieldを拒否し、hunk網羅、finding位置、Stage 1保持、ID一意性も検証する。
- stable review IDはplan basenameまたはbranchとhash12で作る。
- `.review`のsymlinkとpath escapeを拒否し、review ID単位lock、UUID temp/backup、swap、rollback、中断回復を行う。
- 成功後は`index.html`と`report.json`以外の残骸を残さない。

## Tweet型UIと保存状態

- 上部へタイトル、差分統計、fingerprint、承認数、theme、helpを表示する。
- group一覧はtitle、summary、changeType、hunk/finding数、risk、承認状態を表示し、riskとchangeTypeでfilterできるようにする。
- 詳細へintent、implementation summary、impact、verification、承認、diff、finding、コメントを並べる。
- 承認は変更意図の確認でありfinding解決とは分離する。
- group/finding fingerprint一致時だけapproval/resolveを復元する。変更されたコメントはstale扱いにする。
- localStorage keyへstate version、repository hash、scope、review IDを含め、不正状態を除去する。
- 選択groupだけをchunk描画し、hunk折りたたみと描画cancelを行う。
- Markdownへscope、fingerprint、未承認、未解決、現行/staleコメントを含める。
- `file://`、CDN/fetchなし、textContent表示、dark mode、keyboard、focus、ARIA、Clipboard fallback、375/768/1280pxを満たす。
- 「承認は収集時snapshotに対するもの。修正後は再生成」を常時表示する。

## TestとAcceptance

- Node標準test runnerと一時Git repositoryでbase/scope/status/untracked/rename/binary/mode/特殊path/空差分、snapshot変化、除外、plan/rule競合、symlink、limitsを検証する。
- schema/standalone validator、厳密parser、Stage 1保持、hunk網羅、finding位置、atomic failpointと回復を検証する。
- stable ID、state version、fingerprint、stale commentをpure functionまたはUI testで検証する。
- Playwrightで`file://`を開き、承認、resolve、コメント、再生成、Markdown、fallback、keyboard、focus、3 viewportを確認する。
- project-local/global copyをnode_modulesなしで実行し、同じreportを生成する。
- 実際の二段階LLM reviewはmanual acceptanceとし、独立Stage 1がselected planを参照していないことを記録する。
- ECのビジネスルールやアプリケーションAPIは変更しない。
