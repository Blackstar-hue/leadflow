import React, { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, CheckCircle2, ChevronDown, CircleHelp, Clock3, Download, ExternalLink, Filter, LayoutDashboard, ListFilter, Mail, Menu, MoreHorizontal, Phone, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UsersRound, X } from 'lucide-react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const fallbackAssets = [
  { id: 'AG-001', name: 'Premier Plumbing Portsmouth', type: 'Website + GMB', domain: 'premierplumbingportsmouth.xyz', status: 'Connected', leads: 0, phone: '+44 7401 471852', colour: 'blue' },
  { id: 'AG-002', name: 'Premier Gutter and Cladding Portsmouth', type: 'Website + GMB', domain: 'premiergutterandcladdingportsmouth.xyz', status: 'Connected', leads: 0, phone: '+44 7307 273963', colour: 'violet' },
  { id: 'AG-003', name: 'United Masonry Northampton', type: 'Website + GMB', domain: 'unitedmasonrynorthampton.xyz', status: 'Connected', leads: 0, phone: '+44 7576 552408', colour: 'amber' },
  { id: 'PENDING-004', name: 'Ashwood Tree Surgeons Corby', type: 'Website + GMB', domain: 'Domain pending', status: 'Needs setup', leads: 0, phone: 'Phone pending', colour: 'green' },
  { id: 'PENDING-005', name: 'Sunshine Solar Cleaning Corby', type: 'Website + GMB', domain: 'Domain pending', status: 'Needs setup', leads: 0, phone: 'Phone pending', colour: 'rose' },
]

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Lead inbox', icon: Mail, badge: 2 },
  { id: 'assets', label: 'Websites & GMB', icon: BriefcaseBusiness },
  { id: 'renters', label: 'Renters', icon: UsersRound },
]

function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [assets, setAssets] = useState(fallbackAssets)
  const [leads, setLeads] = useState([])
  const [renters, setRenters] = useState([])
  const [rules, setRules] = useState([])
  const [health, setHealth] = useState(null)
  const [authStatus, setAuthStatus] = useState('loading')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [connectionState, setConnectionState] = useState('loading')
  const [selectedLead, setSelectedLead] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All leads')
  const [assetFilter, setAssetFilter] = useState('All assets')
  const [sourceFilter, setSourceFilter] = useState('All sources')
  const [showSidebar, setShowSidebar] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error('auth_unavailable')))
      .then((auth) => {
        if (cancelled) return
        if (auth.authRequired && !auth.authenticated) { setAuthStatus('signed-out'); return }
        setAuthStatus('signed-in')
        return Promise.all([fetch('/api/v1/assets'), fetch('/api/v1/leads'), fetch('/api/v1/renters'), fetch('/api/v1/routing/rules')])
      })
      .then(async (responses) => {
        if (!responses || cancelled) return
        const [assetsResponse, leadsResponse, rentersResponse, rulesResponse] = responses
        if (!assetsResponse.ok || !leadsResponse.ok || !rentersResponse.ok || !rulesResponse.ok) throw new Error('api_unavailable')
        const [remoteAssets, remoteLeads, remoteRenters, remoteRules] = await Promise.all([assetsResponse.json(), leadsResponse.json(), rentersResponse.json(), rulesResponse.json()])
        if (cancelled) return
        if (Array.isArray(remoteAssets)) setAssets(remoteAssets)
        if (Array.isArray(remoteLeads)) setLeads(remoteLeads)
        if (Array.isArray(remoteRenters)) setRenters(remoteRenters)
        if (Array.isArray(remoteRules)) setRules(remoteRules)
        setConnectionState('connected')
      })
      .catch(() => { if (!cancelled) { setAuthStatus('signed-in'); setConnectionState('offline') } })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    fetch('/healthz').then((response) => response.json()).then(setHealth).catch(() => setHealth(null))
  }, [])

  async function signIn(event) {
    event.preventDefault()
    setAuthError('')
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: authEmail, password: authPassword }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setAuthError(body.error || 'Unable to sign in'); return }
    setAuthPassword('')
    setAuthStatus('signed-in')
    window.location.reload()
  }
  const openLeads = leads.filter((lead) => !['Won', 'Lost', 'Spam'].includes(lead.status))
  const newLeads = leads.filter((lead) => lead.status === 'New')
  const unassigned = leads.filter((lead) => !lead.renter || lead.renter === 'Renter not configured')
  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const haystack = [lead.name, lead.phone, lead.service, lead.website, lead.summary, lead.source].join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase()) && (statusFilter === 'All leads' || lead.status === statusFilter) && (assetFilter === 'All assets' || lead.assetId === assetFilter) && (sourceFilter === 'All sources' || lead.source === sourceFilter)
  }), [leads, search, statusFilter, assetFilter, sourceFilter])

  function updateLeadStatus(id, status) {
    setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status } : lead))
    setSelectedLead((current) => current?.id === id ? { ...current, status } : current)
    fetch(`/api/v1/leads/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status }) })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error('status_update_failed')))
      .then((body) => { if (body.lead) { setLeads((current) => current.map((lead) => lead.id === id ? body.lead : lead)); setSelectedLead((current) => current?.id === id ? body.lead : current) } })
      .catch(() => {})
  }

  if (authStatus === 'loading') return <div className="auth-page"><div className="auth-card"><div className="brand-name">leadflow</div><p>Connecting securely…</p></div></div>
  if (authStatus === 'signed-out') return <LoginPage email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} error={authError} onSubmit={signIn} />

  return <div className="app-shell">
    <aside className={`sidebar ${showSidebar ? 'sidebar-open' : ''}`}>
      <div className="brand-row"><div className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /></div><div><div className="brand-name">leadflow</div><div className="brand-subtitle">Rank-and-rent router</div></div><button className="icon-button mobile-close" onClick={() => setShowSidebar(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switcher"><div className="workspace-avatar">RR</div><div className="workspace-copy"><strong>Master workspace</strong><span>5 assets · Demo mode</span></div><ChevronDown size={16} className="muted-icon" /></div>
      <div className="nav-section-label">Workspace</div>
      <nav className="primary-nav">{navItems.map(({ id, label, icon: Icon, badge }) => <button key={id} className={`nav-item ${activePage === id ? 'active' : ''}`} onClick={() => { setActivePage(id); setShowSidebar(false) }}><Icon size={18} /><span>{label}</span>{badge > 0 && <span className="nav-badge">{badge}</span>}</button>)}</nav>
      <div className="nav-section-label nav-section-spaced">Manage</div>
      <nav className="primary-nav"><button className={`nav-item ${activePage === 'routing' ? 'active' : ''}`} onClick={() => setActivePage('routing')}><SlidersHorizontal size={18} /><span>Routing rules</span></button><button className={`nav-item ${activePage === 'reports' ? 'active' : ''}`} onClick={() => setActivePage('reports')}><ListFilter size={18} /><span>Reports & export</span></button><button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => setActivePage('settings')}><Settings size={18} /><span>Settings</span></button></nav>
      <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={17} /><div><strong>Need a hand?</strong><span>View setup checklist</span></div><ExternalLink size={14} /></div><div className="profile-row"><div className="profile-avatar">RC</div><div className="profile-copy"><strong>Ronald Carbone</strong><span>Admin</span></div><MoreHorizontal size={18} className="muted-icon" /></div></div>
    </aside>
    {showSidebar && <button className="sidebar-overlay" onClick={() => setShowSidebar(false)} aria-label="Close menu" />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button menu-toggle" onClick={() => setShowSidebar(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Master workspace</span><span className="breadcrumb-divider">/</span><strong>{pageTitle(activePage)}</strong></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button><button className="help-button"><CircleHelp size={17} /> Help</button><div className="topbar-avatar">RC</div></div></header>
      <div className="demo-banner"><Sparkles size={15} /> {connectionState === 'connected' ? 'Connected to Leadflow API · live database data will appear here' : connectionState === 'loading' ? 'Connecting to Leadflow API…' : 'Local preview · API unavailable, showing blank fallback state'} <button onClick={() => setActivePage('settings')}>Review settings</button></div>
      <div className="page-content">
        {activePage === 'dashboard' && <Dashboard leads={leads} openLeads={openLeads} newLeads={newLeads} unassigned={unassigned} setActivePage={setActivePage} assets={assets} />}
        {activePage === 'inbox' && <Inbox assets={assets} leads={visibleLeads} allLeads={leads} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} assetFilter={assetFilter} setAssetFilter={setAssetFilter} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} onOpenLead={setSelectedLead} />}
        {activePage === 'assets' && <AssetsPage assets={assets} />}
        {activePage === 'renters' && <RentersPage renters={renters} onCreated={(renter) => setRenters((current) => [...current, renter])} />}
        {activePage === 'routing' && <RoutingPage rules={rules} renters={renters} />}
        {activePage === 'reports' && <ReportsPage leads={leads} assets={assets} />}
        {activePage === 'settings' && <SettingsPage health={health} />}
      </div>
    </main>
        {selectedLead && <LeadDetail lead={selectedLead} onClose={() => setSelectedLead(null)} onStatus={updateLeadStatus} />}
  </div>
}

function pageTitle(page) { return ({ dashboard: 'Dashboard', inbox: 'Lead inbox', assets: 'Websites & GMB', renters: 'Renters', routing: 'Routing rules', reports: 'Reports & export', settings: 'Settings' })[page] || 'Dashboard' }

function LoginPage({ email, setEmail, password, setPassword, error, onSubmit }) { return <div className="auth-page"><form className="auth-card" onSubmit={onSubmit}><div className="brand-mark"><Sparkles size={18} strokeWidth={2.5} /></div><div className="brand-name">leadflow</div><h1>Sign in</h1><p>Use the admin account configured for this deployment.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="auth-error">{error}</div>}<button className="primary-button" type="submit">Sign in</button></form></div> }

function Dashboard({ leads, openLeads, newLeads, unassigned, setActivePage, assets }) {
  const connected = assets.filter((asset) => asset.status === 'Connected').length
  return <><section className="page-heading"><div><div className="eyebrow">SATURDAY, 20 SEPTEMBER 2026</div><h1>Good evening, Ronald <span className="wave">✦</span></h1><p>Here is what is happening across your lead assets.</p></div></section>
    <section className="metric-grid"><MetricCard label="Total leads" value={leads.length} note="Across all assets" icon={Mail} tone="blue" onClick={() => setActivePage('inbox')} /><MetricCard label="New leads" value={newLeads.length} note="Need your attention" icon={Sparkles} tone="violet" onClick={() => setActivePage('inbox')} /><MetricCard label="Unassigned" value={unassigned.length} note="Ready to route" icon={UsersRound} tone="amber" onClick={() => setActivePage('routing')} /><MetricCard label="Active assets" value={connected} note={`${assets.length - connected} need setup`} icon={BriefcaseBusiness} tone="green" onClick={() => setActivePage('assets')} /></section>
    <section className="content-grid dashboard-grid"><div className="panel attention-panel"><PanelHeader title="Needs attention" action="View inbox" onAction={() => setActivePage('inbox')} /><div className="attention-list">{newLeads.slice(0, 3).map((lead) => <button className="attention-row" key={lead.id} onClick={() => setActivePage('inbox')}><div className="lead-avatar small">{initials(lead.name)}</div><div><strong>{lead.name}</strong><span>{lead.service} · {lead.received}</span></div><ArrowUpRight size={15} /></button>)}{!newLeads.length && <div className="empty-state compact"><div className="empty-icon"><ShieldCheck size={22} /></div><strong>You are all caught up</strong><p>New form submissions will appear here automatically.</p></div>}</div></div><div className="panel"><PanelHeader title="Lead activity" action="Last 30 days" /><div className="chart-empty">{leads.length ? <><div className="chart-total"><strong>{leads.length}</strong><span>leads received</span></div><div className="chart-bars">{[22, 34, 28, 46, 36, 55, 44, 66, 49, 72, 57, 79].map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div><div className="chart-labels"><span>Aug 22</span><span>Sep 20</span></div></> : <div className="chart-no-data"><Clock3 size={22} /><strong>No lead activity yet</strong><span>Website forms and Twilio calls will appear here when connected.</span></div>}</div></div></section>
    <section className="content-grid dashboard-lower"><div className="panel"><PanelHeader title="Leads by asset" action="View all" onAction={() => setActivePage('assets')} />{assets.slice(0, 3).map((asset) => <div className="mini-bar-row" key={asset.id}><span>{asset.name}</span><div><i style={{ width: `${asset.leads ? Math.max(8, asset.leads / Math.max(1, ...assets.map((item) => item.leads)) * 100) : 0}%` }} /></div><strong>{asset.leads}</strong></div>)}</div><div className="panel"><PanelHeader title="Setup checklist" action="Open assets" onAction={() => setActivePage('assets')} /><ChecklistRow done label="Workspace created" /><ChecklistRow done label="Three sources connected" /><ChecklistRow label="Configure two pending assets" action="Continue" /><ChecklistRow label="Add first renter" action="Continue" /></div></section>
    <section className="panel assets-panel"><PanelHeader title="Your lead assets" action="View all" onAction={() => setActivePage('assets')} /><div className="asset-list">{assets.map((asset) => <AssetRow key={asset.id} asset={asset} />)}</div></section>
  </>
}

function MetricCard({ label, value, note, icon: Icon, tone, onClick }) { return <button className="metric-card" onClick={onClick}><div className={`metric-icon ${tone}`}><Icon size={18} /></div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-note"><span className={value ? 'note-active' : ''}>{note}</span><ArrowUpRight size={13} /></div></button> }
function PanelHeader({ title, action, onAction }) { return <div className="panel-header"><h2>{title}</h2>{action && <button className="text-button" onClick={onAction}>{action}<ArrowUpRight size={14} /></button>}</div> }
function ChecklistRow({ done, label, action }) { return <div className="checklist-row">{done ? <CheckCircle2 size={17} className="check-done" /> : <span className="check-empty" />}<span>{label}</span>{action && <button className="tiny-link">{action}</button>}</div> }
function AssetRow({ asset }) { return <div className="asset-row"><div className={`asset-logo ${asset.colour}`}>{initials(asset.name)}</div><div className="asset-main"><strong>{asset.name}</strong><span>{asset.domain}</span></div><div className="asset-type">{asset.type}</div><div className="asset-leads"><strong>{asset.leads}</strong><span>leads</span></div><div className={`status-pill ${asset.status === 'Connected' ? 'success' : 'warning'}`}><span />{asset.status}</div><button className="icon-button row-more" aria-label={`More options for ${asset.name}`}><MoreHorizontal size={18} /></button></div> }

function Inbox({ assets, leads, allLeads, search, setSearch, statusFilter, setStatusFilter, assetFilter, setAssetFilter, sourceFilter, setSourceFilter, onOpenLead }) {
  const filters = ['All leads', 'New', 'Needs Review', 'Qualified', 'Assigned', 'Contacted', 'Won', 'Lost']
  return <><section className="page-heading"><div><div className="eyebrow">OPERATIONS · {allLeads.length} TOTAL</div><h1>Lead inbox</h1><p>Review, qualify, and route every enquiry from one place.</p></div></section>
    <div className="panel inbox-panel"><div className="inbox-toolbar"><div className="filter-tabs">{filters.map((filter) => <button key={filter} className={statusFilter === filter ? 'selected' : ''} onClick={() => setStatusFilter(filter)}>{filter}{filter === 'New' && <span className="tab-count">{allLeads.filter((lead) => lead.status === 'New').length}</span>}</button>)}</div><div className="toolbar-actions"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, phone or message" /></label><select className="compact-select" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}><option>All assets</option>{assets.filter((asset) => asset.status === 'Connected').map((asset) => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select><select className="compact-select" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>All sources</option><option>Website form</option><option>Twilio call</option><option>GMB enquiry</option></select><button className="secondary-button filter-button"><Filter size={16} /> Filter</button></div></div><div className="inbox-summary"><span><strong>{leads.length}</strong> leads shown</span><span><Clock3 size={14} /> Sorted newest first</span><button onClick={() => window.location.assign('/api/v1/leads/export.csv')}><Download size={14} /> Export CSV</button></div><div className="table-wrap"><table><thead><tr><th>Lead</th><th>Service</th><th>Source asset</th><th>Received</th><th>Status</th><th>Renter</th><th></th></tr></thead><tbody>{leads.length ? leads.map((lead) => <LeadRow key={lead.id} lead={lead} onOpen={() => onOpenLead(lead)} />) : <tr><td colSpan="7"><div className="table-empty"><div className="empty-icon"><Mail size={22} /></div><strong>No leads here</strong><span>Try changing the filters or wait for the next form enquiry.</span></div></td></tr>}</tbody></table></div></div></>
}
function LeadRow({ lead, onOpen }) { return <tr onClick={onOpen} className="clickable-row"><td><div className="lead-cell"><div className="lead-avatar">{initials(lead.name)}</div><div><strong>{lead.name}</strong><span>{lead.phone}</span></div></div></td><td><strong className="service-text">{lead.service}</strong><span className="summary-text">{lead.summary}</span></td><td><span className="asset-source">{lead.website}</span><small className="source-label">{lead.source}</small></td><td><span className="received-text">{lead.received}</span></td><td><StatusPill status={lead.status} /></td><td>{lead.renter && lead.renter !== 'Renter not configured' ? <span className="renter-text">{lead.renter}</span> : <span className="unassigned-text">Unassigned</span>}</td><td><button className="icon-button row-more" onClick={(event) => { event.stopPropagation(); onOpen() }} aria-label="Open lead"><ArrowUpRight size={17} /></button></td></tr> }
function StatusPill({ status }) { const tone = status === 'New' ? 'info' : ['Won', 'Connected'].includes(status) ? 'success' : ['Lost', 'Spam'].includes(status) ? 'danger' : status === 'Needs Review' || status === 'Needs setup' ? 'warning' : 'neutral'; return <span className={`status-pill ${tone}`}><span />{status}</span> }

function LeadDetail({ lead, onClose, onStatus }) { return <div className="modal-backdrop detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="detail-drawer"><div className="detail-header"><div><div className="eyebrow">LEAD · {lead.id}</div><h2>{lead.name}</h2><p>{lead.received} · {lead.source}</p></div><button className="icon-button" onClick={onClose} aria-label="Close lead"><X size={19} /></button></div><div className="detail-body"><div className="detail-status-row"><StatusPill status={lead.status} /><span className="quality-chip"><Sparkles size={13} /> {lead.quality} quality</span><span className={`urgency-text ${lead.urgency.toLowerCase()}`}>{lead.urgency} urgency</span></div><div className="contact-card"><a href={`tel:${lead.phone}`}><Phone size={16} />{lead.phone}</a>{lead.email && <a href={`mailto:${lead.email}`}><Mail size={16} />{lead.email}</a>}</div><DetailSection title="Enquiry"><p className="message-block">{lead.summary}</p><div className="detail-grid"><span>Service<strong>{lead.service}</strong></span><span>Source asset<strong>{lead.website}</strong></span><span>Landing page<strong>Not captured</strong></span><span>Campaign<strong>Organic / direct</strong></span></div></DetailSection><DetailSection title="Assignment"><div className="assignment-box"><UsersRound size={17} /><div><strong>{lead.renter || 'No renter assigned'}</strong><span>{lead.renter ? 'Assignment recorded in demo timeline' : 'No matching renter is configured yet'}</span></div><button className="secondary-button small-button">Assign</button></div></DetailSection><DetailSection title="Event timeline"><div className="timeline"><TimelineItem title="Lead received" detail="Source payload accepted and sanitised" /><TimelineItem title="Categorised" detail={`${lead.service} · ${lead.quality} quality`} /><TimelineItem title={lead.status === 'New' ? 'Awaiting review' : `Status: ${lead.status}`} detail="Event recorded · notification state shown below" /></div></DetailSection><DetailSection title="Update status"><div className="status-actions">{['Needs Review', 'Qualified', 'Contacted', 'Won', 'Lost', 'Spam'].map((status) => <button key={status} className={lead.status === status ? 'selected' : ''} onClick={() => onStatus(lead.id, status)}>{status}</button>)}</div></DetailSection></div></aside></div> }
function DetailSection({ title, children }) { return <section className="detail-section"><h3>{title}</h3>{children}</section> }
function TimelineItem({ title, detail }) { return <div className="timeline-item"><span className="timeline-dot" /><div><strong>{title}</strong><span>{detail}</span></div><small>Today</small></div> }

function AssetsPage({ assets }) { return <><section className="page-heading"><div><div className="eyebrow">WORKSPACE SETUP</div><h1>Websites & GMB</h1><p>Every lead source, connection, and setup task in one view.</p></div><button className="secondary-button"><Plus size={16} /> Add asset</button></section><div className="setup-callout"><div className="callout-icon"><ShieldCheck size={19} /></div><div><strong>Keep source connections separate</strong><span>Each website will receive its own source key. Pending assets stay inactive until their domain, phone, and GMB details are confirmed.</span></div><button className="text-button">Read connection guide <ArrowUpRight size={14} /></button></div><div className="asset-card-grid">{assets.map((asset) => <div className="asset-card" key={asset.id}><div className="asset-card-top"><div className={`asset-logo large ${asset.colour}`}>{initials(asset.name)}</div><StatusPill status={asset.status === 'Connected' ? 'Connected' : 'Needs setup'} /></div><h3>{asset.name}</h3><p>{asset.domain}</p><div className="asset-card-divider" /><div className="asset-card-meta"><span>Asset ID<strong>{asset.id}</strong></span><span>Leads<strong>{asset.leads}</strong></span></div><div className="asset-setup-line"><span className={asset.status === 'Connected' ? 'done-dot' : 'pending-dot'} />{asset.status === 'Connected' ? 'Form connection healthy' : 'Configuration details needed'}</div><button className="card-link">{asset.status === 'Connected' ? 'Open asset' : 'Continue setup'} <ArrowUpRight size={14} /></button></div>)}</div></> }
function RentersPage({ renters, onCreated }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', categories: '' })
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    setError('')
    const response = await fetch('/api/v1/renters', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, categories: form.categories.split(',').map((item) => item.trim()).filter(Boolean) }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setError(body.error || 'Unable to create renter'); return }
    onCreated(body.renter)
    setForm({ name: '', company: '', email: '', phone: '', categories: '' })
    setOpen(false)
  }
  return <><section className="page-heading"><div><div className="eyebrow">DISTRIBUTION</div><h1>Renters</h1><p>Keep real lead destinations and notification preferences organised.</p></div><button className="secondary-button" onClick={() => setOpen(true)}><Plus size={16} /> Add renter</button></section>{open && <form className="panel renter-form" onSubmit={submit}><div className="panel-header"><h2>Add renter</h2><button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close renter form"><X size={18} /></button></div><div className="renter-form-grid"><label>Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Company<input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Service categories<input placeholder="Plumbing, Guttering" value={form.categories} onChange={(event) => setForm({ ...form, categories: event.target.value })} /></label></div>{error && <div className="auth-error">{error}</div>}<button className="primary-button" type="submit">Save renter</button></form>}{renters.length ? <div className="asset-card-grid">{renters.map((renter) => <div className="asset-card" key={renter.id}><div className="asset-card-top"><div className="asset-logo large blue">{initials(renter.name)}</div><StatusPill status={renter.active ? 'Connected' : 'Needs setup'} /></div><h3>{renter.name}</h3><p>{renter.company || 'Independent renter'}</p><div className="asset-card-divider" /><div className="asset-card-meta"><span>Email<strong>{renter.email || 'Not supplied'}</strong></span><span>Priority<strong>{renter.priority}</strong></span></div><div className="asset-setup-line"><span className={renter.available ? 'done-dot' : 'pending-dot'} />{renter.available ? 'Available for routing' : 'Unavailable for routing'}</div></div>)}</div> : <div className="panel"><div className="renter-empty"><div className="empty-icon"><UsersRound size={22} /></div><strong>No renters configured yet</strong><p>There are no renter records in the workspace. Add a real renter when an asset is ready; routing rules will then send matching leads automatically.</p><button className="primary-button" onClick={() => setOpen(true)}><Plus size={16} /> Add first renter</button></div></div>}</>
}
function RoutingPage({ rules, renters }) { return <><section className="page-heading"><div><div className="eyebrow">DISTRIBUTION LOGIC</div><h1>Routing rules</h1><p>Make lead assignment visible, testable, and safe to change.</p></div><button className="secondary-button" disabled><Plus size={16} /> New rule</button></section><div className="content-grid routing-grid"><div className="panel"><PanelHeader title="Active rules" />{rules.length ? rules.map((rule, index) => <div className="rule-card" key={rule.id}><div className="rule-number">{String(index + 1).padStart(2, '0')}</div><div><strong>{rule.name}</strong><span>{Object.keys(rule.conditions || {}).length ? Object.entries(rule.conditions).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ') : 'Fallback rule'}</span><small>Priority {rule.priority} · {rule.renterName || 'No renter configured'}</small></div><span className={`rule-status ${rule.active ? 'active' : ''}`}>{rule.active ? 'Active' : 'Paused'}</span></div>) : <div className="renter-empty"><div className="empty-icon"><SlidersHorizontal size={22} /></div><strong>No routing rules configured</strong><p>Rules will appear here after a real asset, renter, and routing condition have been configured.</p></div>}</div><div className="panel"><PanelHeader title="Routing health" />{rules.length ? <><div className="health-score"><div><strong>{renters.length ? 'Ready to test' : 'Needs renter setup'}</strong><span>{renters.length ? 'Active rules can select from configured renters.' : 'Rules cannot assign leads until a real renter exists.'}</span></div><ShieldCheck size={30} /></div><div className="health-row"><span>Active rules</span><strong>{rules.length}</strong></div><div className="health-row"><span>Available renters</span><strong>{renters.filter((renter) => renter.available && renter.active).length}</strong></div></> : <div className="health-score"><div><strong>Not configured</strong><span>Lead intake remains unassigned until a real routing rule is created.</span></div><ShieldCheck size={30} /></div>}</div></div></> }
function ReportsPage({ leads, assets }) { const won = leads.filter((lead) => lead.status === 'Won').length; return <><section className="page-heading"><div><div className="eyebrow">REPORTING</div><h1>Reports & export</h1><p>Simple operational reporting with the application database as the authority.</p></div><button className="primary-button"><Download size={16} /> Export CSV</button></section><div className="report-cards"><div className="report-card"><span>Conversion rate</span><strong>{leads.length ? Math.round((won / leads.length) * 100) : 0}%</strong><small>Current period · won / total</small></div><div className="report-card"><span>Average response</span><strong>—</strong><small>Available once event timestamps are live</small></div><div className="report-card"><span>Failed notifications</span><strong>0</strong><small>Notifications are disabled</small></div></div><div className="content-grid reports-grid"><div className="panel"><PanelHeader title="Leads by source" action="Export" />{['Website form', 'GMB enquiry', 'Manual demo entry'].map((source) => <div className="mini-bar-row" key={source}><span>{source}</span><div><i style={{ width: `${leads.length ? Math.max(4, leads.filter((lead) => lead.source === source).length / leads.length * 100) : 4}%` }} /></div><strong>{leads.filter((lead) => lead.source === source).length}</strong></div>)}</div><div className="panel"><PanelHeader title="Asset performance" action="Export" />{assets.slice(0, 3).map((asset) => <div className="report-asset-row" key={asset.id}><div className={`asset-logo small ${asset.colour}`}>{initials(asset.name)}</div><span>{asset.name}</span><strong>{leads.filter((lead) => lead.assetId === asset.id).length}</strong></div>)}</div></div></> }
function SettingsPage({ health }) { const databaseReady = health?.databaseHealthy; return <><section className="page-heading"><div><div className="eyebrow">WORKSPACE CONTROLS</div><h1>Settings</h1><p>Integrations and safety controls for the lead operation.</p></div></section><div className="settings-list"><SettingRow icon={ShieldCheck} title="Security & access" detail="Secure sessions, roles, tenant isolation, and audit history" action="Review" /><SettingRow icon={Mail} title="Notifications" detail="Email provider is console-only in demo mode. No renter messages will be sent." action="Configure" warning /><SettingRow icon={CalendarDays} title="Google Sheets bridge" detail="Optional one-way export. The application database remains authoritative." action="Connect" /><SettingRow icon={Phone} title="Call provider" detail="Twilio webhook boundary is ready; forwarding and recording policy remain deployment settings." action="Review" /><SettingRow icon={Clock3} title="Data retention" detail="Raw payload retention and deletion controls are documented for production." action="Configure" /></div><div className="panel environment-panel"><PanelHeader title="Environment health" /><div className="health-row"><span>Mode</span><strong className={health?.persistenceMode === 'postgresql' ? 'good-text' : ''}>{health?.persistenceMode || 'Checking…'}</strong></div><div className="health-row"><span>Database</span><strong className={databaseReady ? 'good-text' : ''}>{databaseReady ? 'Connected and healthy' : health ? 'Not connected or unavailable' : 'Checking…'}</strong></div><div className="health-row"><span>Admin authentication</span><strong className={health?.authConfigured ? 'good-text' : ''}>{health?.authConfigured ? 'Configured' : health ? 'Not configured' : 'Checking…'}</strong></div><div className="health-row"><span>Twilio signing</span><strong className={health?.callWebhookConfigured ? 'good-text' : ''}>{health?.callWebhookConfigured ? 'Token configured' : health ? 'Not configured' : 'Checking…'}</strong></div><div className="health-row"><span>Source keys</span><strong>Never shown in client</strong></div></div></> }
function SettingRow({ icon: Icon, title, detail, action, warning }) { return <div className="setting-row"><div className={`setting-icon ${warning ? 'warning' : ''}`}><Icon size={18} /></div><div><strong>{title}</strong><span>{detail}</span></div><button className="secondary-button small-button">{action}<ArrowUpRight size={14} /></button></div> }
function initials(name) { return name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() }

createRoot(document.getElementById('root')).render(<App />)



