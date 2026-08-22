import { useEffect, useRef, useState } from 'react'
import {
  Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Columns3, Database, Download, FileSearch, Filter, FlaskConical, Gauge, Languages,
  LibraryBig, ListChecks, LoaderCircle, LogOut, Menu, MessageSquareText, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
  Plus, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, UserPlus, Users, X,
} from 'lucide-react'
import { useAuth } from './lib/auth.jsx'
import { api } from './lib/api.js'
import { isDemoMode, isFirebaseConfigured } from './lib/firebase.js'

const criteria = [
  {
    key: 'adequacy',
    name: 'Adequacy',
    hint: 'Is all source information represented?',
    levels: [
      'Important information is missing, added, or incorrect.',
      'The main information is present, with a minor omission or addition.',
      'All important information is represented.',
    ],
  },
  {
    key: 'fluency',
    name: 'Fluency',
    hint: 'Does the Bengali read naturally?',
    levels: [
      'The Bengali is difficult to understand or seriously ungrammatical.',
      'It is understandable but has awkward wording or minor grammar problems.',
      'It reads as natural, fluent Bengali.',
    ],
  },
  {
    key: 'semantic',
    name: 'Semantic preservation',
    hint: 'Is the original meaning retained?',
    levels: [
      'The original meaning is materially changed.',
      'The core meaning remains, with a minor shift.',
      'The original meaning is fully retained.',
    ],
  },
]
const ratingLabels = ['Major problem', 'Minor problem', 'No substantive problem']
const ratingButtonLabels = ['Major', 'Minor', 'No issue']
const issueOptions = ['Mistranslation', 'Missing content', 'Added content', 'Grammar', 'Name transliteration', 'Mixed script']

function prettyCategory(value = '') {
  return value.split(',').map((part) => part.replaceAll('_', ' ')).join(' · ')
}

function formatKappa(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toFixed(2)
}

function kappaLabel(value) {
  if (value === null || value === undefined) return 'Waiting for complete items'
  if (value >= 0.81) return 'Almost perfect'
  if (value >= 0.61) return 'Substantial'
  if (value >= 0.41) return 'Moderate'
  if (value >= 0.21) return 'Fair'
  return 'Slight'
}

function Spinner({ label = 'Loading workspace' }) {
  return <div className="full-loader"><LoaderCircle className="spin" size={24} /><span>{label}</span></div>
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [message, onClose])
  if (!message) return null
  return <div className="toast"><CheckCircle2 size={17} />{message}</div>
}

function Login() {
  const { signIn, demoSignIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try { await signIn(email, password) } catch (requestError) { setError(requestError.message) } finally { setBusy(false) }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand brand-light"><span className="brand-mark"><Languages size={20} /></span><span>Onubad Review</span></div>
        <div className="story-copy">
          <p className="eyebrow light">CoSafe · Bengali 12B</p>
          <h1>Meaning, measured<br />with human judgment.</h1>
          <p>A focused workspace for independent review of 500 translated conversations—built for rigor, clarity, and a defensible thesis.</p>
        </div>
        <div className="study-note">
          <div className="study-note-icon"><FlaskConical size={19} /></div>
          <div><strong>Study protocol</strong><span>3 annotators · 3 criteria · 3-point scale</span></div>
        </div>
        <div className="script-motif" aria-hidden="true">অ</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand brand"><span className="brand-mark"><Languages size={20} /></span><span>Onubad Review</span></div>
          <p className="eyebrow">Secure study access</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with the account created by your study administrator.</p>
          {!isFirebaseConfigured && !isDemoMode && <div className="alert">Firebase is not configured. Add the VITE_FIREBASE_* variables to continue.</div>}
          {error && <div className="alert error">{error}</div>}
          <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@university.edu" required /></label>
          <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          <button className="button primary wide" disabled={busy || !isFirebaseConfigured} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}Sign in securely</button>
          {isDemoMode && <div className="demo-box">
            <span>Interface preview</span>
            <div><button type="button" className="button secondary" onClick={() => demoSignIn('annotator')}>Annotator view</button><button type="button" className="button secondary" onClick={() => demoSignIn('admin')}>Admin view</button></div>
          </div>}
          <p className="privacy-note"><ShieldCheck size={14} /> Access and submissions are recorded for study integrity.</p>
        </form>
      </section>
    </main>
  )
}

const adminNavigation = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'sample', label: 'Sample set', icon: Database },
  { id: 'dataset', label: 'Full dataset', icon: LibraryBig },
  { id: 'updates', label: 'Annotation updates', icon: ListChecks },
  { id: 'comparison', label: 'Compare ratings', icon: Columns3 },
  { id: 'people', label: 'Annotators', icon: Users },
]

function Shell({ active, setActive, children, annotationMode = false }) {
  const { user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => annotationMode && localStorage.getItem('cosafe-sidebar-collapsed') === 'true')
  const navigation = annotationMode ? [{ id: 'annotate', label: 'Review workspace', icon: ClipboardCheck }] : adminNavigation
  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem('cosafe-sidebar-collapsed', String(next))
      return next
    })
  }
  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobileOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="brand"><span className="brand-mark"><Languages size={19} /></span><span className="brand-name">Onubad Review</span></div>
        {annotationMode && <button className="sidebar-collapse-button" onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand navigation panel' : 'Minimize navigation panel'} aria-label={sidebarCollapsed ? 'Expand navigation panel' : 'Minimize navigation panel'}>{sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>}
        <div className="study-label"><span>Active study</span><strong>CoSafe Bengali 12B</strong><small>Translation quality evaluation</small></div>
        <nav>{navigation.map(({ id, label, icon: Icon }) => <button key={id} title={sidebarCollapsed ? label : undefined} className={active === id ? 'active' : ''} onClick={() => { setActive?.(id); setMobileOpen(false) }}><Icon size={18} /><span>{label}</span></button>)}</nav>
        <div className="sidebar-bottom">
          <div className="role-pill"><ShieldCheck size={14} />{user.role === 'admin' ? 'Administrator' : 'Independent annotator'}</div>
          <div className="user-block"><span className="avatar">{user.displayName?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{user.displayName}</strong><small>{user.email}</small></span><button title="Sign out" onClick={signOut}><LogOut size={17} /></button></div>
        </div>
      </aside>
      <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><Menu size={20} /></button>
      <div className="main-surface">{children}</div>
    </div>
  )
}

function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="header-actions">{actions}</div>}</header>
}

function EmptyState({ icon: Icon = FileSearch, title, text }) {
  return <div className="empty-state"><span><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></div>
}

function Overview({ stats, loading, onRefresh, onExport }) {
  if (loading) return <Spinner label="Calculating study progress" />
  const totalSubmitted = stats.progress.reduce((sum, user) => sum + user.submitted, 0)
  const totalPossible = stats.sampleSize * stats.progress.length
  const overall = totalPossible ? Math.round((totalSubmitted / totalPossible) * 100) : 0
  return <>
    <PageHeader eyebrow="Study command center" title="Annotation overview" description="A live view of sentence-level sample coverage, annotator pace, and rating consistency." actions={<><button className="button secondary" onClick={onExport}><Download size={16} />Download CSV</button><button className="button secondary" onClick={onRefresh}><RefreshCw size={16} />Refresh</button></>} />
    <div className="metric-grid">
      <article className="metric feature"><div className="metric-icon"><ClipboardCheck size={21} /></div><span>Submitted ratings</span><strong>{totalSubmitted}<small> / {totalPossible || 0}</small></strong><div className="progress-track"><i style={{ width: `${overall}%` }} /></div><small>{overall}% of all assigned reviews</small></article>
      <article className="metric"><div className="metric-icon plum"><Database size={20} /></div><span>Active sample</span><strong>{stats.sampleSize}</strong><small>English–Bengali sentence pairs</small></article>
      <article className="metric"><div className="metric-icon gold"><Users size={20} /></div><span>Annotators</span><strong>{stats.progress.length}</strong><small>independent reviewers</small></article>
      <article className="metric"><div className="metric-icon blue"><CheckCircle2 size={20} /></div><span>Triple-reviewed</span><strong>{stats.agreement.completeItems}</strong><small>ready for agreement analysis</small></article>
    </div>
    <div className="dashboard-grid">
      <section className="panel progress-panel"><div className="panel-heading"><div><p className="eyebrow">Individual state</p><h2>Annotator progress</h2></div><span className="quiet-badge">{stats.sampleSize} each</span></div>
        {stats.progress.length ? <div className="annotator-list">{stats.progress.map((person) => {
          const percent = person.total ? Math.round((person.submitted / person.total) * 100) : 0
          return <div className="annotator-row" key={person.uid}><span className="avatar coral">{person.displayName?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div className="annotator-info"><strong>{person.displayName}</strong><span>{person.submitted} submitted · {person.drafts} drafts</span><div className="progress-track"><i style={{ width: `${percent}%` }} /></div></div><strong className="percent">{percent}%</strong><button className="icon-button" title="More actions"><MoreHorizontal size={18} /></button></div>
        })}</div> : <EmptyState title="No annotators yet" text="Create three annotator accounts to begin the study." />}
      </section>
      <section className="panel agreement-panel"><div className="panel-heading"><div><p className="eyebrow">Inter-annotator agreement</p><h2>Fleiss’ κ</h2></div><CircleHelp size={17} className="muted-icon" /></div>
        <p className="panel-intro">Exact-category agreement across items completed by every active annotator.</p>
        <div className="kappa-list">{criteria.map((criterion) => { const value = stats.agreement.kappa[criterion.key]; return <div key={criterion.key}><div><span>{criterion.name}</span><strong>{formatKappa(value)}</strong></div><div className="kappa-scale"><i style={{ width: `${Math.max(0, (value || 0) * 100)}%` }} /></div><small>{kappaLabel(value)}</small></div> })}</div>
        <div className="method-note"><FlaskConical size={16} /><span>The three-level ratings are ordinal; report exact Fleiss’ κ with percentage agreement.</span></div>
      </section>
    </div>
  </>
}

function SampleManager({ sample, loading, refresh, toast }) {
  const [seed, setSeed] = useState(sample?.study?.seed || 'cosafe-thesis-2026')
  const [count, setCount] = useState(sample?.study?.targetSize || 500)
  const [generating, setGenerating] = useState(false)
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 50

  useEffect(() => { if (sample?.study?.seed) setSeed(sample.study.seed) }, [sample])
  const visible = (sample?.items || []).filter((item) => `${item.id} ${item.category} ${item.originalText} ${item.translatedText}`.toLowerCase().includes(search.toLowerCase()))
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize))
  const pagedItems = visible.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [search])

  async function generate() {
    setGenerating(true)
    try { await api.post('/admin/sample/generate', { count: Number(count), seed }); toast(`Generated a reproducible ${count}-item sample`); await refresh() } finally { setGenerating(false) }
  }
  async function remove(itemId) { await api.delete(`/admin/sample/items/${itemId}`); toast('Item removed from the active sample'); await refresh() }
  async function openAdd() { setShowAdd(true); setCandidates(await api.get('/admin/items/search')) }
  async function add(itemId) { await api.post('/admin/sample/items', { itemId }); toast('Item added to the active sample'); setShowAdd(false); await refresh() }
  async function deleteSample() {
    if (!window.confirm(`Delete the entire active sample of ${sample?.items?.length || 0} sentences? Existing annotation records will be preserved, but the sample will no longer be assigned.`)) return
    const result = await api.delete('/admin/sample')
    toast(`Deleted the active sample (${result.removed} items removed)`)
    await refresh()
  }

  if (loading) return <Spinner label="Loading sample set" />
  return <>
    <PageHeader eyebrow="Sampling & curation" title="Build the 500-sentence sample" description="Generate a balanced random sample of aligned English–Bengali sentences, then inspect or curate every selected unit." actions={<><button className="button secondary danger-outline" disabled={!sample?.items?.length} onClick={deleteSample}><Trash2 size={16} />Delete sample</button><button className="button primary" onClick={openAdd}><Plus size={16} />Add sentence</button></>} />
    <section className="sampling-card">
      <div className="sampling-intro"><span className="big-icon"><Sparkles size={22} /></span><div><h2>Reproducible sentence-level sample</h2><p>Cycles evenly through all 14 CoSafe categories, then shuffles aligned turns with a stored seed.</p></div></div>
      <label className="field compact"><span>Sample size</span><input type="number" min="3" max="1400" value={count} onChange={(event) => setCount(event.target.value)} /></label>
      <label className="field compact seed"><span>Random seed</span><input value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
      <button className="button dark" disabled={generating} onClick={generate}>{generating ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}Generate sample</button>
    </section>
    <section className="panel table-panel">
      <div className="table-toolbar"><div><h2>Full active sample</h2><span>{sample?.items?.length || 0} sentences · Revision {sample?.study?.revision || 0}</span></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all 500 sentences" /></label></div>
      {visible.length ? <div className="data-table sample-table"><div className="table-head"><span>#</span><span>Source location</span><span>Category</span><span>English sentence</span><span>Bengali sentence</span><span /></div>{pagedItems.map((item) => <div className="table-row" key={item.id}><span>{String(item.order).padStart(3, '0')}</span><span><strong>Conversation {item.sourceIndex}</strong><small>Turn {item.turnIndex} · Sentence {item.sentenceIndex || 1} · {item.role}</small>{item.alignmentWarning && <small className="warning-text">Full-turn alignment fallback</small>}</span><span><i className="category-dot" />{prettyCategory(item.category)}</span><span className="sample-text">{item.originalText}</span><span className="sample-text bengali-text" lang="bn">{item.translatedText}</span><button className="icon-button danger" onClick={() => remove(item.id)} title="Remove from sample"><Trash2 size={16} /></button></div>)}</div> : <EmptyState title="No matching sample sentences" text="Try a different search, import sentence pairs, or generate the active sample first." />}
      {visible.length > pageSize && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} />Previous</button><span>Page {page} of {pageCount} · showing all {visible.length} results across pages</span><button className="button secondary" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next<ChevronRight size={15} /></button></div>}
    </section>
    {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}><section className="modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Sentence library</p><h2>Add a replacement sentence</h2></div><button className="icon-button" onClick={() => setShowAdd(false)}><X size={19} /></button></div><p>Select an imported sentence pair to add to the active sample.</p><div className="candidate-list">{candidates.slice(0, 50).map((item) => <button key={item.id} onClick={() => add(item.id)}><span><strong>Row {item.sourceIndex} · Turn {item.turnIndex} · Sentence {item.sentenceIndex || 1}</strong><small>{prettyCategory(item.category)}</small></span><span className="truncate">{item.originalText}</span><Plus size={17} /></button>)}</div></section></div>}
  </>
}

function ConversationPair({ item, compact = false }) {
  if (!item) return null
  const maxMessages = Math.max(item.originalMessages?.length || 0, item.translatedMessages?.length || 0)
  return <div className={`conversation-pair ${compact ? 'compact' : ''}`}>
    <div className="language-column"><div className="language-heading"><span>EN</span><div><strong>Original</strong><small>English source</small></div></div>{Array.from({ length: maxMessages }, (_, index) => { const message = item.originalMessages?.[index]; return message ? <article className={`message ${message.role}`} key={index}><span>{message.role}</span><p>{message.content}</p></article> : <div className="message missing" key={index}>No aligned turn</div> })}</div>
    <div className="language-column bengali" lang="bn"><div className="language-heading"><span>বাং</span><div><strong>বাংলা অনুবাদ</strong><small>Bengali translation</small></div></div>{Array.from({ length: maxMessages }, (_, index) => { const message = item.translatedMessages?.[index]; return message ? <article className={`message ${message.role}`} key={index}><span>{message.role === 'user' ? 'ব্যবহারকারী' : 'সহকারী'}</span><p>{message.content}</p></article> : <div className="message missing" key={index}>অনুপস্থিত বার্তা</div> })}</div>
  </div>
}

function SentencePair({ item, compact = false }) {
  if (!item) return null
  return <div className={`sentence-pair ${compact ? 'compact' : ''}`}>
    <article className="sentence-card english"><div className="language-heading"><span>EN</span><div><strong>Original sentence</strong><small>English · {item.role || 'message'}{item.alignmentWarning ? ' · full-turn fallback' : ''}</small></div></div><p>{item.originalText || <em>Missing English source</em>}</p></article>
    <article className="sentence-card bengali" lang="bn"><div className="language-heading"><span>বাং</span><div><strong>বাংলা অনুবাদ</strong><small>Turn {item.turnIndex} · sentence {item.sentenceIndex || 1}</small></div></div><p>{item.translatedText || <em>বাংলা অনুবাদ অনুপস্থিত</em>}</p></article>
  </div>
}

function HighlightedSentence({ content = '', sentence = '' }) {
  const start = sentence ? content.indexOf(sentence) : -1
  if (start < 0) return content
  return <>{content.slice(0, start)}<mark>{content.slice(start, start + sentence.length)}</mark>{content.slice(start + sentence.length)}</>
}

function ConversationContext({ item, onClose }) {
  const targetTurnRef = useRef(null)
  const targetTurn = Math.max(0, Number(item.turnIndex || 1) - 1)
  const maxMessages = Math.max(item.originalMessages?.length || 0, item.translatedMessages?.length || 0)

  useEffect(() => {
    const frame = requestAnimationFrame(() => targetTurnRef.current?.scrollIntoView({ block: 'center' }))
    function handleKeyDown(event) { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return <div className="modal-backdrop context-backdrop" onMouseDown={onClose}>
    <section className="modal context-modal" role="dialog" aria-modal="true" aria-labelledby="context-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-heading context-heading"><div><p className="eyebrow">Conversation {item.sourceIndex}</p><h2 id="context-title">Conversation context</h2><p>The sentence being rated is highlighted in turn {item.turnIndex}.</p></div><button className="icon-button" onClick={onClose} aria-label="Close conversation context"><X size={19} /></button></div>
      <div className="context-legend"><span><i />Sentence being rated</span><small>{maxMessages} {maxMessages === 1 ? 'turn' : 'turns'} · English and Bengali aligned</small></div>
      <div className="context-turns">
        {Array.from({ length: maxMessages }, (_, index) => {
          const original = item.originalMessages?.[index]
          const translated = item.translatedMessages?.[index]
          const isTarget = index === targetTurn
          const role = original?.role || translated?.role || 'unknown'
          return <article className={`context-turn ${isTarget ? 'target' : ''}`} ref={isTarget ? targetTurnRef : null} key={index}>
            <header><span>Turn {index + 1}</span><strong>{role}</strong>{isTarget && <em><MessageSquareText size={13} />Rated sentence</em>}</header>
            <div className="context-message-grid">
              <div><small>EN · Original</small><p><HighlightedSentence content={original?.content || 'No aligned turn'} sentence={isTarget ? item.originalText : ''} /></p></div>
              <div className="bengali-text" lang="bn"><small>বাং · বাংলা অনুবাদ</small><p><HighlightedSentence content={translated?.content || 'অনুপস্থিত বার্তা'} sentence={isTarget ? item.translatedText : ''} /></p></div>
            </div>
          </article>
        })}
      </div>
    </section>
  </div>
}

function DatasetLibrary() {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true)
    api.get(`/admin/dataset?page=${page}&pageSize=${pageSize}`).then((result) => {
      if (active) setData(result)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page, pageSize])
  const pageCount = Math.max(1, Math.ceil((data?.total || 0) / pageSize))
  return <>
    <PageHeader eyebrow="Source corpus" title="Full paired conversation dataset" description="Browse every original CoSafe conversation beside its Bengali 12B translation. This library remains separate from the 500-sentence annotation sample." actions={<label className="select-control small"><span>Conversations per page</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}><option value="5">5</option><option value="10">10</option><option value="20">20</option></select></label>} />
    <div className="dataset-summary"><Database size={18} /><strong>{data?.total || 0}</strong><span>paired conversations available</span></div>
    {loading ? <Spinner label="Loading paired conversations" /> : data?.items?.length ? <div className="dataset-list">{data.items.map((item) => <section className="dataset-record" key={item.id}><div className="dataset-record-heading"><div><span className="record-id">{item.id}</span><strong>{prettyCategory(item.category)}</strong></div><span>Conversation {item.sourceIndex} · {Math.max(item.originalMessages?.length || 0, item.translatedMessages?.length || 0)} turns</span></div><ConversationPair item={item} /></section>)}</div> : <EmptyState icon={LibraryBig} title="No conversations found" text="Run the Firebase dataset importer to populate the full paired corpus." />}
    {data?.total > pageSize && <div className="pagination standalone"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} />Previous</button><span>Page {page} of {pageCount} · {data.total} conversations total</span><button className="button secondary" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next<ChevronRight size={15} /></button></div>}
  </>
}

function AnnotationUpdates({ data, loading, onRefresh, onExport }) {
  const [status, setStatus] = useState('all')
  const [annotator, setAnnotator] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50
  const updates = data?.updates || []
  const annotators = [...new Map(updates.map((entry) => [entry.userId, { uid: entry.userId, name: entry.annotatorName }])).values()]
  const counts = {
    submitted: updates.filter((entry) => entry.status === 'submitted').length,
    draft: updates.filter((entry) => entry.status === 'draft').length,
    notStarted: updates.filter((entry) => entry.status === 'not-started').length,
  }
  const filtered = updates.filter((entry) => (status === 'all' || entry.status === status) && (annotator === 'all' || entry.userId === annotator) && `${entry.order} ${entry.category} ${entry.originalText} ${entry.translatedText} ${entry.annotatorName}`.toLowerCase().includes(search.toLowerCase()))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => { setPage(1) }, [status, annotator, search])
  if (loading) return <Spinner label="Loading annotation updates" />
  return <>
    <PageHeader eyebrow="Live annotation state" title="Annotation updates" description="See every annotator’s current state for every sampled sentence, including unstarted, draft, and submitted work." actions={<><button className="button secondary" onClick={onExport}><Download size={16} />Download CSV</button><button className="button secondary" onClick={onRefresh}><RefreshCw size={16} />Refresh</button></>} />
    <div className="update-metrics"><article><span>Submitted</span><strong>{counts.submitted}</strong></article><article><span>Draft</span><strong>{counts.draft}</strong></article><article><span>Not started</span><strong>{counts.notStarted}</strong></article><article><span>Total assignments</span><strong>{updates.length}</strong><small>{data?.sampleSize || 0} sentences × {data?.annotatorCount || 0} annotators</small></article></div>
    <section className="panel table-panel updates-panel"><div className="updates-toolbar"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sentences or annotators" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All states</option><option value="submitted">Submitted</option><option value="draft">Draft</option><option value="not-started">Not started</option></select><select value={annotator} onChange={(event) => setAnnotator(event.target.value)}><option value="all">All annotators</option>{annotators.map((person) => <option key={person.uid} value={person.uid}>{person.name}</option>)}</select></div>
      {visible.length ? <div className="data-table updates-table"><div className="table-head"><span>Sample</span><span>Sentence pair</span><span>Annotator</span><span>State</span><span>Ratings A · F · S</span><span>Last update</span></div>{visible.map((entry) => <div className="table-row" key={`${entry.userId}_${entry.itemId}`}><span><strong>#{String(entry.order).padStart(3, '0')}</strong><small>{prettyCategory(entry.category)}</small></span><span><strong className="line-clamp">{entry.originalText}</strong><small className="line-clamp bengali-text" lang="bn">{entry.translatedText}</small></span><span><strong>{entry.annotatorName}</strong><small>{entry.annotatorEmail}</small></span><span><i className={`update-status ${entry.status}`} />{entry.status.replace('-', ' ')}</span><span className="rating-summary"><b>{entry.ratings.adequacy || '—'}</b><b>{entry.ratings.fluency || '—'}</b><b>{entry.ratings.semantic || '—'}</b></span><span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString() : 'No activity'}</span></div>)}</div> : <EmptyState icon={ListChecks} title="No matching updates" text="Change the filters or wait for annotation activity." />}
      {filtered.length > pageSize && <div className="pagination"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} />Previous</button><span>Page {page} of {pageCount} · {filtered.length} assignments</span><button className="button secondary" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Next<ChevronRight size={15} /></button></div>}
    </section>
  </>
}

function Comparison({ sample }) {
  const [selected, setSelected] = useState(sample?.items?.[0]?.id || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const items = sample?.items || []
  const selectedIndex = items.findIndex((item) => item.id === selected)
  useEffect(() => { if (!selected && sample?.items?.[0]) setSelected(sample.items[0].id) }, [sample, selected])
  useEffect(() => {
    if (!selected) return
    setLoading(true)
    api.get(`/admin/comparison/${selected}`).then(setData).finally(() => setLoading(false))
  }, [selected])

  function moveSentence(direction) {
    const nextIndex = selectedIndex + direction
    if (nextIndex >= 0 && nextIndex < items.length) setSelected(items[nextIndex].id)
  }

  return <>
    <PageHeader eyebrow="Item-level evidence" title="Compare annotator judgments" description="Review every independent rating for one translation without exposing annotators to each other during annotation." actions={<div className="comparison-controls"><label className="select-control"><span>Jump to sample item</span><select value={selected} onChange={(event) => setSelected(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>#{item.order} · {prettyCategory(item.category)}</option>)}</select></label><div className="sentence-stepper"><button className="button secondary" disabled={selectedIndex <= 0} onClick={() => moveSentence(-1)}><ChevronLeft size={16} />Previous</button><span><strong>{selectedIndex >= 0 ? selectedIndex + 1 : 0}</strong> of {items.length}</span><button className="button primary" disabled={selectedIndex < 0 || selectedIndex >= items.length - 1} onClick={() => moveSentence(1)}>Next<ChevronRight size={16} /></button></div></div>} />
    {loading ? <Spinner label="Loading comparison" /> : data ? <>
      <section className="comparison-meta"><span className="record-id">{data.item.id}</span><span>{prettyCategory(data.item.category)}</span><span>Source row {data.item.sourceIndex}</span></section>
      <SentencePair item={data.item} compact />
      <section className="panel comparison-panel"><div className="panel-heading"><div><p className="eyebrow">Independent judgments</p><h2>Rating comparison</h2></div><span className="quiet-badge">{data.annotations.filter((entry) => entry.status === 'submitted').length} submitted</span></div>
        <div className="data-table comparison-table"><div className="table-head"><span>Annotator</span>{criteria.map((criterion) => <span key={criterion.key}>{criterion.name}</span>)}<span>Notes & issues</span></div>{data.annotations.map((annotation) => <div className={`table-row ${annotation.status}`} key={annotation.id}><span><strong>{annotation.annotatorName}</strong><small>{annotation.status}</small></span>{criteria.map((criterion) => <span key={criterion.key}><b className={`rating-chip rating-${annotation.ratings[criterion.key]}`}>{annotation.ratings[criterion.key] || '—'}</b><small>{annotation.ratings[criterion.key] ? ratingLabels[annotation.ratings[criterion.key] - 1] : 'Not rated'}</small></span>)}<span><div className="tag-wrap">{annotation.issueTags?.map((tag) => <i key={tag}>{tag}</i>)}</div><small>{annotation.notes || 'No note added'}</small></span></div>)}</div>
      </section>
    </> : <EmptyState title="Choose a sample item" text="Select a record to compare its annotations." />}
  </>
}

function People({ users, loading, refresh, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ displayName: '', email: '', password: '', role: 'annotator' })
  const [busy, setBusy] = useState(false)
  async function create(event) {
    event.preventDefault(); setBusy(true)
    try { await api.post('/admin/users', form); toast(`Created account for ${form.displayName}`); setShowForm(false); setForm({ displayName: '', email: '', password: '', role: 'annotator' }); await refresh() } finally { setBusy(false) }
  }
  async function toggle(user) { await api.patch(`/admin/users/${user.uid}`, { disabled: !user.disabled }); toast(user.disabled ? 'Account reactivated' : 'Account disabled'); await refresh() }
  if (loading) return <Spinner label="Loading annotators" />
  return <>
    <PageHeader eyebrow="Access & assignment" title="Study team" description="Create independent annotator accounts and control access without sharing Firebase Console permissions." actions={<button className="button primary" onClick={() => setShowForm(true)}><UserPlus size={16} />Create user</button>} />
    <section className="panel people-panel"><div className="data-table people-table"><div className="table-head"><span>Team member</span><span>Role</span><span>Access</span><span>Assignment</span><span /></div>{users.map((person) => <div className="table-row" key={person.uid}><span className="person-cell"><span className="avatar coral">{person.displayName?.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><strong>{person.displayName}</strong><small>{person.email}</small></span></span><span className="capitalize">{person.role}</span><span><i className={`status-dot ${person.disabled ? 'off' : ''}`} />{person.disabled ? 'Disabled' : 'Active'}</span><span>{person.role === 'annotator' ? 'Active sample' : 'Study control'}</span><button className="button text" onClick={() => toggle(person)}>{person.disabled ? 'Enable' : 'Disable'}</button></div>)}</div></section>
    <section className="security-callout"><ShieldCheck size={21} /><div><h3>Least-privilege access</h3><p>Annotators can review the active sample and update only their own records. They cannot browse other annotators’ work or modify the sample.</p></div></section>
    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="modal user-modal" onSubmit={create} onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">Firebase Authentication</p><h2>Create a study account</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}><X size={19} /></button></div><div className="form-grid"><label className="field"><span>Full name</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></label><label className="field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label className="field"><span>Temporary password</span><input type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><small>At least 8 characters. Share it privately.</small></label><label className="field"><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="annotator">Annotator</option><option value="admin">Administrator</option></select></label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />}Create account</button></div></form></div>}
  </>
}

function AdminApp() {
  const [active, setActive] = useState('overview')
  const [stats, setStats] = useState(null)
  const [sample, setSample] = useState(null)
  const [users, setUsers] = useState([])
  const [updates, setUpdates] = useState(null)
  const [updatesLoading, setUpdatesLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  async function refresh() {
    setLoading(true)
    try {
      const [nextStats, nextSample, nextUsers] = await Promise.all([api.get('/admin/stats'), api.get('/admin/sample'), api.get('/admin/users')])
      setStats(nextStats); setSample(nextSample); setUsers(nextUsers)
    } finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])
  async function refreshUpdates() {
    setUpdatesLoading(true)
    try { setUpdates(await api.get('/admin/updates')) } finally { setUpdatesLoading(false) }
  }
  useEffect(() => { if (active === 'updates') refreshUpdates() }, [active])
  async function downloadCsv() {
    try {
      const blob = await api.download('/admin/export.csv')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `cosafe-annotation-update-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      setToast('CSV export downloaded')
    } catch (error) { setToast(error.message) }
  }
  return <Shell active={active} setActive={setActive}><main className="page-content">
    {active === 'overview' && <Overview stats={stats || { progress: [], sampleSize: 0, agreement: { completeItems: 0, kappa: {} } }} loading={loading} onRefresh={refresh} onExport={downloadCsv} />}
    {active === 'sample' && <SampleManager sample={sample} loading={loading} refresh={refresh} toast={setToast} />}
    {active === 'dataset' && <DatasetLibrary />}
    {active === 'updates' && <AnnotationUpdates data={updates} loading={updatesLoading} onRefresh={refreshUpdates} onExport={downloadCsv} />}
    {active === 'comparison' && (loading ? <Spinner /> : <Comparison sample={sample} />)}
    {active === 'people' && <People users={users} loading={loading} refresh={refresh} toast={setToast} />}
  </main><Toast message={toast} onClose={() => setToast('')} /></Shell>
}

function ScoringGuide() {
  return <details className="scoring-guide" open><summary><span><CircleHelp size={14} />Scoring guide</span><small>Judge the correction required</small></summary><div className="scale-guide">
    <div><b>1</b><span><strong>Major problem</strong><small>A substantive error that requires major revision.</small></span></div>
    <div><b>2</b><span><strong>Minor problem</strong><small>Core translation is correct but needs minor editing.</small></span></div>
    <div><b>3</b><span><strong>No substantive problem</strong><small>No meaningful correction is required.</small></span></div>
  </div><div className="criterion-guide">{criteria.map((criterion) => <div key={criterion.key}><strong>{criterion.name}</strong>{criterion.levels.map((level, index) => <p key={level}><b>{index + 1}</b><span>{level}</span></p>)}</div>)}</div></details>
}

function RatingGroup({ criterion, value, onChange }) {
  return <fieldset className="rating-group"><legend><span>{criterion.name}</span><button type="button" title={criterion.hint}><CircleHelp size={15} /></button></legend><p>{criterion.hint}</p><div className="rating-buttons">{[1, 2, 3].map((rating) => <button type="button" title={criterion.levels[rating - 1]} className={value === rating ? 'selected' : ''} aria-label={`${criterion.name}: ${rating}, ${ratingLabels[rating - 1]}. ${criterion.levels[rating - 1]}`} key={rating} onClick={() => onChange(rating)}><strong>{rating}</strong><small>{ratingButtonLabels[rating - 1]}</small></button>)}</div>{value ? <p className="selected-anchor"><strong>{ratingLabels[value - 1]}:</strong> {criterion.levels[value - 1]}</p> : <p className="selected-anchor quiet">Select the amount of correction this criterion needs.</p>}</fieldset>
}

function AnnotationApp() {
  const [study, setStudy] = useState(null)
  const [selected, setSelected] = useState('')
  const [item, setItem] = useState(null)
  const [form, setForm] = useState({ ratings: { adequacy: null, fluency: null, semantic: null }, issueTags: [], notes: '', status: 'draft' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState('')
  const [queueCollapsed, setQueueCollapsed] = useState(() => localStorage.getItem('cosafe-queue-collapsed') === 'true')
  const [showContext, setShowContext] = useState(false)

  async function loadStudy() {
    setLoading(true)
    const data = await api.get('/study')
    setStudy(data)
    const firstIncomplete = data.queue.find((entry) => data.annotations[entry.id]?.status !== 'submitted') || data.queue[0]
    setSelected((current) => current || firstIncomplete?.id || '')
    setLoading(false)
  }
  useEffect(() => { loadStudy() }, [])
  useEffect(() => {
    if (!selected || !study) return
    setShowContext(false)
    setItem(null)
    api.get(`/items/${selected}`).then((nextItem) => {
      setItem(nextItem)
      const existing = study.annotations[selected]
      setForm(existing ? { ratings: existing.ratings, issueTags: existing.issueTags || [], notes: existing.notes || '', status: existing.status } : { ratings: { adequacy: null, fluency: null, semantic: null }, issueTags: [], notes: '', status: 'draft' })
    })
  }, [selected, study])

  const queue = study?.queue || []
  const submitted = Object.values(study?.annotations || {}).filter((annotation) => annotation.status === 'submitted').length
  const visibleQueue = queue.filter((entry) => {
    const status = study.annotations[entry.id]?.status || 'not-started'
    return (filter === 'all' || status === filter) && `${entry.order} ${entry.category}`.toLowerCase().includes(search.toLowerCase())
  })
  const currentIndex = queue.findIndex((entry) => entry.id === selected)
  const allRated = Object.values(form.ratings).every(Boolean)

  async function save(status) {
    setSaving(true)
    try {
      await api.put(`/annotations/${selected}`, { ...form, status })
      const annotation = { ...form, status, itemId: selected }
      setStudy((current) => ({ ...current, annotations: { ...current.annotations, [selected]: annotation } }))
      setForm((current) => ({ ...current, status }))
      setToast(status === 'submitted' ? 'Review submitted' : 'Draft saved')
      if (status === 'submitted' && currentIndex < queue.length - 1) setSelected(queue[currentIndex + 1].id)
    } catch (error) { setToast(error.message) } finally { setSaving(false) }
  }
  function toggleIssue(issue) { setForm((current) => ({ ...current, issueTags: current.issueTags.includes(issue) ? current.issueTags.filter((tag) => tag !== issue) : [...current.issueTags, issue] })) }
  function toggleQueue() {
    setQueueCollapsed((current) => {
      localStorage.setItem('cosafe-queue-collapsed', String(!current))
      return !current
    })
  }

  if (loading) return <Shell active="annotate" annotationMode><Spinner /></Shell>
  return <Shell active="annotate" annotationMode><main className="annotation-page">
    <header className="annotation-topbar"><div><p className="eyebrow">Independent review</p><h1>Translation workspace</h1></div><div className="overall-progress"><span><strong>{submitted}</strong> of {queue.length} submitted</span><div className="progress-track"><i style={{ width: `${queue.length ? (submitted / queue.length) * 100 : 0}%` }} /></div></div></header>
    {!queue.length ? <EmptyState icon={Database} title="The sentence sample is not ready" text="Ask the administrator to import sentence pairs and generate the active 500-sentence sample." /> : <div className={`annotation-layout ${queueCollapsed ? 'queue-collapsed' : ''}`}>
      <aside className={`queue-panel ${queueCollapsed ? 'collapsed' : ''}`}><div className="queue-heading"><h2>Sentence queue</h2><span>{queue.length}</span><button className="icon-button" onClick={toggleQueue} title={queueCollapsed ? 'Expand sample queue' : 'Minimize sample queue'}>{queueCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div><label className="search-box"><Search size={15} /><input placeholder="Find sentence" value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="filter-row"><Filter size={14} /><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button><button className={filter === 'submitted' ? 'active' : ''} onClick={() => setFilter('submitted')}>Done</button><button className={filter === 'draft' ? 'active' : ''} onClick={() => setFilter('draft')}>Drafts</button></div><div className="queue-list">{visibleQueue.map((entry) => { const status = study.annotations[entry.id]?.status || 'not-started'; return <button className={selected === entry.id ? 'active' : ''} key={entry.id} onClick={() => setSelected(entry.id)}><span className={`queue-status ${status}`}>{status === 'submitted' ? <Check size={13} /> : entry.order}</span><span><strong>{prettyCategory(entry.category)}</strong><small>Conversation {entry.sourceIndex} · Turn {entry.turnIndex} · Sentence {entry.sentenceIndex || 1}</small></span></button> })}</div></aside>
      <section className="review-canvas"><div className="record-bar"><div><button className="icon-button queue-inline-toggle" onClick={toggleQueue} title={queueCollapsed ? 'Expand sample queue' : 'Minimize sample queue'}>{queueCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button><span>SENTENCE {String(currentIndex + 1).padStart(3, '0')}</span><strong>{prettyCategory(item?.category)}</strong><small>Conversation {item?.sourceIndex} · Turn {item?.turnIndex} · Sentence {item?.sentenceIndex || 1} · {item?.role}</small></div><div className="record-actions"><button className="button secondary context-button" disabled={!item} onClick={() => setShowContext(true)}><MessageSquareText size={15} />View context</button><button className="icon-button" disabled={currentIndex <= 0} onClick={() => setSelected(queue[currentIndex - 1].id)} title="Previous sentence"><ChevronLeft size={18} /></button><button className="icon-button" disabled={currentIndex >= queue.length - 1} onClick={() => setSelected(queue[currentIndex + 1].id)} title="Next sentence"><ChevronRight size={18} /></button></div></div>{item ? <><SentencePair item={item} /><section className="inline-rating-panel"><div className="inline-rating-heading"><div><p className="eyebrow">Your evaluation</p><h2>Rate this translation</h2></div>{form.status === 'submitted' && <span className="submitted-badge"><Check size={14} />Submitted</span>}</div><div className="inline-rating-grid">{criteria.map((criterion) => <RatingGroup key={criterion.key} criterion={criterion} value={form.ratings[criterion.key]} onChange={(rating) => setForm((current) => ({ ...current, ratings: { ...current.ratings, [criterion.key]: rating }, status: 'draft' }))} />)}</div></section></> : <Spinner label="Loading sentence pair" />}</section>
      <aside className="evaluation-panel"><div className="evaluation-heading"><div><p className="eyebrow">Guidance & submission</p><h2>Review details</h2></div></div><ScoringGuide />
        <div className="issues"><span>Translation issues <small>optional</small></span><div>{issueOptions.map((issue) => <button className={form.issueTags.includes(issue) ? 'selected' : ''} key={issue} onClick={() => toggleIssue(issue)}>{form.issueTags.includes(issue) && <Check size={12} />}{issue}</button>)}</div></div>
        <label className="field notes"><span>Reviewer note <small>optional</small></span><textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value, status: 'draft' })} placeholder="Briefly explain a rating or flag an issue…" /></label>
        <div className="evaluation-actions"><button className="button secondary" disabled={saving} onClick={() => save('draft')}>Save draft</button><button className="button primary" disabled={saving || !allRated} onClick={() => save('submitted')}>{saving ? <LoaderCircle className="spin" size={16} /> : <CheckCircle2 size={16} />}Submit & next</button></div>
        {!allRated && <p className="required-note">Complete all three criteria to submit.</p>}
      </aside>
    </div>}
    {showContext && item && <ConversationContext item={item} onClose={() => setShowContext(false)} />}
  </main><Toast message={toast} onClose={() => setToast('')} /></Shell>
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Opening secure workspace" />
  if (!user) return <Login />
  return user.role === 'admin' ? <AdminApp /> : <AnnotationApp />
}
