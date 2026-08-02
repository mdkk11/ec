import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const skillDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = mkdtempSync(join(tmpdir(), 'explained-review-ui-'))
const report = {
  schemaVersion: 3,
  mode: 'review',
  review: {
    id: 'ui-review',
    repositoryHash: '1234567890abcdef',
    scope: 'workspace',
    collectedAt: '2026-07-28T00:00:00.000Z',
    workspaceFingerprint: 'a'.repeat(64),
  },
  git: {
    baseRef: 'main',
    baseOid: '1'.repeat(40),
    headOid: '2'.repeat(40),
    mergeBase: '1'.repeat(40),
    branch: 'feature/ui',
    ahead: 1,
    behind: 0,
  },
  stats: {
    files: 1,
    hunks: 1,
    additions: 2000,
    deletions: 0,
    committedFiles: 1,
    stagedFiles: 0,
    unstagedFiles: 0,
    untrackedFiles: 0,
  },
  overview: 'UI acceptance fixture',
  stages: {
    blind: { status: 'completed', summary: 'blind' },
    plan: { status: 'completed', planPath: 'plans/ui.md', summary: 'plan' },
  },
  planCoverage: {
    status: 'completed',
    items: [
      {
        id: 'plan-ui',
        requirementKind: 'static',
        label: 'レビューUIを実装する',
        startLine: 1,
        endLine: 2,
        status: 'satisfied',
        rationale: 'UI差分が存在する。',
        evidence: [
          {
            kind: 'implementation',
            groupId: 'group-ui',
            file: 'ui.js',
            lineSide: 'new',
            startLine: 1,
            endLine: 1,
          },
        ],
        findingIds: ['S1-001'],
      },
    ],
  },
  verificationItems: [
    {
      id: 'verify-ui',
      requirementKind: 'runtime',
      label: '目視確認',
      startLine: 3,
      endLine: 3,
      requiredAction: 'light/dark両themeを目視する',
      status: 'not-verified',
    },
  ],
  highlighting: {
    version: '4.3.1',
    engine: 'javascript-regexp',
    themes: { light: 'github-light', dark: 'github-dark' },
    styles: [
      {
        id: 0,
        light: { color: '#005cc5', fontStyle: 'normal', fontWeight: '700', textDecoration: 'none' },
        dark: { color: '#79b8ff', fontStyle: 'normal', fontWeight: '700', textDecoration: 'none' },
      },
    ],
    fallbacks: [],
  },
  riskCounts: { critical: 0, high: 1, medium: 0, low: 0 },
  commits: [],
  groups: [
    {
      id: 'group-ui',
      fingerprint: 'b'.repeat(64),
      title: 'レビュー画面',
      summary: '承認とコメントを確認する。',
      changeType: 'feature',
      risk: 'high',
      intent: '人間が差分を確認する。',
      implementationSummary: '固定UIを追加。',
      impact: 'ローカルレビュー。',
      verificationPoints: ['操作できること'],
      planItemIds: ['plan-ui'],
      files: [
        {
          id: 'file-1',
          path: 'ui.js',
          oldPath: null,
          newPath: 'ui.js',
          status: 'A',
          additions: 2000,
          deletions: 0,
          binary: false,
          size: 20000,
          changeSources: ['committed'],
        },
      ],
      hunks: [
        {
          id: 'hunk-1',
          fileId: 'file-1',
          file: 'ui.js',
          header: '@@ -0,0 +1 @@',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 2000,
          lines: Array.from({ length: 2000 }, (_, index) => ({
            kind: 'addition',
            oldLine: null,
            newLine: index + 1,
            text: `safe(${index + 1})`,
            tokenRuns:
              index === 0 || index === 1749
                ? [[0, `safe(${index + 1})`.length, 0]]
                : [],
          })),
        },
      ],
      findings: [
        {
          id: 'S1-001',
          fingerprint: 'c'.repeat(64),
          stage: 'blind',
          severity: 'high',
          category: 'bug',
          locationKind: 'diff',
          lineSide: 'new',
          file: 'ui.js',
          startLine: 1750,
          endLine: 1750,
          title: '確認対象',
          issue: '問題の説明',
          rationale: '確認理由',
          suggestion: '修正案',
          confidence: 'high',
          planAssessment: { status: 'confirmed', rationale: 'planでも確認' },
        },
      ],
      fileExplanations: [],
    },
  ],
}

const template = readFileSync(
  join(skillDirectory, 'assets/review-template.html'),
  'utf8',
)
const renderReport = (value) =>
  template
    .replace('{{STYLE}}', readFileSync(join(skillDirectory, 'assets/review.css'), 'utf8'))
    .replace(
      '{{REPORT_JSON}}',
      JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e'),
    )
    .replace('{{SCRIPT}}', readFileSync(join(skillDirectory, 'assets/review.js'), 'utf8'))

const html = renderReport(report)
const htmlPath = join(outputDirectory, 'index.html')
writeFileSync(htmlPath, html)
const url = pathToFileURL(htmlPath).href

const walkthroughReport = structuredClone(report)
walkthroughReport.review.id = 'ui-walkthrough'
walkthroughReport.mode = 'walkthrough'
walkthroughReport.groups[0].fileExplanations = [
  {
    id: 'file-explanation-ui',
    fileId: 'file-1',
    responsibility: 'レビュー画面の操作を提供する。',
    implementationSummary: '差分表示と状態管理を実装する。',
    reviewPoints: ['選択中の区間だけを描画すること'],
    detailLevel: 'segmented',
    summaryOnlyKind: null,
    summaryOnlyReason: null,
    segments: Array.from({ length: Math.ceil(2_000 / 120) }, (_, index) => {
      const startLineIndex = index * 120
      const endLineIndex = Math.min(startLineIndex + 119, 1_999)
      return {
        id: `segment-ui-${index + 1}`,
        hunkId: 'hunk-1',
        startLineIndex,
        endLineIndex,
        whatChanged: `差分の${startLineIndex + 1}〜${endLineIndex + 1}行目を説明する。`,
        why: '大きな差分を120行以下の区間に分けて確認できるようにするため。',
        reviewFocus: '選択した区間だけが描画され、前後の区間へ移動できること。',
        findingIds: [],
      }
    }),
    planItemIds: ['plan-ui'],
  },
]
walkthroughReport.groups.push({
  id: 'group-validation',
  fingerprint: 'e'.repeat(64),
  title: '検証境界',
  summary: '同じpathを別の実装意図で確認する。',
  changeType: 'test',
  risk: 'medium',
  intent: 'groupごとのfile責務を区別する。',
  implementationSummary: '同名fileの別group解説を追加。',
  impact: 'walkthrough navigation。',
  verificationPoints: ['groupとfileの組で選択できること'],
  planItemIds: [],
  files: [
    {
      id: 'file-1',
      path: 'ui.js',
      oldPath: 'ui.js',
      newPath: 'ui.js',
      status: 'M',
      additions: 1,
      deletions: 0,
      binary: false,
      size: 20,
      changeSources: ['committed'],
    },
  ],
  hunks: [
    {
      id: 'hunk-2',
      fileId: 'file-1',
      file: 'ui.js',
      header: '@@ -1,0 +1 @@',
      oldStart: 1,
      oldLines: 0,
      newStart: 1,
      newLines: 1,
      lines: [
        {
          kind: 'addition',
          oldLine: null,
          newLine: 1,
          text: 'validate()',
          tokenRuns: [[0, 10, 0]],
        },
      ],
    },
  ],
  findings: [],
  fileExplanations: [
    {
      id: 'file-explanation-validation',
      fileId: 'file-1',
      responsibility: '同名ファイルの検証境界を担当する。',
      implementationSummary: '検証用の処理を追加する。',
      reviewPoints: ['レビュー画面groupの説明と混同しないこと'],
      detailLevel: 'segmented',
      summaryOnlyKind: null,
      summaryOnlyReason: null,
      segments: [
        {
          id: 'segment-validation-1',
          hunkId: 'hunk-2',
          startLineIndex: 0,
          endLineIndex: 0,
          whatChanged: '検証処理を追加した。',
          why: 'group-scoped navigationを確認するため。',
          reviewFocus: '同じpathでも選択したgroupの責務を表示すること。',
          findingIds: [],
        },
      ],
      planItemIds: [],
    },
  ],
})
walkthroughReport.riskCounts.medium = 1
const walkthroughHtml = renderReport(walkthroughReport)
const walkthroughPath = join(outputDirectory, 'walkthrough.html')
writeFileSync(walkthroughPath, walkthroughHtml)
const walkthroughUrl = pathToFileURL(walkthroughPath).href

const tokenCases = [
  ['src/example.ts', 'const value: number = 1'],
  ['config/example.json', '"enabled": true'],
  ['styles/example.css', '.card { color: red; }'],
  ['docs/example.md', '# Review'],
]
const tokenReport = structuredClone(report)
tokenReport.review.id = 'ui-token-themes'
tokenReport.stats.files = tokenCases.length
tokenReport.stats.hunks = tokenCases.length
tokenReport.stats.additions = tokenCases.length
tokenReport.planCoverage.items = []
tokenReport.verificationItems = []
tokenReport.groups[0].planItemIds = []
tokenReport.groups[0].files = tokenCases.map(([filePath], index) => ({
  id: `token-file-${index + 1}`,
  path: filePath,
  oldPath: null,
  newPath: filePath,
  status: 'A',
  additions: 1,
  deletions: 0,
  binary: false,
  size: 40,
  changeSources: ['committed'],
}))
tokenReport.groups[0].hunks = tokenCases.map(([filePath, text], index) => ({
  id: `token-hunk-${index + 1}`,
  fileId: `token-file-${index + 1}`,
  file: filePath,
  header: '@@ -0,0 +1 @@',
  oldStart: 0,
  oldLines: 0,
  newStart: 1,
  newLines: 1,
  lines: [
    {
      kind: 'addition',
      oldLine: null,
      newLine: 1,
      text,
      tokenRuns: [[0, text.length, 0]],
    },
  ],
}))
tokenReport.groups[0].findings = []
const tokenPath = join(outputDirectory, 'tokens.html')
writeFileSync(tokenPath, renderReport(tokenReport))
const tokenUrl = pathToFileURL(tokenPath).href

test('file URLで承認・resolve・コメント・keyboard・copy fallbackが動く', async ({
  page,
}) => {
  await page.goto(url)
  await expect.poll(() => page.evaluate(() => window.__explainedCodeReviewReady)).toBe(true)
  await expect(page.locator('#review-title')).toHaveText('feature/ui')
  await expect(page.getByText('解説つき差分レビュー')).toHaveCount(0)
  await expect(page.locator('.diff-line')).toHaveCount(0)
  await expect(page.locator('#plan-filter').getByLabel('充足')).toBeChecked()
  await expect(page.getByText('未確認', { exact: true })).toBeVisible()
  await expect(page.getByText('light/dark両themeを目視する')).toBeVisible()
  await page.getByRole('button', { name: 'implementation: ui.js:1-1' }).click()
  await expect(page.locator('[data-line-index="0"] .syntax-token')).toHaveCSS('color', 'rgb(0, 92, 197)')
  await page.keyboard.press('d')
  await page.getByRole('button', { name: 'implementation: ui.js:1-1' }).click()
  await expect(page.locator('[data-line-index="0"] .syntax-token')).toHaveCSS('color', 'rgb(121, 184, 255)')
  await page.keyboard.press('d')
  await expect(page.locator('.hunk')).toHaveAttribute('open', '')
  await expect(page.locator('.diff-line')).toHaveCount(400)
  await page
    .getByRole('button', { name: 'ui.js:1750-1750', exact: true })
    .click()
  await expect(page.locator('.hunk')).toHaveAttribute('open', '')
  await expect(page.locator('.diff-line')).toHaveCount(400)
  await expect(page.locator('[data-line-index="1749"]')).toHaveClass(
    /highlighted/u,
  )
  await expect(page.locator('[data-line-index="1749"]')).toBeFocused()
  await expect(page.getByText('未確認 1件', { exact: true })).toBeVisible()
  const featureFilter = page.locator('#change-filter').getByLabel('feature')
  await featureFilter.uncheck()
  await expect(
    page.getByText('選択した条件に該当する変更グループはありません。'),
  ).toBeVisible()
  await featureFilter.check()

  const groupApproval = page.getByLabel('レビュー画面を承認')
  await groupApproval.focus()
  await page.keyboard.press('Space')
  await expect(groupApproval).toBeChecked()
  await expect(page.getByText('確認済み・指摘残あり', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'resolve', exact: true }).click()
  await expect(page.getByText('確認完了', { exact: true })).toBeVisible()

  const comment = page.getByLabel('この変更グループへのコメント')
  await comment.fill('人間の確認コメント')
  await page.reload()
  await expect(comment).toHaveValue('人間の確認コメント')
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((item) =>
      item.startsWith('explained-code-review:v3:'),
    )
    const saved = JSON.parse(localStorage.getItem(key))
    saved.comments['group-ui'][0].fingerprint = 'd'.repeat(64)
    localStorage.setItem(key, JSON.stringify(saved))
  })
  await page.reload()
  await expect(comment).toHaveValue('')
  await expect(page.getByText('前版コメント・要再確認')).toBeVisible()
  await page.getByRole('button', { name: '現行コメントへ移す' }).click()
  await expect(comment).toHaveValue('人間の確認コメント')

  await page.keyboard.press('d')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
  })
  await page.getByRole('button', { name: 'フィードバックをコピー' }).click()
  await expect(page.locator('#copy-dialog')).toBeVisible()
  await expect(page.locator('#copy-fallback')).toHaveValue(/人間の確認コメント/u)
})

test('Plan evidenceとfindingはfilter外のgroupを再表示して遷移する', async ({
  page,
}) => {
  await page.goto(url)
  const highFilter = page.locator('#risk-filter').getByLabel('high')
  const featureFilter = page.locator('#change-filter').getByLabel('feature')

  await highFilter.uncheck()
  await featureFilter.uncheck()
  await expect(
    page.getByText('選択した条件に該当する変更グループはありません。'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'implementation: ui.js:1-1' }).click()
  await expect(highFilter).toBeChecked()
  await expect(featureFilter).toBeChecked()
  await expect(page.getByRole('heading', { name: 'レビュー画面', exact: true })).toBeVisible()
  await expect(page.locator('[data-line-index="0"]')).toBeFocused()

  await highFilter.uncheck()
  await featureFilter.uncheck()
  await page.getByRole('button', { name: 'S1-001: 確認対象' }).click()
  await expect(highFilter).toBeChecked()
  await expect(featureFilter).toBeChecked()
  await expect(page.locator('[data-line-index="1749"]')).toBeFocused()
})

test('TypeScript・JSON・CSS・Markdownのtoken spanをtheme切替で再描画する', async ({
  page,
}) => {
  await page.goto(tokenUrl)
  for (const [filePath] of tokenCases) {
    const hunk = page.locator('.hunk').filter({ hasText: filePath })
    await expect(hunk.locator('.syntax-token')).toHaveCount(1)
    await expect(hunk.locator('.syntax-token')).toHaveCSS('color', 'rgb(0, 92, 197)')
  }

  await page.getByRole('button', { name: 'ダークテーマに切り替える' }).click()
  for (const [filePath] of tokenCases) {
    const hunk = page.locator('.hunk').filter({ hasText: filePath })
    await expect(hunk.locator('.syntax-token')).toHaveCSS('color', 'rgb(121, 184, 255)')
  }
})

test('theme切替は開いたhunk・diffページ・行focusを保持してtoken色だけ更新する', async ({
  page,
}) => {
  await page.goto(url)
  await page.getByRole('button', { name: 'ui.js:1750-1750', exact: true }).click()

  const hunk = page.locator('.hunk')
  const focusedLine = page.locator('[data-line-index="1749"]')
  const token = focusedLine.locator('.syntax-token')
  await expect(hunk).toHaveAttribute('open', '')
  await expect(page.getByText('1601–2000 / 2000 lines')).toBeVisible()
  await expect(focusedLine).toBeFocused()
  await expect(token).toHaveCSS('color', 'rgb(0, 92, 197)')
  const scrollY = await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, 2_100)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    return window.scrollY
  })

  await page.keyboard.press('d')

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(hunk).toHaveAttribute('open', '')
  await expect(page.getByText('1601–2000 / 2000 lines')).toBeVisible()
  await expect(focusedLine).toBeFocused()
  await expect(token).toHaveCSS('color', 'rgb(121, 184, 255)')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY)
})

test('desktopでは主要panelの幅と角丸を揃えPlan filterを横並びにする', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(url)
  const snapshot = page.locator('.snapshot-notice')
  const plan = page.locator('.plan-overview')
  const [snapshotBox, planBox] = await Promise.all([
    snapshot.boundingBox(),
    plan.boundingBox(),
  ])

  expect(snapshotBox).not.toBeNull()
  expect(planBox).not.toBeNull()
  expect(Math.abs(snapshotBox.x - planBox.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(snapshotBox.width - planBox.width)).toBeLessThanOrEqual(1)
  for (const selector of [
    '.snapshot-notice',
    '.plan-overview',
    '.group-list',
    '#group-detail',
    '.finding-card',
  ]) {
    await expect(page.locator(selector).first()).toHaveCSS('border-radius', '14px')
  }
  await expect(page.locator('#plan-filter')).toHaveCSS('display', 'flex')
  const filterBox = await page.locator('#plan-filter').boundingBox()
  expect(filterBox.height).toBeLessThanOrEqual(46)
})

for (const width of [375, 768, 1280]) {
  test(`${width}pxでpage全体に横overflowを作らない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(url)
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflows).toBe(false)
    await expect(page.locator('.group-row')).toBeVisible()
    if (width === 375) {
      await page.locator('.hunk summary').click()
      await expect(page.locator('.diff-line')).toHaveCount(400)
      const scrollable = await page.locator('.diff-scroll').evaluate((node) => {
        node.scrollLeft = node.scrollWidth
        return node.scrollWidth > node.clientWidth && node.scrollLeft > 0
      })
      expect(scrollable).toBe(true)
    }
  })
}

test('walkthroughはview switchとgroup-scoped file/segment navigationを表示する', async ({
  page,
}) => {
  await page.goto(walkthroughUrl)
  await expect(page.locator('.diff-line')).toHaveCount(0)
  await page.getByRole('button', { name: 'ファイル別解説' }).click()
  await expect(page.getByText('レビュー画面の操作を提供する。')).toBeVisible()
  await expect(page.getByText('差分の1〜120行目を説明する。')).toBeVisible()
  await expect(page.locator('.segment-code .diff-line')).toHaveCount(120)
  const reviewEntry = page.getByRole('button', { name: 'ui.js — レビュー画面' })
  const validationEntry = page.getByRole('button', { name: 'ui.js — 検証境界' })
  await expect(reviewEntry).toHaveAttribute('aria-current', 'true')
  await validationEntry.click()
  await expect(validationEntry).toHaveAttribute('aria-current', 'true')
  await expect(reviewEntry).toHaveAttribute('aria-current', 'false')
  await expect(page.locator('.walkthrough-context')).toHaveText('検証境界')
  await expect(page.getByText('同名ファイルの検証境界を担当する。')).toBeVisible()
  await expect(page.getByText('検証処理を追加した。')).toBeVisible()
  await expect(page.getByText('差分の1〜120行目を説明する。')).toHaveCount(0)
  await reviewEntry.click()
  await expect(page.getByText('レビュー画面の操作を提供する。')).toBeVisible()
  await expect(page.getByText('差分の1〜120行目を説明する。')).toBeVisible()
  await expect(page.getByText('検証処理を追加した。')).toHaveCount(0)
  await page.setViewportSize({ width: 375, height: 900 })
  await expect(page.getByLabel('解説するファイル')).toBeVisible()
})
