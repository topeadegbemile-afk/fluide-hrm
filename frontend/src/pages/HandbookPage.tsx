import { useEffect, useMemo, useState, useRef, type ClipboardEvent, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Bold,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Download,
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
  Trash2,
  Underline,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'
import { useSearchParams } from 'react-router-dom'

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
  emailAnnouncement?: { attempted: number; sent: number; failed: number; error?: string } | null
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

function policySaveError(cause: unknown) {
  if (!(cause instanceof ApiError)) return 'Unable to save this policy.'
  const details = cause.details as { fieldErrors?: Record<string, string[]> } | undefined
  const fieldError = details?.fieldErrors && Object.values(details.fieldErrors).flat().find(Boolean)
  return fieldError ? `${cause.message}: ${fieldError}` : cause.message
}

const policyHtmlTags = new Set(['P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SPAN', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION'])
const blockedPolicyTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'FORM', 'INPUT', 'VIDEO', 'AUDIO'])
const policyColors: Record<string, string> = { Black: '#000000', White: '#ffffff', Red: '#ff0000', Green: '#008000', Yellow: '#ffff00' }
const policyColorValues: Record<string, string> = {
  '#000000': '#000000', 'rgb(0, 0, 0)': '#000000',
  '#ffffff': '#ffffff', 'rgb(255, 255, 255)': '#ffffff',
  '#ff0000': '#ff0000', 'rgb(255, 0, 0)': '#ff0000',
  '#008000': '#008000', 'rgb(0, 128, 0)': '#008000',
  '#ffff00': '#ffff00', 'rgb(255, 255, 0)': '#ffff00',
}
const policyColorPairs = [
  { text: 'Black', background: 'White' }, { text: 'White', background: 'Black' },
  { text: 'Black', background: 'Yellow' }, { text: 'Yellow', background: 'Black' },
  { text: 'Red', background: 'Black' }, { text: 'Black', background: 'Red' },
  { text: 'White', background: 'Green' }, { text: 'Green', background: 'White' },
].map((pair) => ({ ...pair, color: policyColors[pair.text], highlight: policyColors[pair.background] }))

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
      if (node.tagName === 'TD' || node.tagName === 'TH') {
        for (const attribute of ['colspan', 'rowspan']) {
          const value = node.getAttribute(attribute)
          if (value && /^\d{1,2}$/.test(value)) safe.setAttribute(attribute, value)
        }
      }
      if (node.tagName === 'SPAN') {
        const style = node.style
        const safeStyles: string[] = []
        const textColor = policyColorValues[style.color.toLowerCase()]
        const backgroundColor = policyColorValues[style.backgroundColor.toLowerCase()]
        if (textColor) safeStyles.push(`color:${textColor}`)
        if (backgroundColor) safeStyles.push(`background-color:${backgroundColor}`)
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
  const [activeColorPair, setActiveColorPair] = useState(0)
  const updateValue = () => { if (editorRef.current) onChange(editorRef.current.innerHTML) }
  const pasteContent = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    const clipboard = event.clipboardData
    let html = clipboard.getData('text/html')
    if (!html) {
      const text = clipboard.getData('text/plain')
      const rows = text.split(/\r?\n/).filter((row) => row.length > 0)
      if (rows.length && rows.some((row) => row.includes('\t'))) {
        const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
        html = `<table><tbody>${rows.map((row) => `<tr>${row.split('\t').map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      } else {
        document.execCommand('insertText', false, text)
        updateValue()
        return
      }
    }
    const safeHtml = sanitizePolicyHtml(html)
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) {
      editorRef.current?.focus()
      const range = document.createRange()
      range.selectNodeContents(editorRef.current!)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    range.deleteContents()
    const fragment = range.createContextualFragment(safeHtml)
    const lastNode = fragment.lastChild
    range.insertNode(fragment)
    if (lastNode) {
      range.setStartAfter(lastNode)
      range.collapse(true)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    updateValue()
  }
  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRangeRef.current = selection.getRangeAt(0).cloneRange()
  }
  const command = (name: string, argument?: string) => {
    editorRef.current?.focus()
    document.execCommand(name, false, argument)
    updateValue()
  }
  const applyInlineStyle = (property: 'fontFamily' | 'fontSize' | 'color' | 'backgroundColor', value: string) => {
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
  const applyColorPair = (index: number) => {
    setActiveColorPair(index)
    const selection = window.getSelection()
    if ((!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) && savedRangeRef.current) {
      selection?.removeAllRanges()
      selection?.addRange(savedRangeRef.current)
    }
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0)
    if (range.collapsed) return
    const span = document.createElement('span')
    span.style.color = policyColorPairs[index].color
    span.style.backgroundColor = policyColorPairs[index].highlight
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
      <div className="policy-color-pairs" role="radiogroup" aria-label="Accessible text and highlight color combinations" onFocus={saveSelection}>
        {policyColorPairs.map((pair, index) => <button key={`${pair.text}-${pair.background}`} type="button" role="radio" aria-checked={activeColorPair === index} aria-label={`${pair.text} text on ${pair.background} highlight`} title={`${pair.text} text on ${pair.background} highlight`} className="policy-color-pair" onMouseDown={(event) => event.preventDefault()} onClick={() => applyColorPair(index)}>
          <span aria-hidden="true" style={{ color: pair.color, backgroundColor: pair.highlight }}>Aa</span>
        </button>)}
      </div>
      <span className="policy-toolbar-divider" />
      {toolbarButton('Bulleted list', <List size={16} />, () => command('insertUnorderedList'))}
      {toolbarButton('Numbered list', <ListOrdered size={16} />, () => command('insertOrderedList'))}
      {toolbarButton('Add link', <Link2 size={15} />, () => { const href = window.prompt('Enter a web address'); if (href) command('createLink', href) })}
    </div>
    <div ref={editorRef} className="policy-content-editable" style={{ whiteSpace: 'pre-wrap' }} contentEditable role="textbox" aria-label="Policy content" aria-multiline="true" data-placeholder="Write the policy here. Use headings to organize sections…" onInput={updateValue} onBlur={updateValue} onKeyUp={saveSelection} onMouseUp={saveSelection} onPaste={pasteContent} />
  </div>
}

async function openPolicyAttachment(attachment: PolicyAttachment) {
  try {
    const blob = await api.download(`/handbook/attachments/${attachment.id}`)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = attachment.fileName; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (cause) {
    window.alert(cause instanceof ApiError ? cause.message : 'Could not open this attachment.')
  }
}

function downloadPolicyDocument(article: HandbookArticle) {
  const primaryAttachment = article.attachments?.find((attachment) => attachment.mimeType === 'application/pdf') ?? article.attachments?.[0]
  if (primaryAttachment) {
    void openPolicyAttachment(primaryAttachment)
    return
  }

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(article.title)}</title><style>body{max-width:850px;margin:48px auto;padding:0 24px;color:#263249;font:16px/1.7 Arial,sans-serif}h1{line-height:1.25} .meta{color:#667085;font-size:13px;border-bottom:1px solid #dce2ea;padding-bottom:16px;margin-bottom:24px}</style></head><body><p class="meta">${escapeHtml(article.category)} · Fluidé Homes Policy</p><h1>${escapeHtml(article.title)}</h1>${article.summary ? `<p class="meta">${escapeHtml(article.summary)}</p>` : ''}<main>${sanitizePolicyHtml(article.content)}</main></body></html>`
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${article.slug || 'policy'}.html`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function ArticleDialog({
  article,
  canManagePublication,
  onClose,
  onSave,
  onDeleteAttachment,
}: {
  article: HandbookArticle | null
  canManagePublication: boolean
  onClose: () => void
  onSave: (fields: ArticleFields, files: File[]) => Promise<void>
  onDeleteAttachment: (attachmentId: string) => Promise<void>
}) {
  const [fields, setFields] = useState<ArticleFields>(() => ({
    ...articleFields(article),
    ...(!article ? { isPublished: true } : {}),
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<PolicyAttachment[]>(article?.attachments ?? [])
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)

  useEffect(() => { setExistingAttachments(article?.attachments ?? []) }, [article])

  async function removeExistingAttachment(attachment: PolicyAttachment) {
    if (deletingAttachmentId) return
    setDeletingAttachmentId(attachment.id)
    setError('')
    try {
      await onDeleteAttachment(attachment.id)
      setExistingAttachments((current) => current.filter((file) => file.id !== attachment.id))
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to remove this attachment.')
    } finally {
      setDeletingAttachmentId(null)
    }
  }

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
      setError(policySaveError(cause))
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
            {existingAttachments.length > 0 && <div className="employee-form-full policy-existing-files"><span>Already attached</span>{existingAttachments.map((file) => <div className="policy-existing-file" key={file.id}>
              <button className="policy-existing-file-open" type="button" onClick={() => void openPolicyAttachment(file)}><Paperclip size={14} />{file.fileName}</button>
              {canManagePublication && <button className="policy-existing-file-remove" type="button" onClick={() => void removeExistingAttachment(file)} disabled={deletingAttachmentId !== null || saving} aria-label={`Remove ${file.fileName}`} title={`Remove ${file.fileName}`}>{deletingAttachmentId === file.id ? <LoaderCircle className="loading-icon" size={14} /> : <Trash2 size={14} />}</button>}
            </div>)}</div>}
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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [deletingArticleId, setDeletingArticleId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const canRead = hasPermission('handbook:read')
  const canCreate = hasPermission('handbook:create')
  const canUpdate = hasPermission('handbook:update')
  const canDelete = hasPermission('handbook:delete')

  useEffect(() => {
    const linkedId = searchParams.get('article')
    if (!linkedId || isLoading) return
    const linkedArticle = articles.find((article) => article.id === linkedId)
    if (linkedArticle) {
      setSelectedArticle(linkedArticle)
      return
    }
    let cancelled = false
    void api.get<HandbookArticle>(`/handbook/${encodeURIComponent(linkedId)}`).then((article) => {
      if (!cancelled) setSelectedArticle(article)
    }).catch(() => {
      if (!cancelled) setNotice('This policy is unavailable or you do not have permission to view it.')
    })
    return () => { cancelled = true }
  }, [articles, isLoading, searchParams])

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

  function closeSelectedArticle() {
    setSelectedArticle(null)
    if (searchParams.has('article')) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('article')
      setSearchParams(nextParams, { replace: true })
    }
  }

  function announcementNotice(title: string, announcement: HandbookArticle['emailAnnouncement']) {
    if (announcement?.error) return `${title} was published, but the email announcement could not be prepared.`
    if (announcement?.attempted === 0) return `${title} was published, but no active staff accounts have policy access.`
    if (announcement && announcement.failed > 0) return `${title} was published and emailed to ${announcement.sent} of ${announcement.attempted} staff accounts; ${announcement.failed} email(s) failed.`
    if (announcement) return `${title} was published and emailed to ${announcement.sent} staff members.`
    return `${title} was published.`
  }

  async function saveArticle(fields: ArticleFields, files: File[]) {
    const shouldPublish = canUpdate ? fields.isPublished : true
    const payload = {
      title: fields.title.trim(),
      ...(fields.slug.trim() && { slug: fields.slug.trim() }),
      summary: fields.summary.trim() || null,
      category: fields.category.trim(),
      content: sanitizePolicyHtml(fields.content).trim(),
      isPublished: articleDialog ? shouldPublish : false,
    }
    if (articleDialog) {
      const createOnlyDraft = !canUpdate && !articleDialog.isPublished
      const publishAfterUploads = shouldPublish && !articleDialog.isPublished && (files.length > 0 || createOnlyDraft)
      let updated = createOnlyDraft
        ? articleDialog
        : await api.patch<HandbookArticle>(`/handbook/${articleDialog.id}`, publishAfterUploads ? { ...payload, isPublished: false } : payload)
      const remainingFiles = files.filter((file) => !updated.attachments.some((attachment) => attachment.fileName === file.name && attachment.size === file.size))
      for (const file of remainingFiles) {
        const attachment = await api.uploadFile<PolicyAttachment>(`/handbook/${updated.id}/attachments`, file)
        updated = { ...updated, attachments: [...updated.attachments, attachment] }
        setArticleDialog(updated)
      }
      if (publishAfterUploads && shouldPublish) {
        updated = createOnlyDraft
          ? await api.post<HandbookArticle>(`/handbook/${updated.id}/publish`, {})
          : await api.patch<HandbookArticle>(`/handbook/${updated.id}`, { isPublished: true })
      }
      setSelectedArticle((current) => current?.id === updated.id ? updated : current)
      setIsLoading(true)
      setReloadKey((key) => key + 1)
      setNotice(updated.emailAnnouncement
        ? announcementNotice(updated.title, updated.emailAnnouncement)
        : `${updated.title} was updated.`)
    } else {
      let created = await api.post<HandbookArticle>('/handbook', payload)
      const attachments: PolicyAttachment[] = []
      for (const file of files) attachments.push(await api.uploadFile<PolicyAttachment>(`/handbook/${created.id}/attachments`, file))
      if (shouldPublish) created = await api.post<HandbookArticle>(`/handbook/${created.id}/publish`, {})
      if (created.isPublished && attachments.length) setSelectedArticle({ ...created, attachments })
      setNotice(created.isPublished
        ? announcementNotice(created.title, created.emailAnnouncement)
        : `${created.title} was created as a draft.`)
      setPage(1)
      setSearch('')
      setSearchInput('')
      setCategory('ALL')
      setIsLoading(true)
      setReloadKey((key) => key + 1)
    }
    setArticleDialog(undefined)
  }

  async function removePolicyAttachment(articleId: string, attachmentId: string) {
    await api.delete<{ id: string; deleted: boolean }>(`/handbook/${encodeURIComponent(articleId)}/attachments/${encodeURIComponent(attachmentId)}`)
    const withoutAttachment = (article: HandbookArticle) => article.id === articleId
      ? { ...article, attachments: article.attachments.filter((attachment) => attachment.id !== attachmentId) }
      : article
    setArticles((current) => current.map(withoutAttachment))
    setSelectedArticle((current) => current ? withoutAttachment(current) : current)
    setArticleDialog((current) => current?.id === articleId ? withoutAttachment(current) : current)
  }

  async function deleteArticle(article: HandbookArticle) {
    if (deletingArticleId) return
    if (!window.confirm(`Delete the policy “${article.title}”? This cannot be undone.`)) return

    setDeletingArticleId(article.id)
    setNotice('')
    try {
      await api.delete<{ id: string; deleted: boolean }>(`/handbook/${article.id}`)
      setSelectedArticle((current) => current?.id === article.id ? null : current)
      setArticles((current) => current.filter((item) => item.id !== article.id))
      if (searchParams.get('article') === article.id) closeSelectedArticle()
      setIsLoading(true)
      setReloadKey((key) => key + 1)
      setNotice(`${article.title} was deleted.`)
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : `Unable to delete ${article.title}.`)
    } finally {
      setDeletingArticleId(null)
    }
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
                  <button className="handbook-article-title" type="button" onClick={() => { setSelectedArticle(article); const nextParams = new URLSearchParams(searchParams); nextParams.set('article', article.id); setSearchParams(nextParams, { replace: true }) }}>{article.title}</button>
                  {article.summary && <p>{article.summary}</p>}
                  <span className="handbook-article-date">{article.isPublished ? `Published ${formatArticleDate(article.publishedAt)}` : `Updated ${formatArticleDate(article.updatedAt)}`}</span>
                  <div className="policy-card-resources">
                    <button className="policy-view-action" type="button" onClick={() => { setSelectedArticle(article); const nextParams = new URLSearchParams(searchParams); nextParams.set('article', article.id); setSearchParams(nextParams, { replace: true }) }}>View policy</button>
                    {article.attachments?.length > 0 && <div className="policy-card-attachments" aria-label={`Attachments for ${article.title}`}>
                      {article.attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => void openPolicyAttachment(attachment)} aria-label={`Download ${attachment.fileName}`} title={`Download ${attachment.fileName}`}>
                        <Download size={13} aria-hidden="true" /><span>{attachment.fileName}</span><small>{(attachment.size / (1024 * 1024)).toFixed(1)} MB</small>
                      </button>)}
                    </div>}
                  </div>
                </div>
                <div className="policy-card-actions">
                  <button className="policy-card-download" type="button" onClick={() => downloadPolicyDocument(article)}><Download size={13} aria-hidden="true" /> Download Policy</button>
                  {canUpdate && <button className="icon-button" type="button" onClick={() => setArticleDialog(article)} aria-label={`Edit ${article.title}`}><Pencil size={15} /></button>}
                  {canDelete && <button className="icon-button danger-icon-button" type="button" onClick={() => void deleteArticle(article)} aria-label={`Delete ${article.title}`} disabled={deletingArticleId === article.id}>{deletingArticleId === article.id ? <LoaderCircle className="loading-icon" size={15} /> : <Trash2 size={15} />}</button>}
                </div>
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

      {articleDialog !== undefined && <ArticleDialog article={articleDialog} canManagePublication={canUpdate} onClose={() => setArticleDialog(undefined)} onSave={saveArticle} onDeleteAttachment={(attachmentId) => articleDialog ? removePolicyAttachment(articleDialog.id, attachmentId) : Promise.resolve()} />}
      {selectedArticle && (
        <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSelectedArticle() }}>
          <article className="employee-dialog handbook-reader" role="dialog" aria-modal="true" aria-labelledby="handbook-reader-title">
            <header className="employee-dialog-header">
              <div><p className="eyebrow">{selectedArticle.category}{!selectedArticle.isPublished ? ' · DRAFT' : ''}</p><h2 id="handbook-reader-title">{selectedArticle.title}</h2></div>
              <button className="icon-button" type="button" onClick={closeSelectedArticle} aria-label="Close policy"><X size={19} /></button>
            </header>
            <div className="handbook-reader-meta"><span>{selectedArticle.isPublished ? `Published ${formatArticleDate(selectedArticle.publishedAt)}` : 'Unpublished draft'}</span>{selectedArticle.createdBy && <span>By {selectedArticle.createdBy.firstName} {selectedArticle.createdBy.lastName}</span>}</div>
            {selectedArticle.summary && <p className="handbook-reader-summary">{selectedArticle.summary}</p>}
            <div className="handbook-reader-content" dangerouslySetInnerHTML={{ __html: sanitizePolicyHtml(selectedArticle.content) }} />
            {selectedArticle.attachments?.length > 0 && <section className="policy-reader-files" aria-label="Policy attachments"><h3>Policy files</h3>{selectedArticle.attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => void openPolicyAttachment(attachment)}><span className="policy-attachment-icon"><FileText size={16} /></span><span><strong>{attachment.fileName}</strong><small>{attachment.mimeType === 'application/pdf' ? 'PDF document' : attachment.mimeType.split('/').pop()?.toUpperCase()} · {(attachment.size / (1024 * 1024)).toFixed(1)} MB</small></span><ArrowLeft className="policy-file-open-icon" size={15} /></button>)}</section>}
            <footer className="handbook-reader-actions">
              <button className="button-secondary" type="button" onClick={closeSelectedArticle}><ArrowLeft size={15} /> Back to policies</button>
              {canUpdate && <button className="button-primary" type="button" onClick={() => { setArticleDialog(selectedArticle); closeSelectedArticle() }}><Pencil size={14} /> Edit policy</button>}
              {canDelete && <button className="button-secondary danger-icon-button" type="button" onClick={() => void deleteArticle(selectedArticle)} disabled={deletingArticleId === selectedArticle.id}>{deletingArticleId === selectedArticle.id ? <LoaderCircle className="loading-icon" size={15} /> : <Trash2 size={14} />} Delete policy</button>}
            </footer>
          </article>
        </div>
      )}
    </section>
  )
}
