import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, CircleAlert, ClipboardList, LoaderCircle, MessageCircle, Plus, Send, UsersRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type Channel = { id: string; name: string; headEmployeeId: string | null; headEmployee?: { id: string; firstName: string; lastName: string } | null; _count: { employees: number; chatMessages: number; tasks: number } }
type Message = { id: string; message: string; createdAt: string; sender: { id: string; firstName: string; lastName: string; profilePhoto: string | null } }
type Employee = { id: string; firstName: string; lastName: string }
type Task = { id: string; title: string; description: string | null; dueDate: string | null; status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'; assignee: Employee; assignedBy: Employee | null }

function timeLabel(value: string) { return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }

export function CollaborationPage() {
  const { user, hasPermission } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [selected, setSelected] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Employee[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', description: '', assigneeId: '', dueDate: '' })
  const [savingTask, setSavingTask] = useState(false)
  const canManageAll = hasPermission('employee:update')
  const channel = channels.find((item) => item.id === selected)
  const isHead = Boolean(user?.employee && channel?.headEmployeeId === user.employee.id)
  const canAssign = canManageAll || isHead

  const loadChannels = useCallback(async () => {
    const items = await api.get<Channel[]>('/collaboration/departments')
    setChannels(items)
    setSelected((current) => items.some((item) => item.id === current) ? current : items[0]?.id ?? '')
    setLoading(false)
  }, [])

  const loadContent = useCallback(async (departmentId: string) => {
    try {
      const [nextMessages, nextTasks, nextMembers] = await Promise.all([
        api.get<Message[]>(`/collaboration/departments/${departmentId}/messages`),
        api.get<Task[]>(`/collaboration/departments/${departmentId}/tasks`),
        api.get<Employee[]>(`/collaboration/departments/${departmentId}/employees`),
      ])
      setMessages(nextMessages); setTasks(nextTasks); setMembers(nextMembers); setError('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load this department workspace.')
    }
  }, [])

  useEffect(() => { void loadChannels().catch((cause: unknown) => { setError(cause instanceof ApiError ? cause.message : 'Could not load department channels.'); setLoading(false) }) }, [loadChannels])
  useEffect(() => {
    if (!selected) return
    void loadContent(selected)
    const timer = window.setInterval(() => void loadContent(selected), 6000)
    return () => window.clearInterval(timer)
  }, [selected, loadContent])
  useEffect(() => { const el = document.querySelector('.collaboration-messages'); if (el) el.scrollTop = el.scrollHeight }, [messages])

  const groupedTasks = useMemo(() => ({ open: tasks.filter((task) => task.status !== 'COMPLETED'), completed: tasks.filter((task) => task.status === 'COMPLETED') }), [tasks])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!message.trim() || !selected || sending) return
    setSending(true)
    try { const created = await api.post<Message>(`/collaboration/departments/${selected}/messages`, { message }); setMessages((current) => [...current, created]); setMessage('') }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Message could not be sent.') }
    finally { setSending(false) }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return
    setSavingTask(true)
    try {
      await api.post<Task>(`/collaboration/departments/${selected}/tasks`, { ...taskForm, dueDate: taskForm.dueDate ? new Date(`${taskForm.dueDate}T23:59:00`).toISOString() : undefined })
      setTaskForm({ title: '', description: '', assigneeId: '', dueDate: '' }); setShowTaskForm(false); await loadContent(selected)
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Task could not be assigned.') }
    finally { setSavingTask(false) }
  }

  async function updateStatus(taskId: string, status: Task['status']) {
    try { await api.patch(`/collaboration/tasks/${taskId}`, { status }); if (selected) await loadContent(selected) }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Task could not be updated.') }
  }

  if (loading) return <div className="collab-loading"><LoaderCircle className="loading-icon" />Loading team workspace…</div>
  if (!channels.length) return <section className="collab-empty"><span><UsersRound /></span><h2>No department channel yet</h2><p>Your account needs to be linked to an active department before you can join its team space.</p></section>

  return <section className="collaboration-page" aria-label="Team collaboration">
    <aside className="collab-sidebar">
      <div className="collab-sidebar-heading"><span className="collab-mark"><MessageCircle size={17} /></span><div><strong>Team space</strong><small>Department channels</small></div></div>
      <p className="collab-section-label">YOUR DEPARTMENTS</p>
      <div className="collab-channel-list">{channels.map((item) => <button key={item.id} className={`collab-channel${selected === item.id ? ' is-selected' : ''}`} onClick={() => setSelected(item.id)} type="button"><span className="collab-channel-icon">{item.name.slice(0, 1).toUpperCase()}</span><span className="collab-channel-copy"><strong>{item.name}</strong><small>{item._count.employees} members</small></span><span className="collab-unread-dot" /></button>)}</div>
      {channel?.headEmployee && <div className="collab-head-card"><small>DEPARTMENT HEAD</small><strong>{channel.headEmployee.firstName} {channel.headEmployee.lastName}</strong><span>Task assignments and team support</span></div>}
    </aside>

    <div className="collab-main">
      <header className="collab-header"><div><p className="eyebrow">DEPARTMENT CHANNEL</p><h2>{channel?.name}</h2><span><UsersRound size={14} /> {channel?._count.employees} team members <i>·</i> Messages and tasks</span></div><button className="collab-task-button" type="button" onClick={() => setShowTaskForm((value) => !value)}><ClipboardList size={16} /> Tasks <span>{groupedTasks.open.length}</span></button></header>
      {error && <div className="collab-error" role="alert"><CircleAlert size={16} />{error}<button type="button" onClick={() => setError('')}>Dismiss</button></div>}
      <div className="collab-content">
        <div className="collab-chat-panel"><div className="collab-chat-intro"><span className="collab-intro-icon"><MessageCircle size={18} /></span><div><strong>Welcome to {channel?.name}</strong><p>Share updates and questions with your department.</p></div></div>
          <div className="collaboration-messages" aria-live="polite">{messages.length ? messages.map((item) => <article key={item.id} className={`collab-message${item.sender.id === user?.employee?.id ? ' is-own' : ''}`}><span className="collab-avatar">{item.sender.firstName[0]}{item.sender.lastName[0]}</span><div className="collab-message-body"><div className="collab-message-meta"><strong>{item.sender.id === user?.employee?.id ? 'You' : `${item.sender.firstName} ${item.sender.lastName}`}</strong><time>{timeLabel(item.createdAt)}</time></div><p>{item.message}</p></div></article>) : <div className="collab-no-messages"><MessageCircle size={22} /><strong>Start the conversation</strong><span>Messages for this department will appear here.</span></div>}</div>
          <form className="collab-composer" onSubmit={(event) => void send(event)}><label className="sr-only" htmlFor="collab-message">Message your department</label><textarea id="collab-message" rows={1} maxLength={2000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Message ${channel?.name}…`} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} /><button className="collab-send-button" type="submit" disabled={!message.trim() || sending} aria-label="Send message">{sending ? <LoaderCircle className="loading-icon" size={17} /> : <Send size={17} />}</button></form><p className="collab-composer-hint">Enter to send <span>·</span> Shift + Enter for a new line</p>
        </div>
        <aside className="collab-tasks-panel"><div className="collab-tasks-title"><div><p className="eyebrow">TEAM WORK</p><h3>Tasks</h3></div>{canAssign && <button type="button" className="collab-add-task" onClick={() => setShowTaskForm((value) => !value)} aria-label="Assign a task"><Plus size={17} /></button>}</div>
          {showTaskForm && canAssign && <form className="collab-task-form" onSubmit={(event) => void createTask(event)}><label>Task title<input required minLength={2} maxLength={160} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="What needs to get done?" /></label><label>Assign to<select required value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })}><option value="">Choose a teammate</option>{members.map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></label><label>Due date <span>(optional)</span><input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label><label>Details <span>(optional)</span><textarea rows={2} maxLength={2000} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} /></label><button className="button-primary" type="submit" disabled={savingTask}>{savingTask ? 'Assigning…' : 'Assign task'}</button></form>}
          {!canAssign && <p className="collab-permission-note">Your department head can assign tasks here.</p>}
          <div className="collab-task-group"><h4>TO DO <span>{groupedTasks.open.length}</span></h4>{groupedTasks.open.length ? groupedTasks.open.map((task) => <article className="collab-task-card" key={task.id}><div className="collab-task-card-title"><strong>{task.title}</strong><select aria-label={`Update status for ${task.title}`} value={task.status} disabled={!canManageAll && !isHead && user?.employee?.id !== task.assignee.id && user?.employee?.id !== task.assignedBy?.id} onChange={(event) => void updateStatus(task.id, event.target.value as Task['status'])}><option value="OPEN">To do</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Done</option></select></div>{task.description && <p>{task.description}</p>}<div className="collab-task-footer"><span>For {task.assignee.firstName} {task.assignee.lastName}</span>{task.dueDate && <time>{new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time>}</div></article>) : <p className="collab-task-empty">No open tasks. You’re all caught up.</p>}</div>
          {groupedTasks.completed.length > 0 && <div className="collab-task-group"><h4>COMPLETED <span>{groupedTasks.completed.length}</span></h4>{groupedTasks.completed.slice(0, 5).map((task) => <div className="collab-completed-task" key={task.id}><Check size={14} /><span>{task.title}</span></div>)}</div>}
        </aside>
      </div>
    </div>
  </section>
}
