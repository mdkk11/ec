import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const skillDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = mkdtempSync(join(tmpdir(), 'explained-review-ui-'))
const report = {
  schemaVersion: 2,
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
    additions: 1,
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
      files: [
        {
          id: 'file-1',
          path: 'ui.js',
          oldPath: null,
          newPath: 'ui.js',
          status: 'A',
          additions: 1,
          deletions: 0,
          binary: false,
          size: 10,
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
          newLines: 1,
          lines: [
            { kind: 'addition', oldLine: null, newLine: 1, text: 'safe()' },
          ],
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
          startLine: 1,
          endLine: 1,
          title: '確認対象',
          issue: '問題の説明',
          rationale: '確認理由',
          suggestion: '修正案',
          confidence: 'high',
          planAssessment: { status: 'confirmed', rationale: 'planでも確認' },
        },
      ],
    },
  ],
}

const template = readFileSync(
  join(skillDirectory, 'assets/review-template.html'),
  'utf8',
)
const html = template
  .replace('{{STYLE}}', readFileSync(join(skillDirectory, 'assets/review.css'), 'utf8'))
  .replace(
    '{{REPORT_JSON}}',
    JSON.stringify(report).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e'),
  )
  .replace('{{SCRIPT}}', readFileSync(join(skillDirectory, 'assets/review.js'), 'utf8'))
const htmlPath = join(outputDirectory, 'index.html')
writeFileSync(htmlPath, html)
const url = pathToFileURL(htmlPath).href

test('file URLで承認・resolve・コメント・keyboard・copy fallbackが動く', async ({
  page,
}) => {
  await page.goto(url)
  await expect.poll(() => page.evaluate(() => window.__explainedCodeReviewReady)).toBe(true)
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
      item.startsWith('explained-code-review:v2:'),
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
      const scrollable = await page.locator('.diff-scroll').evaluate((node) => {
        node.scrollLeft = node.scrollWidth
        return node.scrollWidth > node.clientWidth && node.scrollLeft > 0
      })
      expect(scrollable).toBe(true)
    }
  })
}
