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
  const planStatuses = ['satisfied', 'partial', 'missing', 'not-applicable']
  const planStatusLabels = Object.freeze({
    satisfied: '充足',
    partial: '部分対応',
    missing: '未実装',
    'not-applicable': '対象外',
    'not-verified': '未確認',
  })
  const planStatusLabel = (status) => planStatusLabels[status] ?? status
  const stateVersion = 3
  const diffPageSize = 400
  const autoOpenLineLimit = 1200
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
    planSummary: byId('plan-summary'),
    planFilter: byId('plan-filter'),
    planCoverage: byId('plan-coverage'),
    verificationItems: byId('verification-items'),
    filters: byId('risk-filter'),
    changeFilters: byId('change-filter'),
    list: byId('group-list'),
    empty: byId('empty-groups'),
    detail: byId('group-detail'),
    viewSwitch: byId('view-switch'),
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
      value.schemaVersion !== 3 ||
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
  const findingOwnerById = new Map(
    report.groups.flatMap((group) =>
      group.findings.map((finding) => [finding.id, group.id]),
    ),
  )
  const highlightStyleById = new Map(
    report.highlighting.styles.map((style) => [style.id, style]),
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
      planStatuses: [...planStatuses],
      view: 'review',
      selectedFileExplanationId: null,
      selectedSegmentId: null,
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
        planStatuses: Array.isArray(saved.planStatuses)
          ? planStatuses.filter((status) => saved.planStatuses.includes(status))
          : [...planStatuses],
        view:
          report.mode === 'walkthrough' && saved.view === 'walkthrough'
            ? 'walkthrough'
            : 'review',
        selectedFileExplanationId:
          typeof saved.selectedFileExplanationId === 'string'
            ? saved.selectedFileExplanationId
            : null,
        selectedSegmentId:
          typeof saved.selectedSegmentId === 'string'
            ? saved.selectedSegmentId
            : null,
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
  let hunkViews = new Map()

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

  function revealGroup(group, view) {
    state.risks = risks.filter(
      (risk) => state.risks.includes(risk) || risk === group.risk,
    )
    state.changeTypes = changeTypes.filter(
      (type) => state.changeTypes.includes(type) || type === group.changeType,
    )
    state.selectedGroupId = group.id
    state.view = view
  }

  function syncGroupFilterControls() {
    for (const label of nodes.filters.querySelectorAll('[data-risk]')) {
      label.querySelector('input').checked = state.risks.includes(label.dataset.risk)
    }
    for (const label of nodes.changeFilters.querySelectorAll('[data-change-type]')) {
      label.querySelector('input').checked = state.changeTypes.includes(
        label.dataset.changeType,
      )
    }
  }

  function addDefinition(list, term, value) {
    const wrapper = element('div')
    wrapper.append(element('dt', '', term), element('dd', '', String(value)))
    list.append(wrapper)
  }

  function applyTokenStyle(token) {
    const styleId = Number(token.dataset.syntaxStyleId)
    const style = highlightStyleById.get(styleId)?.[state.theme]
    token.style.color = style?.color ?? ''
    token.style.fontStyle = style?.fontStyle ?? ''
    token.style.fontWeight = style?.fontWeight ?? ''
    token.style.textDecoration = style?.textDecoration ?? ''
  }

  function updateRenderedTokenStyles() {
    for (const token of document.querySelectorAll('.syntax-token')) {
      applyTokenStyle(token)
    }
  }

  function renderTokenText(line) {
    const container = element('span', 'line-text')
    if (!line.tokenRuns.length) {
      container.textContent = line.text
      return container
    }
    for (const run of line.tokenRuns) {
      const [start, end, styleId] = run
      const token = element('span', 'syntax-token', line.text.slice(start, end))
      token.dataset.syntaxStyleId = String(styleId)
      applyTokenStyle(token)
      container.append(token)
    }
    return container
  }

  function scrollToEvidence(evidence) {
    const group = groupById.get(evidence.groupId)
    if (!group) return
    revealGroup(group, 'review')
    saveState()
    render()
    if (evidence.file === null) {
      nodes.detail.focus({ preventScroll: true })
      nodes.detail.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const hunk = group.hunks.find(
      (item) => item.file === evidence.file && item.lines.some((line) => {
        const number = evidence.lineSide === 'old' ? line.oldLine : line.newLine
        return number !== null && number >= evidence.startLine && number <= evidence.endLine
      }),
    )
    if (!hunk) return
    const index = hunk.lines.findIndex((line) => {
      const number = evidence.lineSide === 'old' ? line.oldLine : line.newLine
      return number !== null && number >= evidence.startLine && number <= evidence.endLine
    })
    const row = hunkViews.get(hunk.id)?.openAt(index)
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (row) {
      row.tabIndex = -1
      row.focus({ preventScroll: true })
    }
  }

  function navigateToFinding(findingId) {
    const group = groupById.get(findingOwnerById.get(findingId))
    const finding = findingById.get(findingId)
    if (!group || !finding) return
    revealGroup(group, 'review')
    saveState()
    render()
    if (finding.locationKind === 'diff') scrollToFinding(finding, group)
    else {
      const card = nodes.detail.querySelector(`[data-finding-id="${CSS.escape(findingId)}"]`)
      if (card) {
        card.tabIndex = -1
        card.focus({ preventScroll: true })
        card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  function renderPlan() {
    nodes.planSummary.textContent =
      report.stages.plan.status === 'skipped-no-plan'
        ? 'Plan照合なし'
        : report.stages.plan.summary
    nodes.planFilter.replaceChildren()
    if (report.planCoverage.status === 'completed') {
      for (const status of planStatuses) {
        const label = element('label', 'filter-label')
        const input = element('input')
        input.type = 'checkbox'
        input.checked = state.planStatuses.includes(status)
        input.addEventListener('change', () => {
          state.planStatuses = input.checked
            ? planStatuses.filter((item) => [...state.planStatuses, status].includes(item))
            : state.planStatuses.filter((item) => item !== status)
          saveState()
          renderPlanItems()
        })
        label.append(input, element('span', '', planStatusLabel(status)))
        nodes.planFilter.append(label)
      }
    }
    renderPlanItems()
    nodes.verificationItems.replaceChildren()
    if (!report.verificationItems.length) {
      nodes.verificationItems.append(element('p', 'empty-state', '未確認項目はありません。'))
    }
    for (const item of report.verificationItems) {
      const card = element('article', 'verification-item')
      card.append(
        element('strong', '', item.label),
        element('span', 'plan-status', planStatusLabel('not-verified')),
        element('p', '', item.requiredAction),
      )
      nodes.verificationItems.append(card)
    }
  }

  function renderPlanItems() {
    nodes.planCoverage.replaceChildren()
    const visible = report.planCoverage.items.filter((item) =>
      state.planStatuses.includes(item.status),
    )
    if (!visible.length) {
      nodes.planCoverage.append(
        element('p', 'empty-state', report.planCoverage.status === 'skipped-no-plan' ? 'Plan照合なし' : '条件に該当するPlan項目はありません。'),
      )
      return
    }
    for (const item of visible) {
      const card = element('article', 'plan-item')
      card.dataset.status = item.status
      const heading = element('div', 'plan-item-heading')
      heading.append(
        element('strong', '', item.label),
        element('span', 'plan-status', planStatusLabel(item.status)),
      )
      card.append(heading, element('p', '', item.rationale))
      const links = element('div', 'evidence-links')
      for (const evidence of item.evidence) {
        const button = element(
          'button',
          '',
          evidence.file === null
            ? `${evidence.kind}: ${groupById.get(evidence.groupId)?.title ?? evidence.groupId}`
            : `${evidence.kind}: ${evidence.file}:${evidence.startLine}-${evidence.endLine}`,
        )
        button.type = 'button'
        button.addEventListener('click', () => scrollToEvidence(evidence))
        links.append(button)
      }
      for (const findingId of item.findingIds) {
        const finding = findingById.get(findingId)
        const button = element('button', 'plan-finding-link', `${findingId}: ${finding?.title ?? 'Plan指摘'}`)
        button.type = 'button'
        button.addEventListener('click', () => navigateToFinding(findingId))
        links.append(button)
      }
      if (links.childElementCount) card.append(links)
      nodes.planCoverage.append(card)
    }
  }

  function renderHeader() {
    nodes.title.textContent = report.git.branch
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
      label.dataset.changeType = type
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

  function renderHunk(hunk, findings, container, token, autoOpen) {
    const details = element('details', 'hunk')
    const summary = element(
      'summary',
      '',
      `${hunk.file}  ${hunk.header}  (${hunk.lines.length} lines)`,
    )
    const scroll = element('div', 'diff-scroll')
    const table = element('div', 'diff-lines')
    const pagination = element('nav', 'diff-pagination')
    pagination.setAttribute('aria-label', `${hunk.file}のdiffページ`)
    const previous = element('button', '', '前のdiff行')
    previous.type = 'button'
    const pageStatus = element('span')
    const next = element('button', '', '次のdiff行')
    next.type = 'button'
    pagination.append(previous, pageStatus, next)
    pagination.hidden = hunk.lines.length <= diffPageSize
    scroll.append(table)
    details.append(summary, scroll, pagination)
    container.append(details)
    let pageStart = 0

    const renderPage = (requestedStart) => {
      if (token !== renderToken) return null
      const maximumStart = Math.max(
        0,
        Math.floor((hunk.lines.length - 1) / diffPageSize) * diffPageSize,
      )
      pageStart = Math.max(0, Math.min(requestedStart, maximumStart))
      const pageEnd = Math.min(pageStart + diffPageSize, hunk.lines.length)
      const fragment = document.createDocumentFragment()
      for (let index = pageStart; index < pageEnd; index += 1) {
        const line = hunk.lines[index]
        const row = element('div', 'diff-line')
        row.dataset.kind = line.kind
        row.dataset.hunkId = hunk.id
        row.dataset.lineIndex = String(index)
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
          renderTokenText(line),
        )
        fragment.append(row)
      }
      table.replaceChildren(fragment)
      pageStatus.textContent =
        hunk.lines.length === 0
          ? '0 lines'
          : `${pageStart + 1}–${pageEnd} / ${hunk.lines.length} lines`
      previous.disabled = pageStart === 0
      next.disabled = pageEnd >= hunk.lines.length
      return table
    }

    previous.addEventListener('click', () => {
      renderPage(pageStart - diffPageSize)
    })
    next.addEventListener('click', () => {
      renderPage(pageStart + diffPageSize)
    })
    details.addEventListener('toggle', () => {
      if (details.open && table.childElementCount === 0) renderPage(pageStart)
    })
    if (autoOpen) {
      details.open = true
      renderPage(0)
    }
    return {
      openAt(index) {
        details.open = true
        renderPage(Math.floor(index / diffPageSize) * diffPageSize)
        return table.querySelector(`[data-line-index="${index}"]`)
      },
    }
  }

  function scrollToFinding(finding, group) {
    const hunk = group.hunks.find(
      (item) =>
        item.file === finding.file &&
        item.lines.some((line) => lineMatchesFinding(line, finding, item)),
    )
    if (!hunk) return
    const lineIndex = hunk.lines.findIndex((line) =>
      lineMatchesFinding(line, finding, hunk),
    )
    if (lineIndex < 0) return
    const line = hunkViews.get(hunk.id)?.openAt(lineIndex)
    if (!line) return
    line.tabIndex = -1
    line.focus({ preventScroll: true })
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
      card.dataset.findingId = finding.id
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

  function fileExplanationEntries() {
    return report.groups.flatMap((group) =>
      group.fileExplanations.map((explanation) => ({
        group,
        explanation,
        file: group.files.find((file) => file.id === explanation.fileId),
      })),
    )
  }

  function selectFileExplanation(entry) {
    revealGroup(entry.group, 'walkthrough')
    state.selectedFileExplanationId = entry.explanation.id
    state.selectedSegmentId = entry.explanation.segments[0]?.id ?? null
    saveState()
    render()
  }

  function renderSegmentCode(segment, group) {
    const hunk = group.hunks.find((item) => item.id === segment.hunkId)
    const code = element('div', 'segment-code diff-lines')
    if (!hunk) return code
    for (
      let index = segment.startLineIndex;
      index <= segment.endLineIndex;
      index += 1
    ) {
      const line = hunk.lines[index]
      const row = element('div', 'diff-line')
      row.dataset.kind = line.kind
      row.append(
        element('span', 'line-number', line.oldLine ?? ''),
        element('span', 'line-number', line.newLine ?? ''),
        element('span', 'line-marker', line.kind === 'addition' ? '+' : line.kind === 'deletion' ? '−' : ' '),
        renderTokenText(line),
      )
      code.append(row)
    }
    return code
  }

  function renderWalkthrough(group, container) {
    const entries = fileExplanationEntries()
    let selected = entries.find(
      (entry) =>
        entry.group.id === group.id &&
        entry.explanation.id === state.selectedFileExplanationId,
    )
    selected ??= entries.find((entry) => entry.group.id === group.id) ?? entries[0]
    if (!selected) {
      container.append(element('p', 'empty-state', 'ファイル別解説はありません。'))
      return
    }
    state.selectedFileExplanationId = selected.explanation.id

    const layout = element('div', 'walkthrough-layout')
    const nav = element('nav', 'walkthrough-nav')
    nav.setAttribute('aria-label', 'ファイル別解説')
    const mobile = element('select', 'walkthrough-select')
    mobile.setAttribute('aria-label', '解説するファイル')
    for (const entry of entries) {
      const label = `${entry.file?.path ?? entry.explanation.fileId} — ${entry.group.title}`
      const button = element('button', 'walkthrough-file', label)
      button.type = 'button'
      button.setAttribute(
        'aria-current',
        String(entry.explanation.id === selected.explanation.id && entry.group.id === selected.group.id),
      )
      button.addEventListener('click', () => selectFileExplanation(entry))
      nav.append(button)
      const option = element('option', '', label)
      option.value = `${entry.group.id}\u0000${entry.explanation.id}`
      option.selected = entry.explanation.id === selected.explanation.id && entry.group.id === selected.group.id
      mobile.append(option)
    }
    mobile.addEventListener('change', () => {
      const [groupId, explanationId] = mobile.value.split('\u0000')
      const entry = entries.find(
        (candidate) => candidate.group.id === groupId && candidate.explanation.id === explanationId,
      )
      if (entry) selectFileExplanation(entry)
    })
    nav.prepend(mobile)

    const detail = element('section', 'walkthrough-detail')
    detail.append(
      element('p', 'walkthrough-context', selected.group.title),
      element('h3', '', selected.file?.path ?? selected.explanation.fileId),
      detailBlock('このファイルの責務', selected.explanation.responsibility),
      detailBlock('実装内容', selected.explanation.implementationSummary),
    )
    const reviewPoints = element('section', 'detail-block')
    reviewPoints.append(element('h4', '', '確認観点'))
    const points = element('ul')
    for (const point of selected.explanation.reviewPoints) points.append(element('li', '', point))
    reviewPoints.append(points)
    detail.append(reviewPoints)

    if (selected.explanation.detailLevel === 'summary-only') {
      detail.append(
        element('p', 'summary-only-badge', selected.explanation.summaryOnlyKind),
        element('p', '', selected.explanation.summaryOnlyReason),
      )
    } else {
      const selectedSegment =
        selected.explanation.segments.find((segment) => segment.id === state.selectedSegmentId) ??
        selected.explanation.segments[0]
      state.selectedSegmentId = selectedSegment?.id ?? null
      const segmentNav = element('div', 'segment-nav')
      for (const [index, segment] of selected.explanation.segments.entries()) {
        const button = element('button', '', `区間 ${index + 1}`)
        button.type = 'button'
        button.setAttribute('aria-current', String(segment.id === selectedSegment?.id))
        button.addEventListener('click', () => {
          state.selectedSegmentId = segment.id
          saveState()
          render()
        })
        segmentNav.append(button)
      }
      detail.append(segmentNav)
      if (selectedSegment) {
        const card = element('article', 'segment-card')
        card.append(
          detailBlock('何を変えたか', selectedSegment.whatChanged),
          detailBlock('なぜ必要か', selectedSegment.why),
          detailBlock('レビュー時に見る点', selectedSegment.reviewFocus),
          renderSegmentCode(selectedSegment, selected.group),
        )
        detail.append(card)
      }
    }
    layout.append(nav, detail)
    container.append(layout)
  }

  function renderDetail(group) {
    renderToken += 1
    const token = renderToken
    hunkViews = new Map()
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
    const relatedPlan = report.planCoverage.items.filter((item) =>
      group.planItemIds.includes(item.id),
    )
    const planBlock = element('section', 'detail-block related-plan')
    planBlock.append(element('h3', '', '関連Plan項目'))
    if (!relatedPlan.length) planBlock.append(element('p', '', '関連付けなし'))
    for (const item of relatedPlan) {
      const badge = element('span', 'plan-status', planStatusLabel(item.status))
      const row = element('p')
      row.append(badge, document.createTextNode(` ${item.label}`))
      planBlock.append(row)
    }
    nodes.detail.append(planBlock)
    const verification = element('section', 'detail-block')
    verification.append(element('h3', '', '確認ポイント'))
    const list = element('ul')
    for (const point of group.verificationPoints) list.append(element('li', '', point))
    verification.append(list)
    nodes.detail.append(verification)
    if (state.view === 'walkthrough' && report.mode === 'walkthrough') {
      renderWalkthrough(group, nodes.detail)
      return
    }
    const diff = element('section', 'diff-section')
    diff.append(element('h3', '', `Unified diff (${group.hunks.length} hunks)`))
    const autoOpen =
      group.hunks.reduce((total, hunk) => total + hunk.lines.length, 0) <=
      autoOpenLineLimit
    for (const hunk of group.hunks) {
      hunkViews.set(
        hunk.id,
        renderHunk(hunk, group.findings, diff, token, autoOpen),
      )
    }
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
    const planGaps = report.planCoverage.items.filter((item) =>
      ['partial', 'missing'].includes(item.status),
    )
    const lines = [
      '# Explained code review feedback',
      '',
      `- Scope: \`${report.review.scope}\``,
      `- Workspace fingerprint: \`${report.review.workspaceFingerprint}\``,
      `- Review ID: \`${report.review.id}\``,
      '',
      `## Plan未充足 (${planGaps.length})`,
      '',
      ...planGaps.map(
        (item) => `- [${planStatusLabel(item.status)}] ${item.label}: ${item.rationale}`,
      ),
      '',
      `## 未確認の実行・目視項目 (${report.verificationItems.length})`,
      '',
      ...report.verificationItems.map((item) => `- ${item.label}: ${item.requiredAction}`),
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
    updateRenderedTokenStyles()
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
    syncGroupFilterControls()
    renderList(group)
    renderDetail(group)
    renderProgress()
    nodes.viewSwitch.hidden = report.mode !== 'walkthrough'
    for (const button of nodes.viewSwitch.querySelectorAll('[data-view]')) {
      button.setAttribute('aria-pressed', String(button.dataset.view === state.view))
    }
    const visible = filteredGroups()
    nodes.previous.disabled = visible.length < 2
    nodes.next.disabled = visible.length < 2
  }

  renderHeader()
  renderPlan()
  renderFilters()
  applyTheme()
  render()

  nodes.previous.addEventListener('click', () => moveGroup(-1))
  nodes.next.addEventListener('click', () => moveGroup(1))
  nodes.copy.addEventListener('click', copyMarkdown)
  nodes.theme.addEventListener('click', toggleTheme)
  nodes.help.addEventListener('click', () => openDialog(nodes.helpDialog))
  nodes.viewSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('[data-view]')
    if (!button) return
    state.view = button.dataset.view
    saveState()
    render()
  })
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
