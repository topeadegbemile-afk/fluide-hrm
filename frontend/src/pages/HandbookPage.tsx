import { useEffect, useMemo, useState, useRef, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bold,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FileText,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  LoaderCircle,
  Paperclip,
  Pencil,
  RotateCw,
  Search,
  Underline,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type HandbookArticle = {
  id: string
  title: string
  slug: string
  summary: string | null
  category: string
  content: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; employeeNumber: string; firstName: string; lastName: string } | null
  attachments: PolicyAttachment[]
}

type PolicyAttachment = { id: string; fileName: string; mimeType: string; size: number; createdAt: string }

type HandbookResult = {
  items: HandbookArticle[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

type ArticleFields = {
  title: string
  slug: string
  summary: string
  category: string
  content: string
  isPublished: boolean
}

const pageSize = 12
const blankArticle: ArticleFields = {
  title: '',
  slug: '',
  summary: '',
  category: '',
  content: '',
  isPublished: false,
}

function articleFields(article: HandbookArticle | null): ArticleFields {
  if (!article) return blankArticle
  return {
    title: article.title,
    slug: article.slug,
    summary: article.summary ?? '',
    category: article.category,
    content: article.content,
    isPublished: article.isPublished,
  }
}

function formatArticleDate(value: string | null) {
  if (!value) return 'Draft'
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

const policyHtmlTags = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN'])
const blockedPolicyTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'FORM', 'INPUT', 'VIDEO', 'AUDIO'])

function sanitizePolicyHtml(value: string) {
  const documentValue = new DOMParser().parseFromString(value, 'text/html')
  const safeChildren = (parent: ParentNode): DocumentFragment => {
    const fragment = document.createDocumentFragment()
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) { fragment.append(document.createTextNode(node.textContent ?? '')); return }
      if (!(node instanceof HTMLElement)) return
      if (blockedPolicyTags.has(node.tagName)) return
      const children = safeChildren(node)
      if (!policyHtmlTags.has(node.tagName)) { fragment.append(children); return }
      const safe = document.createElement(node.tagName.toLowerCase())
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') ?? ''
        if (/^(https?:|mailto:)/i.test(href)) { safe.setAttribute('href', href); safe.setAttribute('target', '_blank'); safe.setAttribute('rel', 'noopener noreferrer') }
      }
      if (node.tagName === 'SPAN') {
        const style = node.style
        const safeStyles: string[] = []
        if (style.color && !/url\(|expression|[<>]/i.test(style.color)) safeStyles.push(`color:${style.color}`)
        if (style.fontFamily && /^[\w\s,'-]+$/.test(style.fontFamily)) safeStyles.push(`font-family:${style.fontFamily}`)
        if (style.fontSize && /^(\d+(\.\d+)?(px|pt|em|rem|%))$/i.test(style.fontSize)) safeStyles.push(`font-size:${style.fontSize}`)
        if (safeStyles.length) safe.setAttribute('style', safeStyles.join(';'))
      }
      safe.append(children)
      fragment.append(safe)
    })
    return fragment
  }
  const container = document.createElement('div')
  container.append(safeChildren(documentValue.body))
  return container.innerHTML
}

function PolicyContentEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const updateValue = () => { if (editorRef.current) onChange(editorRef.current.innerHTML) }
  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRangeRef.current = selection.getRangeAt(0).cloneRange()
  }
  const command = (name: string, argument?: string) => {
    editorRef.current?.focus()
    document.execCommand(name, false, argument)
    updateValue()
  }
  const applyInlineStyle = (property: 'fontFamily' | 'fontSize' | 'color', value: string) => {
    const selection = window.getSelection()
    if ((!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) && savedRangeRef.current) {
      selection?.removeAllRanges()
      selection?.addRange(savedRangeRef.current)
    }
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0)
    if (range.collapsed) return
    const span = document.createElement('span')
    span.style[property] = value
    span.append(range.extractContents())
    range.insertNode(span)
    selection.removeAllRanges()
    const nextRange = document.createRange()
    nextRange.selectNodeContents(span)
    selection.addRange(nextRange)
    updateValue()
  }
  const toolbarButton = (label: string, icon: ReactNode, action: () => void) => (
    <button type="button" className="policy-editor-tool" aria-label={label} title={label} onMouseDown={(event) => event.preventDefault()} onClick={action}>{icon}</button>
  )

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = sanitizePolicyHtml(value)
  }, [value])

  return <div className="policy-editor">
    <div className="policy-editor-toolbar" role="toolbar" aria-label="Policy content formatting">
      {toolbarButton('Heading 1', <Heading1 size={16} />, () => command('formatBlock', 'H1'))}
      {toolbarButton('Heading 2', <Heading2 size={16} />, () => command('formatBlock', 'H2'))}
      <span className="policy-toolbar-divider" />
      {toolbarButton('Bold', <Bold size={15} />, () => command('bold'))}
      {toolbarButton('Italic', <Italic size={15} />, () => command('italic'))}
      {toolbarButton('Underline', <Underline size={15} />, () => command('underline'))}
      <span className="policy-toolbar-divider" />
      <select aria-label="Font family" title="Font family" onFocus={saveSelection} onChange={(event) => applyInlineStyle('fontFamily', event.target.value)} defaultValue="Arial"><option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="'Times New Roman'">Times New Roman</option></select>
      <select aria-label="Font size" title="Font size" onFocus={saveSelection} onChange={(event) => applyInlineStyle('fontSize', event.target.value)} defaultValue="16px"><option value="13px">Small</option><option value="16px">Normal</option><option value="20px">Large</option><option value="24px">Larger</option></select>
      <label className="policy-color-tool" title="Text color">A<input aria-label="Text color" type="color" onFocus={saveSelection} onChange={(event) => applyInlineStyle('color', event.target.value)} /></label>
      <span className="policy-toolbar-divider" />
      {toolbarButton('Bulleted list', <List size={16} />, () => command('insertUnorderedList'))}
      {toolbarButton('Numbered list', <ListOrdered size={16} />, () => command('insertOrderedList'))}
      {toolbarButton('Add link', <Link2 size={15} />, () => { const href = window.prompt('Enter a web address'); if (href) command('createLink', href) })}
    </div>
    <div ref={editorRef} className="policy-content-editable" style={{ whiteSpace: 'pre-wrap' }} contentEditable role="textbox" aria-label="Policy content" aria-multiline="true" data-placeholder="Write the policy here. Use headings to organize sections…" onInput={updateValue} onBlur={updateValue} onKeyUp={saveSelection} onMouseUp={saveSelection} />
  </div>
}

async function openPolicyAttachment(attachment: PolicyAttachment) {
  const openInTab = attachment.mimeType === 'application/pdf' || attachment.mimeType.startsWith('image/')
    ? window.open('', '_blank')
    : null
  try {
    const blob = await api.download(`/handbook/attachments/${attachment.id}`)
    const url = URL.createObjectURL(blob)
    if (openInTab) {
      openInTab.location.href = url
    } else {
      const link = document.createElement('a'); link.href = url; link.download = attachment.fileName; link.click()
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (cause) {
    openInTab?.close()
    window.alert(cause instanceof ApiError ? cause.message : 'Could not open this attachment.')
  }
}

function ArticleDialog({
  article,
  canManagePublication,
  onClose,
  onSave,
}: {
  article: HandbookArticle | null
  canManagePublication: boolean
  onClose: () => void
  onSave: (fields: ArticleFields, files: File[]) => Promise<void>
}) {
  const [fields, setFields] = useState<ArticleFields>(() => ({
    ...articleFields(article),
    ...(!article && !canManagePublication ? { isPublished: true } : {}),
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<File[]>([])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sanitizePolicyHtml(fields.content).replace(/<[^>]*>/g, '').trim() && files.length === 0) {
      setError('Add policy content or attach a policy file before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(fields, files)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this policy.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="employee-dialog handbook-dialog" role="dialog" aria-modal="true" aria-labelledby="handbook-form-title">
        <header className="employee-dialog-header">
          <div><p className="eyebrow">KNOWLEDGE & POLICIES</p><h2 id="handbook-form-title">{article ? 'Edit policy' : 'Create policy'}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close policy editor"><X size={19} /></button>
        </header>
        <form className="employee-form" onSubmit={(event) => void submit(event)}>
          <div className="employee-form-grid">
            <label className="employee-form-full">Policy title
              <input value={fields.title} onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} required minLength={3} maxLength={180} autoFocus />
            </label>
            <label>Category
              <input value={fields.category} onChange={(event) => setFields((current) => ({ ...current, category: event.target.value }))} required minLength={2} maxLength={80} placeholder="e.g. Policies" />
            </label>
            <label>URL slug <span className="field-optional">Optional</span>
              <input value={fields.slug} onChange={(event) => setFields((current) => ({ ...current, slug: event.target.value }))} minLength={2} maxLength={180} placeholder="Generated from title" />
            </label>
            <label className="employee-form-full">Summary <span className="field-optional">Optional · up to 500 characters</span>
              <textarea value={fields.summary} onChange={(event) => setFields((current) => ({ ...current, summary: event.target.value }))} maxLength={500} rows={2} />
            </label>
            <div className="employee-form-full policy-content-field"><span className="policy-field-label">Policy content</span>
              <PolicyContentEditor value={fields.content} onChange={(content) => setFields((current) => ({ ...current, content }))} />
              <span className="field-optional">Format headings and text, add links, and organize the policy into readable sections.</span>
            </div>
            <label className="employee-form-full policy-file-picker"><span>Policy files <span className="field-optional">PDF and supporting attachments · up to 20 MB each</span></span>
              <span className="policy-file-picker-box"><Paperclip size={17} /><span><strong>Choose files to attach</strong><small>PDF, PNG, JPG, TXT, DOCX, XLSX</small></span><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx,application/pdf,image/png,image/jpeg,text/plain" onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])} /></span>
            </label>
            {files.length > 0 && <ul className="policy-pending-files employee-form-full">{files.map((file, index) => <li key={`${file.name}-${index}`}><FileText size={15} /><span>{file.name}<small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}><X size={14} /></button></li>)}</ul>}
            {article?.attachments?.length ? <div className="employee-form-full policy-existing-files"><span>Already attached</span>{article.attachments.map((file) => <button type="button" key={file.id} onClick={() => void openPolicyAttachment(file)}><Paperclip size={14} />{file.fileName}</button>)}</div> : null}
            {canManagePublication && <label className="department-active-toggle">
              <input type="checkbox" checked={fields.isPublished} onChange={(event) => setFields((current) => ({ ...current, isPublished: event.target.checked }))} />
              Published and visible to employees
            </label>}
            {!canManagePublication && <p className="employee-form-hint employee-form-full">This policy will be published when created.</p>}
          </div>
          {error && <p className="employee-form-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <footer className="employee-dialog-actions">
            <button className="button-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : article ? 'Save changes' : 'Create policy'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function HandbookPage() {
  const { hasPermission } = useAuth()
  const [articles, setArticles] = useState<HandbookArticle[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<HandbookResult['pagination']>({ page: 1, pageSize, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [articleDialog, setArticleDialog] = useState<HandbookArticle | null | undefined>(undefined)
  const [selectedArticle, setSelectedArticle] = useState<HandbookArticle | null>(null)
  const [notice, setNotice] = useState('')
  const canRead = hasPermission('handbook:read')
  const canCreate = hasPermission('handbook:create')
  const canUpdate = hasPermission('handbook:update')

  useEffect(() => {
    if (!canRead) return
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search) params.set('q', search)
    if (category !== 'ALL') params.set('category', category)
    const endpoint = canUpdate ? '/handbook/manage' : '/handbook'
    void api.get<HandbookResult>(`${endpoint}?${params.toString()}`).then((result) => {
      if (cancelled) return
      setArticles(result.items)
      setPagination(result.pagination)
      setError('')
      setIsLoading(false)
    }).catch((cause: unknown) => {
      if (cancelled) return
      setArticles([])
      setPagination({ page: 1, pageSize, total: 0, totalPages: 0 })
      setError(cause instanceof ApiError ? cause.message : 'Unable to load policies.')
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [canRead, canUpdate, category, page, reloadKey, search])

  const categories = useMemo(() => [...new Set(articles.map((article) => article.category))].sort((a, b) => a.localeCompare(b)), [articles])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setPage(1)
    setSearch(searchInput.trim())
  }

  async function saveArticle(fields: ArticleFields, files: File[]) {
    const payload = {
      title: fields.title.trim(),
      ...(fields.slug.trim() && { slug: fields.slug.trim() }),
      summary: fields.summary.trim() || null,
      category: fields.category.trim(),
      content: sanitizePolicyHtml(fields.content).trim(),
      isPublished: canUpdate ? fields.isPublished : true,
    }
    if (articleDialog) {
      const updated = await api.patch<HandbookArticle>(`/handbook/${articleDialog.id}`, payload)
      setSelectedArticle((current) => current?.id === updated.id ? updated : current)
      for (const file of files) await api.uploadFile<PolicyAttachment>(`/handbook/${updated.id}/attachments`, file)
      setIsLoading(true)
      setReloadKey((key) => key + 1)
      setNotice(`${updated.title} was updated.`)
    } else {
      const created = await api.post<HandbookArticle>('/handbook', payload)
      setArticleDialog(created)
      for (const file of files) await api.uploadFile<PolicyAttachment>(`/handbook/${created.id}/attachments`, file)
      setNotice(`${created.title} was created.`)
      setPage(1)
      setSearch('')
      setSearchInput('')
      setCategory('ALL')
      setIsLoading(true)
      setReloadKey((key) => key + 1)
    }
    setArticleDialog(undefined)
  }

  if (!canRead) {
    return (
      <section className="module-placeholder access-denied" role="alert">
        <div className="placeholder-icon"><AlertCircle size={21} /></div>
        <div><h2>Access restricted</h2><p>Your account does not have permission to view policies.</p></div>
      </section>
    )
  }

  return (
    <section className="handbook-page" aria-label="Company policies">
      <div className="handbook-intro">
        <span className="employee-summary-icon"><BookOpen size={18} /></span>
        <div><p className="eyebrow">KNOWLEDGE & POLICIES</p><h2>Your guide to working at Fluidé Homes.</h2><p>Policies, practical guidance, and shared knowledge in one place.</p></div>
      </div>
      {notice && <div className="employee-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      <div className="handbook-heading-row">
        <div><h2>Policies</h2><p>{pagination.total} {pagination.total === 1 ? 'policy' : 'policies'}{canUpdate ? ' · including drafts' : ''}</p></div>
        {canCreate && <button className="button-primary" type="button" onClick={() => setArticleDialog(null)}><CirclePlus size={16} /> New policy</button>}
      </div>

      <form className="handbook-toolbar" onSubmit={submitSearch}>
        <label className="employee-search">
          <Search size={16} /><span className="sr-only">Search policies</span>
          <input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search policies and guidance…" />
        </label>
        <label className="employee-status-filter"><span>Category</span>
          <select value={category} onChange={(event) => { setIsLoading(true); setCategory(event.target.value); setPage(1) }}>
            <option value="ALL">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="button-secondary" type="submit">Search</button>
        <button className="icon-button employee-refresh" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }} disabled={isLoading} aria-label="Refresh policies">
          {isLoading ? <LoaderCircle className="loading-icon" size={17} /> : <RotateCw size={16} />}
        </button>
      </form>

      {error ? (
        <div className="employees-state employees-error" role="alert"><AlertCircle size={20} /><div><h2>Policies unavailable</h2><p>{error}</p><button className="text-button" type="button" onClick={() => { setIsLoading(true); setReloadKey((key) => key + 1) }}><RotateCw size={14} /> Try again</button></div></div>
      ) : isLoading ? (
        <div className="employees-state" role="status"><LoaderCircle className="loading-icon" size={19} />Loading policies…</div>
      ) : articles.length === 0 ? (
        <div className="employees-state empty-directory"><BookOpen size={22} /><h2>{search || category !== 'ALL' ? 'No matching policies' : 'No policies yet'}</h2><p>{search || category !== 'ALL' ? 'Try another search or category.' : 'Published policies and guidance will appear here.'}</p>{canCreate && articles.length === 0 && !search && category === 'ALL' && <button className="button-primary" type="button" onClick={() => setArticleDialog(null)}><CirclePlus size={16} /> Create policy</button>}</div>
      ) : (
        <>
          <div className="handbook-article-list">
            {articles.map((article) => (
              <article className={`handbook-article-card${!article.isPublished ? ' is-draft' : ''}`} key={article.id}>
                <div className="handbook-article-symbol"><FileText size={18} /></div>
                <div className="handbook-article-main">
                  <div className="handbook-article-meta"><span>{article.category}</span>{!article.isPublished && <span className="employee-status">Draft</span>}</div>
                  <button className="handbook-article-title" type="button" onClick={() => setSelectedArticle(article)}>{article.title}</button>
                  {article.summary && <p>{article.summary}</p>}
                  <span className="handbook-article-date">{article.isPublished ? `Published ${formatArticleDate(article.publishedAt)}` : `Updated ${formatArticleDate(article.updatedAt)}`}</span>
                </div>
                {canUpdate && <button className="icon-button" type="button" onClick={() => setArticleDialog(article)} aria-label={`Edit ${article.title}`}><Pencil size={15} /></button>}
              </article>
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <nav className="handbook-pagination" aria-label="Policy pages">
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <div>
                <button className="button-secondary" type="button" onClick={() => { setIsLoading(true); setPage((current) => Math.max(1, current - 1)) }} disabled={page <= 1}><ChevronLeft size={15} /> Previous</button>
                  <button className="button-secondary" type="button" onClick={() => { setIsLoading(true); setPage((current) => Math.min(pagination.totalPages, current + 1)) }} disabled={page >= pagination.totalPages}>Next <ChevronRight size={15} /></button>
              </div>
            </nav>
          )}
        </>
      )}

      {articleDialog !== undefined && <ArticleDialog article={articleDialog} canManagePublication={canUpdate} onClose={() => setArticleDialog(undefined)} onSave={saveArticle} />}
      {selectedArticle && (
        <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedArticle(null) }}>
          <article className="employee-dialog handbook-reader" role="dialog" aria-modal="true" aria-labelledby="handbook-reader-title">
            <header className="employee-dialog-header">
              <div><p className="eyebrow">{selectedArticle.category}{!selectedArticle.isPublished ? ' · DRAFT' : ''}</p><h2 id="handbook-reader-title">{selectedArticle.title}</h2></div>
              <button className="icon-button" type="button" onClick={() => setSelectedArticle(null)} aria-label="Close policy"><X size={19} /></button>
            </header>
            <div className="handbook-reader-meta"><span>{selectedArticle.isPublished ? `Published ${formatArticleDate(selectedArticle.publishedAt)}` : 'Unpublished draft'}</span>{selectedArticle.createdBy && <span>By {selectedArticle.createdBy.firstName} {selectedArticle.createdBy.lastName}</span>}</div>
            {selectedArticle.summary && <p className="handbook-reader-summary">{selectedArticle.summary}</p>}
            <div className="handbook-reader-content" dangerouslySetInnerHTML={{ __html: sanitizePolicyHtml(selectedArticle.content) }} />
            {selectedArticle.attachments?.length > 0 && <section className="policy-reader-files" aria-label="Policy attachments"><h3>Policy files</h3>{selectedArticle.attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => void openPolicyAttachment(attachment)}><span className="policy-attachment-icon"><FileText size={16} /></span><span><strong>{attachment.fileName}</strong><small>{attachment.mimeType === 'application/pdf' ? 'PDF document' : attachment.mimeType.split('/').pop()?.toUpperCase()} · {(attachment.size / (1024 * 1024)).toFixed(1)} MB</small></span><ArrowLeft className="policy-file-open-icon" size={15} /></button>)}</section>}
            <footer className="handbook-reader-actions">
              <button className="button-secondary" type="button" onClick={() => setSelectedArticle(null)}><ArrowLeft size={15} /> Back to policies</button>
              {canUpdate && <button className="button-primary" type="button" onClick={() => { setArticleDialog(selectedArticle); setSelectedArticle(null) }}><Pencil size={14} /> Edit policy</button>}
            </footer>
          </article>
        </div>
      )}
    </section>
  )
}
