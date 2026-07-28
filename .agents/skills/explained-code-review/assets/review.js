(() => {
  'use strict'

  const risks = ['critical', 'high', 'medium', 'low']
  const changeTypes = [
    'feature',
    'fix',
    'refactor',
    'test',
    'docs',
    'build',
    'chore',
    'mixed',
  ]
  const stateVersion = 2
  const byId = (id) => document.getElementById(id)
  const nodes = {
    report: byId('report-data'),
    title: byId('review-title'),
    stats: byId('review-stats'),
    progressFill: byId('progress-fill'),
    approvalProgress: byId('approval-progress'),
    reviewStatus: byId('review-status'),
    overview: byId('review-overview'),
    snapshot: byId('snapshot-meta'),
    filters: byId('risk-filter'),
    changeFilters: byId('change-filter'),
    list: byId('group-list'),
    empty: byId('empty-groups'),
    detail: byId('group-detail'),
    feedback: byId('feedback-summary'),
    previous: byId('previous-group'),
    next: byId('next-group'),
    copy: byId('copy-feedback'),
    theme: byId('theme-toggle'),
    help: byId('help-button'),
    helpDialog: byId('help-dialog'),
    copyDialog: byId('copy-dialog'),
    copyFallback: byId('copy-fallback'),
    warning: byId('storage-warning'),
  }

  function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  function parseReport() {
    const value = JSON.parse(nodes.report.textContent)
    if (
      !value ||
      typeof value !== 'object' ||
      value.schemaVersion !== 2 ||
      !value.review ||
      !Array.isArray(value.groups)
    ) {
      throw new Error('report.jsonの基本構造が不正です。')
    }
    return value
  }

  let report
  try {
    report = parseReport()
  } catch (error) {
    document.body.replaceChildren(
      element('p', 'storage-warning', `レビューを表示できません: ${error.message}`),
    )
    return
  }

  const groupById = new Map(report.groups.map((group) => [group.id, group]))
  const findingById = new Map(
    report.groups.flatMap((group) =>
      group.findings.map((finding) => [finding.id, finding]),
    ),
  )
  const storageKey = [
    'explained-code-review',
    `v${stateVersion}`,
    report.review.repositoryHash,
    report.review.scope,
    report.review.id,
  ].join(':')
  const preferredTheme =
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

  function cleanFingerprintMap(value, records) {
    const result = {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result
    for (const [id, fingerprint] of Object.entries(value)) {
      const record = records.get(id)
      if (record && fingerprint === record.fingerprint) result[id] = fingerprint
    }
    return result
  }

  function cleanComments(value) {
    const result = {}
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result
    for (const [groupId, entries] of Object.entries(value)) {
      if (!Array.isArray(entries)) continue
      const clean = entries
        .filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.fingerprint === 'string' &&
            typeof entry.text === 'string' &&
            entry.text.trim(),
        )
        .map((entry) => ({
          fingerprint: entry.fingerprint,
          title: typeof entry.title === 'string' ? entry.title : groupId,
          text: entry.text,
        }))
      if (clean.length) result[groupId] = clean
    }
    return result
  }

  function defaultState() {
    return {
      schemaVersion: stateVersion,
      selectedGroupId: report.groups[0]?.id ?? null,
      risks: [...risks],
      changeTypes: [...changeTypes],
      approvals: {},
      resolved: {},
      comments: {},
      theme: preferredTheme,
    }
  }

  function readState() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return defaultState()
      const saved = JSON.parse(raw)
      if (!saved || saved.schemaVersion !== stateVersion) return defaultState()
      return {
        schemaVersion: stateVersion,
        selectedGroupId: groupById.has(saved.selectedGroupId)
          ? saved.selectedGroupId
          : report.groups[0]?.id ?? null,
        risks: Array.isArray(saved.risks)
          ? risks.filter((risk) => saved.risks.includes(risk))
          : [...risks],
        changeTypes: Array.isArray(saved.changeTypes)
          ? changeTypes.filter((type) => saved.changeTypes.includes(type))
          : [...changeTypes],
        approvals: cleanFingerprintMap(saved.approvals, groupById),
        resolved: cleanFingerprintMap(saved.resolved, findingById),
        comments: cleanComments(saved.comments),
        theme: saved.theme === 'dark' ? 'dark' : 'light',
      }
    } catch {
      showWarning('保存状態を読み込めませんでした。新しい状態で続行します。')
      return defaultState()
    }
  }

  function showWarning(message) {
    nodes.warning.hidden = false
    nodes.warning.textContent = message
  }

  let state = readState()
  let renderToken = 0

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      showWarning('localStorageを利用できないため、状態は再読込後に残りません。')
    }
  }

  function isApproved(group) {
    return state.approvals[group.id] === group.fingerprint
  }

  function isResolved(finding) {
    return state.resolved[finding.id] === finding.fingerprint
  }

  function setApproved(group, approved) {
    if (approved) state.approvals[group.id] = group.fingerprint
    else delete state.approvals[group.id]
    saveState()
    render()
  }

  function currentComment(group) {
    return (
      state.comments[group.id]?.find(
        (entry) => entry.fingerprint === group.fingerprint,
      )?.text ?? ''
    )
  }

  function staleComments(group) {
    return (state.comments[group.id] ?? []).filter(
      (entry) => entry.fingerprint !== group.fingerprint,
    )
  }

  function writeComment(group, text) {
    const other = (state.comments[group.id] ?? []).filter(
      (entry) => entry.fingerprint !== group.fingerprint,
    )
    if (text.trim()) {
      other.push({
        fingerprint: group.fingerprint,
        title: group.title,
        text,
      })
    }
    if (other.length) state.comments[group.id] = other
    else delete state.comments[group.id]
    saveState()
    renderProgress()
  }

  function filteredGroups() {
    return report.groups.filter(
      (group) =>
        state.risks.includes(group.risk) &&
        state.changeTypes.includes(group.changeType),
    )
  }

  function selectedGroup() {
    const visible = filteredGroups()
    return (
      visible.find((group) => group.id === state.selectedGroupId) ??
      visible[0] ??
      null
    )
  }

  function selectGroup(id, focus = false) {
    state.selectedGroupId = id
    saveState()
    render()
    if (focus) nodes.detail.focus({ preventScroll: true })
  }

  function addDefinition(list, term, value) {
    const wrapper = element('div')
    wrapper.append(element('dt', '', term), element('dd', '', String(value)))
    list.append(wrapper)
  }

  function renderHeader() {
    nodes.title.textContent = `解説つき差分レビュー · ${report.git.branch}`
    nodes.stats.replaceChildren()
    for (const [term, value] of [
      ['Files', report.stats.files],
      ['Hunks', report.stats.hunks],
      ['Add', `+${report.stats.additions}`],
      ['Delete', `−${report.stats.deletions}`],
    ]) {
      addDefinition(nodes.stats, term, value)
    }
    nodes.overview.textContent = report.overview
    nodes.snapshot.replaceChildren()
    addDefinition(nodes.snapshot, 'Scope', report.review.scope)
    addDefinition(
      nodes.snapshot,
      'Fingerprint',
      report.review.workspaceFingerprint.slice(0, 16),
    )
    addDefinition(nodes.snapshot, 'Base', report.git.baseRef)
    addDefinition(nodes.snapshot, 'Merge base', report.git.mergeBase.slice(0, 12))
    addDefinition(nodes.snapshot, 'Collected', report.review.collectedAt)
    const notice = element(
      'p',
      'snapshot-caution',
      'この承認は収集時snapshotに対するものです。修正後は再生成して、もう一度確認してください。',
    )
    nodes.snapshot.parentElement.append(notice)
  }

  function renderFilters() {
    for (const risk of risks) {
      const label = element('label', 'filter-label')
      label.dataset.risk = risk
      const input = element('input')
      input.type = 'checkbox'
      input.checked = state.risks.includes(risk)
      input.addEventListener('change', () => {
        state.risks = input.checked
          ? risks.filter((item) => [...state.risks, risk].includes(item))
          : state.risks.filter((item) => item !== risk)
        const next = selectedGroup()
        state.selectedGroupId = next?.id ?? null
        saveState()
        render()
      })
      label.append(input, element('span', '', risk))
      nodes.filters.append(label)
    }
    for (const type of changeTypes) {
      const label = element('label', 'filter-label')
      const input = element('input')
      input.type = 'checkbox'
      input.checked = state.changeTypes.includes(type)
      input.addEventListener('change', () => {
        state.changeTypes = input.checked
          ? changeTypes.filter((item) => [...state.changeTypes, type].includes(item))
          : state.changeTypes.filter((item) => item !== type)
        state.selectedGroupId = selectedGroup()?.id ?? null
        saveState()
        render()
      })
      label.append(input, element('span', '', type))
      nodes.changeFilters.append(label)
    }
  }

  function renderList(group) {
    const visible = filteredGroups()
    nodes.list.replaceChildren()
    nodes.empty.hidden = visible.length > 0
    for (const item of visible) {
      const row = element('div', 'group-row')
      row.setAttribute('aria-current', String(item.id === group?.id))
      row.dataset.risk = item.risk
      const select = element('button', 'group-select')
      select.type = 'button'
      select.setAttribute('aria-label', `${item.title}の詳細を表示`)
      const content = element('div', 'group-title')
      content.append(
        element('strong', '', item.title),
        element('small', '', `${item.hunks.length} hunks · ${item.risk}`),
      )
      const summary = element('p', 'group-summary-text', item.summary)
      const changeType = element('span', 'tag', item.changeType)
      const findingCount = element(
        'span',
        'finding-count',
        `${item.findings.length} findings`,
      )
      const approval = element('label', 'approval-control')
      const checkbox = element('input')
      checkbox.type = 'checkbox'
      checkbox.checked = isApproved(item)
      checkbox.setAttribute('aria-label', `${item.title}を承認`)
      checkbox.addEventListener('click', (event) => event.stopPropagation())
      checkbox.addEventListener('change', () => setApproved(item, checkbox.checked))
      approval.append(checkbox, element('span', '', checkbox.checked ? '確認済み' : '承認'))
      select.append(content, summary, changeType, findingCount)
      select.addEventListener('click', () => selectGroup(item.id, true))
      row.append(select, approval)
      nodes.list.append(row)
    }
  }

  function detailBlock(title, value) {
    const section = element('section', 'detail-block')
    section.append(element('h3', '', title), element('p', '', value))
    return section
  }

  function lineMatchesFinding(line, finding, hunk) {
    if (finding.locationKind !== 'diff' || finding.file !== hunk.file) return false
    const number = finding.lineSide === 'old' ? line.oldLine : line.newLine
    return number !== null && number >= finding.startLine && number <= finding.endLine
  }

  function renderHunk(hunk, findings, container, token) {
    const details = element('details', 'hunk')
    details.open = true
    const summary = element('summary', '', `${hunk.file}  ${hunk.header}`)
    const scroll = element('div', 'diff-scroll')
    const table = element('div', 'diff-lines')
    scroll.append(table)
    details.append(summary, scroll)
    container.append(details)
    let cursor = 0
    const appendChunk = () => {
      if (token !== renderToken) return
      const fragment = document.createDocumentFragment()
      for (let end = Math.min(cursor + 160, hunk.lines.length); cursor < end; cursor++) {
        const line = hunk.lines[cursor]
        const row = element('div', 'diff-line')
        row.dataset.kind = line.kind
        row.dataset.hunkId = hunk.id
        if (
          findings.some((finding) => lineMatchesFinding(line, finding, hunk))
        ) {
          row.classList.add('highlighted')
        }
        row.append(
          element('span', 'line-number', line.oldLine ?? ''),
          element('span', 'line-number', line.newLine ?? ''),
          element(
            'span',
            'line-marker',
            line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '−' : ' ',
          ),
          element('span', 'line-text', line.text),
        )
        fragment.append(row)
      }
      table.append(fragment)
      if (cursor < hunk.lines.length) schedule(appendChunk)
    }
    schedule(appendChunk)
  }

  function schedule(callback) {
    if ('requestIdleCallback' in window) window.requestIdleCallback(callback)
    else window.setTimeout(callback, 0)
  }

  function scrollToFinding(finding, group) {
    const hunk = group.hunks.find(
      (item) =>
        item.file === finding.file &&
        item.lines.some((line) => lineMatchesFinding(line, finding, item)),
    )
    if (!hunk) return
    const rows = nodes.detail.querySelectorAll(`[data-hunk-id="${CSS.escape(hunk.id)}"]`)
    const line = [...rows].find((row) => {
      const values = row.querySelectorAll('.line-number')
      const index = finding.lineSide === 'old' ? 0 : 1
      const number = Number(values[index]?.textContent)
      return number >= finding.startLine && number <= finding.endLine
    })
    if (!line) return
    line.scrollIntoView({ behavior: 'smooth', block: 'center' })
    line.classList.add('highlighted')
  }

  function renderFindings(group, container) {
    const section = element('section', 'findings-section')
    section.append(element('h3', '', `指摘 (${group.findings.length})`))
    if (!group.findings.length) section.append(element('p', 'empty-state', '指摘はありません。'))
    const list = element('div', 'finding-list')
    for (const finding of group.findings) {
      const card = element('article', 'finding-card')
      card.dataset.severity = finding.severity
      const heading = element('div', 'finding-header')
      heading.append(
        element('span', 'finding-stage', finding.stage),
        element('strong', '', finding.title),
        (() => {
          const badge = element('span', 'risk-badge', finding.severity)
          badge.dataset.risk = finding.severity
          return badge
        })(),
      )
      const location = element(
        'button',
        'finding-location',
        `${finding.file}:${finding.startLine}-${finding.endLine}`,
      )
      location.type = 'button'
      location.disabled = finding.locationKind !== 'diff'
      location.addEventListener('click', () => scrollToFinding(finding, group))
      const resolved = element('button', 'resolve-button', isResolved(finding) ? 'unresolve' : 'resolve')
      resolved.type = 'button'
      resolved.addEventListener('click', () => {
        if (isResolved(finding)) delete state.resolved[finding.id]
        else state.resolved[finding.id] = finding.fingerprint
        saveState()
        render()
      })
      card.append(
        heading,
        location,
        detailBlock('問題', finding.issue),
        detailBlock('理由', finding.rationale),
        detailBlock('提案', finding.suggestion),
        detailBlock(
          'Plan照合',
          `${finding.planAssessment.status}: ${finding.planAssessment.rationale}`,
        ),
        resolved,
      )
      if (isResolved(finding)) card.classList.add('resolved')
      list.append(card)
    }
    if (group.findings.length) section.append(list)
    container.append(section)
  }

  function renderComments(group, container) {
    const section = element('section', 'comments-section')
    section.append(element('h3', '', '人間コメント'))
    const label = element('label', '', 'この変更グループへのコメント')
    const textarea = element('textarea')
    textarea.rows = 5
    textarea.value = currentComment(group)
    textarea.placeholder = '確認結果、質問、修正依頼を記入'
    textarea.addEventListener('input', () => writeComment(group, textarea.value))
    label.append(textarea)
    section.append(label)
    const stale = staleComments(group)
    if (stale.length) {
      const staleBox = element('aside', 'stale-comments')
      staleBox.append(element('h4', '', '前版コメント・要再確認'))
      for (const entry of stale) {
        const item = element('div', 'stale-comment')
        item.append(element('p', '', entry.text))
        const move = element('button', '', '現行コメントへ移す')
        move.type = 'button'
        move.addEventListener('click', () => {
          writeComment(group, [currentComment(group), entry.text].filter(Boolean).join('\n\n'))
          state.comments[group.id] = state.comments[group.id].filter(
            (candidate) => candidate !== entry,
          )
          saveState()
          render()
        })
        item.append(move)
        staleBox.append(item)
      }
      section.append(staleBox)
    }
    container.append(section)
  }

  function renderDetail(group) {
    renderToken += 1
    const token = renderToken
    nodes.detail.replaceChildren()
    nodes.detail.tabIndex = -1
    if (!group) {
      nodes.detail.append(element('h2', '', '変更グループを選択してください'))
      return
    }
    const header = element('header', 'detail-header')
    header.dataset.risk = group.risk
    const title = element('div')
    title.append(
      element('span', 'group-change-type', group.changeType),
      element('h2', '', group.title),
      element('p', '', group.summary),
    )
    const approval = element('label', 'detail-approval')
    const checkbox = element('input')
    checkbox.type = 'checkbox'
    checkbox.checked = isApproved(group)
    checkbox.addEventListener('change', () => setApproved(group, checkbox.checked))
    approval.append(checkbox, element('span', '', checkbox.checked ? '確認済み' : 'この意図を承認'))
    header.append(title, approval)
    nodes.detail.append(
      header,
      detailBlock('実装意図', group.intent),
      detailBlock('実装の要約', group.implementationSummary),
      detailBlock('影響範囲', group.impact),
    )
    const verification = element('section', 'detail-block')
    verification.append(element('h3', '', '確認ポイント'))
    const list = element('ul')
    for (const point of group.verificationPoints) list.append(element('li', '', point))
    verification.append(list)
    nodes.detail.append(verification)
    const diff = element('section', 'diff-section')
    diff.append(element('h3', '', `Unified diff (${group.hunks.length} hunks)`))
    for (const hunk of group.hunks) renderHunk(hunk, group.findings, diff, token)
    nodes.detail.append(diff)
    renderFindings(group, nodes.detail)
    renderComments(group, nodes.detail)
  }

  function unresolvedFindings() {
    return [...findingById.values()].filter((finding) => !isResolved(finding))
  }

  function staleEntries() {
    return Object.entries(state.comments).flatMap(([id, entries]) => {
      const group = groupById.get(id)
      return entries
        .filter((entry) => !group || entry.fingerprint !== group.fingerprint)
        .map((entry) => ({ groupId: id, title: entry.title, text: entry.text }))
    })
  }

  function renderProgress() {
    const approved = report.groups.filter(isApproved).length
    const unresolved = unresolvedFindings().length
    const unapproved = report.groups.length - approved
    nodes.approvalProgress.textContent = `承認 ${approved}/${report.groups.length}`
    nodes.progressFill.style.width = `${report.groups.length ? (approved / report.groups.length) * 100 : 100}%`
    const status =
      unapproved > 0
        ? `未確認 ${unapproved}件`
        : unresolved > 0
          ? '確認済み・指摘残あり'
          : '確認完了'
    nodes.reviewStatus.textContent = status
    nodes.feedback.textContent = `${status} · 未解決 ${unresolved}件 · コメント ${
      Object.keys(state.comments).length
    }グループ`
  }

  function markdown() {
    const unapproved = report.groups.filter((group) => !isApproved(group))
    const unresolved = unresolvedFindings()
    const current = report.groups
      .map((group) => ({ group, text: currentComment(group) }))
      .filter((entry) => entry.text.trim())
    const stale = staleEntries()
    const lines = [
      '# Explained code review feedback',
      '',
      `- Scope: \`${report.review.scope}\``,
      `- Workspace fingerprint: \`${report.review.workspaceFingerprint}\``,
      `- Review ID: \`${report.review.id}\``,
      '',
      `## 未承認グループ (${unapproved.length})`,
      '',
      ...unapproved.map(
        (group) => `- [${group.changeType}/${group.risk}] ${group.title}`,
      ),
      '',
      `## 未解決のAI指摘 (${unresolved.length})`,
      '',
      ...unresolved.flatMap((finding) => [
        `### ${finding.id}: ${finding.title}`,
        '',
        `- Severity: ${finding.severity}`,
        `- Location: \`${finding.file}:${finding.startLine}-${finding.endLine}\``,
        `- Issue: ${finding.issue}`,
        `- Suggestion: ${finding.suggestion}`,
        '',
      ]),
      `## 人間コメント (${current.length})`,
      '',
      ...current.flatMap(({ group, text }) => [`### ${group.title}`, '', text, '']),
      `## 前版コメント・要再確認 (${stale.length})`,
      '',
      ...stale.flatMap((entry) => [`### ${entry.title}`, '', entry.text, '']),
    ]
    return lines.join('\n').trimEnd()
  }

  async function copyMarkdown() {
    const text = markdown()
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(text)
      nodes.copy.textContent = 'コピーしました'
      window.setTimeout(() => (nodes.copy.textContent = 'フィードバックをコピー'), 1600)
    } catch {
      nodes.copyFallback.value = text
      openDialog(nodes.copyDialog)
      nodes.copyFallback.focus()
      nodes.copyFallback.select()
      try {
        document.execCommand('copy')
      } catch {
        // The selected textarea remains available for manual copy.
      }
    }
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme
    nodes.theme.textContent = state.theme === 'dark' ? '☀' : '◐'
    nodes.theme.setAttribute(
      'aria-label',
      state.theme === 'dark' ? 'ライトテーマに切り替える' : 'ダークテーマに切り替える',
    )
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark'
    saveState()
    applyTheme()
  }

  function moveGroup(direction) {
    const visible = filteredGroups()
    if (!visible.length) return
    const current = visible.findIndex((group) => group.id === selectedGroup()?.id)
    const next = (current + direction + visible.length) % visible.length
    selectGroup(visible[next].id, true)
  }

  function openDialog(dialog) {
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }

  function render() {
    const group = selectedGroup()
    if (group && state.selectedGroupId !== group.id) state.selectedGroupId = group.id
    renderList(group)
    renderDetail(group)
    renderProgress()
    const visible = filteredGroups()
    nodes.previous.disabled = visible.length < 2
    nodes.next.disabled = visible.length < 2
  }

  renderHeader()
  renderFilters()
  applyTheme()
  render()

  nodes.previous.addEventListener('click', () => moveGroup(-1))
  nodes.next.addEventListener('click', () => moveGroup(1))
  nodes.copy.addEventListener('click', copyMarkdown)
  nodes.theme.addEventListener('click', toggleTheme)
  nodes.help.addEventListener('click', () => openDialog(nodes.helpDialog))
  document.addEventListener('keydown', (event) => {
    const target = event.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === 'j') moveGroup(1)
    else if (key === 'k') moveGroup(-1)
    else if (key === 'a' && selectedGroup()) {
      const group = selectedGroup()
      setApproved(group, !isApproved(group))
    } else if (key === 'd') toggleTheme()
    else if (key === 'c') copyMarkdown()
    else if (key === '?') openDialog(nodes.helpDialog)
  })

  window.__explainedCodeReviewReady = true
})()
