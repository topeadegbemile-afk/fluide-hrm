import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Banknote, Check, CircleAlert, Download, LoaderCircle, Mail, Plus, Save, Wallet, X } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { ApiError, api } from '../lib/api'

type PayItem = { name: string; amount: string }
type PayrollConfiguration = {
  id: string
  basicSalary: string
  benefits: PayItem[]
  additions: PayItem[]
  deductions: PayItem[]
  currency: string
  isEnabled: boolean
  updatedAt: string
}
type PayrollEmployee = {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  grossSalary: string | null
  employmentStatus: string
  monthlyDeductions: PayItem[]
  payrollConfiguration: PayrollConfiguration | null
}
type Payslip = {
  id: string
  employeeName: string
  employeeNumber: string
  recipientEmail: string
  recipientEmails: string[]
  period: string
  currency: string
  basicSalary: string
  benefits: PayItem[]
  grossPay: string
  deductions: PayItem[]
  totalDeductions: string
  netPay: string
  emailedAt: string | null
  emailError: string | null
  emailAttempts: number
  createdAt: string
  employeeDetails?: {
    employeeId: string
    employeeName: string
    location: string
    hireDate: string | null
    pensionProvider: string
    pensionNumber: string
    taxId: string
    nhfNumber: string
    bankName: string
    accountName: string
    accountNumber: string
  }
}
type PayrollRunResult = { period: string; eligible: number; unconfigured: number; created: number; sent: number; failed: number; skipped: number }
type ConfigurationForm = { grossSalary: string; additions: PayItem[]; deductions: PayItem[]; currency: string; isEnabled: boolean }
type SalaryComponent = { name: string; percentage: number }

const emptyConfiguration: ConfigurationForm = { grossSalary: '', additions: [], deductions: [], currency: 'NGN', isEnabled: true }
const defaultCurrencies = ['NGN', 'USD', 'GBP', 'SEK']
const currencyNames: Record<string, string> = { NGN: 'Nigerian naira', USD: 'US dollar', GBP: 'British pound', SEK: 'Swedish krona' }
const defaultStandards: SalaryComponent[] = [{ name: 'Basic Salary', percentage: 26 }, { name: 'Housing Allowance', percentage: 34 }, { name: 'Transport Allowance', percentage: 25 }, { name: 'Feeding Allowance', percentage: 10 }, { name: 'Other Allowance', percentage: 5 }]
const currentPeriod = () => {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}
const previousPeriod = () => {
  const now = new Date()
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`
}
const formatMoney = (value: string | number, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value) || 0)
const formatPeriod = (period: string) => {
  const [year, month] = period.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))
}
const itemTotal = (items: PayItem[]) => items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
const isTaxDeduction = (name: string) => {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized.includes('tax') || normalized === 'paye' || normalized === 'payasyouearn'
}
const isPensionDeduction = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '').includes('pension')
const taxTotal = (items: PayItem[]) => itemTotal(items.filter((item) => isTaxDeduction(item.name)))
const pensionTotal = (items: PayItem[]) => itemTotal(items.filter((item) => isPensionDeduction(item.name)))
const formatDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : '—'

function downloadPayslipPdf(id: string) {
  const previousTitle = document.title
  const card = document.querySelector<HTMLElement>(`[data-payslip-id="${CSS.escape(id)}"]`)
  if (!card) return
  document.title = `Payslip-${card.dataset.period ?? 'period'}`
  document.body.classList.add('payroll-printing-single')
  document.querySelectorAll('.payroll-print-area').forEach((item) => item.classList.toggle('payroll-print-selected', item === card))
  const cleanup = () => {
    document.title = previousTitle
    document.body.classList.remove('payroll-printing-single')
    document.querySelectorAll('.payroll-print-selected').forEach((item) => item.classList.remove('payroll-print-selected'))
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}

function PayItemEditor({ title, items, currency, onChange }: { title: string; items: PayItem[]; currency: string; onChange: (items: PayItem[]) => void }) {
  return <section className="pay-item-editor"><div className="payroll-section-heading"><h3>{title}</h3><button className="button-secondary" type="button" onClick={() => onChange([...items, { name: '', amount: '' }])}><Plus size={14} /> Add item</button></div>{items.map((item, index) => <div className="payroll-item-row" key={`${title}-${index}`}><input aria-label={`${title} name`} value={item.name} onChange={(event) => onChange(items.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))} placeholder={title === 'Additions' ? 'e.g. Bonus, overtime' : 'e.g. Pension, tax'} required maxLength={80} /><input aria-label={`${title} amount`} type="number" min="0" step="0.01" value={item.amount} onChange={(event) => onChange(items.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))} placeholder={`Amount (${currency})`} required /><button className="icon-button" type="button" aria-label={`Remove ${title} item ${index + 1}`} onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))}><X size={15} /></button></div>)}</section>
}

function PayrollConfigurationDialog({ employee, standards, currencies, onClose, onSave }: { employee: PayrollEmployee; standards: SalaryComponent[]; currencies: string[]; onClose: () => void; onSave: (form: ConfigurationForm) => Promise<void> }) {
  const payrollGross = employee.payrollConfiguration
    ? (Number(employee.payrollConfiguration.basicSalary) + itemTotal(employee.payrollConfiguration.benefits)).toFixed(2)
    : ''
  const employeeGross = Number(employee.grossSalary) > 0 ? employee.grossSalary! : payrollGross
  const [form, setForm] = useState<ConfigurationForm>({
    grossSalary: employeeGross,
    additions: employee.payrollConfiguration?.additions ?? [],
    deductions: employee.payrollConfiguration?.deductions ?? [],
    currency: employee.payrollConfiguration?.currency ?? 'NGN',
    isEnabled: employee.payrollConfiguration?.isEnabled ?? emptyConfiguration.isEnabled,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const gross = Number(form.grossSalary) || 0
  const earnings = gross + itemTotal(form.additions)
  const deductionsTotal = itemTotal(form.deductions)
  const netPay = earnings - deductionsTotal

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (deductionsTotal > earnings) { setError('Deductions cannot exceed salary plus additions.'); return }
    setSaving(true)
    setError('')
    try { await onSave(form) } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to save this payroll configuration.')
    } finally { setSaving(false) }
  }

  return <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="employee-dialog payroll-config-dialog" role="dialog" aria-modal="true" aria-labelledby="payroll-config-title">
      <header className="employee-dialog-header"><div><p className="eyebrow">PAYROLL SETUP</p><h2 id="payroll-config-title">{employee.payrollConfiguration ? 'Edit salary details' : 'Set up salary'}</h2><p>{employee.firstName} {employee.lastName} · {employee.employeeNumber}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close salary details"><X size={18} /></button></header>
      <form className="employee-form" onSubmit={(event) => void submit(event)}>
        <label>Salary currency<select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}>{currencies.map((currency) => <option key={currency} value={currency}>{currency} · {currencyNames[currency] ?? currency}</option>)}</select></label>
        <label className="payroll-basic-field">Gross monthly salary ({form.currency})<input type="number" min="0.01" step="0.01" value={form.grossSalary} onChange={(event) => setForm((current) => ({ ...current, grossSalary: event.target.value }))} required autoFocus /></label>
        <div className="payroll-standard-preview"><strong>Calculated salary breakdown</strong>{standards.map((component) => <span key={component.name}>{component.name} <b>{component.percentage}% · {formatMoney(gross * component.percentage / 100, form.currency)}</b></span>)}</div>
        <PayItemEditor title="Additions" items={form.additions} currency={form.currency} onChange={(additions) => setForm((current) => ({ ...current, additions }))} />
        <PayItemEditor title="Deductions" items={form.deductions} currency={form.currency} onChange={(deductions) => setForm((current) => ({ ...current, deductions }))} />
        <div className="payroll-calculation-preview"><span>Salary gross<strong>{formatMoney(gross, form.currency)}</strong></span><span>Additional earnings<strong>+{formatMoney(itemTotal(form.additions), form.currency)}</strong></span><span>Total deductions<strong>−{formatMoney(deductionsTotal, form.currency)}</strong></span><span>Estimated net pay<strong>{formatMoney(netPay, form.currency)}</strong></span></div>
        <label className="payroll-enabled-toggle"><input type="checkbox" checked={form.isEnabled} onChange={(event) => setForm((current) => ({ ...current, isEnabled: event.target.checked }))} /> Include this employee in automatic payroll</label>
        {error && <p className="employee-form-error" role="alert"><CircleAlert size={15} />{error}</p>}
        <footer className="employee-dialog-actions"><button className="button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="loading-icon" size={15} /> : <Save size={15} />} Save salary details</button></footer>
      </form>
    </section>
  </div>
}

function MonthlyDeductionsDialog({ employee, period, currency, onClose, onSave }: { employee: PayrollEmployee; period: string; currency: string; onClose: () => void; onSave: (deductions: PayItem[]) => Promise<void> }) {
  const [deductions, setDeductions] = useState<PayItem[]>(employee.monthlyDeductions ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await onSave(deductions) }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to save monthly deductions.') }
    finally { setSaving(false) }
  }
  return <div className="employee-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="employee-dialog payroll-config-dialog" role="dialog" aria-modal="true" aria-labelledby="monthly-deductions-title">
      <header className="employee-dialog-header"><div><p className="eyebrow">MONTHLY PAYROLL</p><h2 id="monthly-deductions-title">Deductions for {formatPeriod(period)}</h2><p>{employee.firstName} {employee.lastName} · {employee.employeeNumber}</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close monthly deductions"><X size={18} /></button></header>
      <form className="employee-form" onSubmit={(event) => void submit(event)}><p>These deductions apply to {formatPeriod(period)} only. Add recurring deductions such as tax or pension in salary setup.</p>
        <PayItemEditor title="This month’s deductions" items={deductions} currency={currency} onChange={setDeductions} />
        {error && <p className="employee-form-error" role="alert"><CircleAlert size={15} />{error}</p>}
        <footer className="employee-dialog-actions"><button className="button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="loading-icon" size={15} /> : <Save size={15} />} Save month deductions</button></footer>
      </form>
    </section>
  </div>
}

function EmployeePayslip({ payslip }: { payslip: Payslip }) {
  const details = payslip.employeeDetails
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const housing = payslip.benefits.find((item) => normalize(item.name).includes('housing'))
  const transport = payslip.benefits.find((item) => normalize(item.name).includes('transport'))
  const utility = payslip.benefits.find((item) => normalize(item.name).includes('utility'))
  const fixedBenefits = new Set([housing, transport, utility].filter(Boolean))
  const paye = payslip.deductions.find((item) => ['paye', 'payasyouearn'].includes(normalize(item.name)) || normalize(item.name).includes('tax'))
  const pension = payslip.deductions.find((item) => normalize(item.name).includes('pension'))
  const fixedDeductions = new Set([paye, pension].filter(Boolean))
  const amountOrZero = (item?: PayItem) => formatMoney(item?.amount ?? 0, payslip.currency)
  return <article className="payroll-payslip-card payroll-print-area" data-payslip-id={payslip.id} data-period={payslip.period}>
    <div className="payroll-company-letterhead"><img src="/fluide-logo.png" alt="Fluide Homes" /><div className="payroll-office-addresses"><div><strong>Lagos Office</strong><span>27A Admiralty Way, Lekki Phase I, Lagos, Nigeria</span></div><div><strong>Abuja Office</strong><span>8 Tarkwa Cres, Wuse, Abuja 904101, Federal Capital Territory, Nigeria</span></div></div></div>
    <header><div><p className="eyebrow">FLUIDÉ HOMES · PAYSLIP</p><h3>{formatPeriod(payslip.period)}</h3><p>{details?.employeeName || payslip.employeeName} · {details?.employeeId || payslip.employeeNumber}</p></div><button className="button-secondary payroll-no-print" type="button" onClick={() => downloadPayslipPdf(payslip.id)}><Download size={15} /> Download PDF</button></header>
    <dl className="payroll-employee-details"><div><dt>Employee ID</dt><dd>{details?.employeeId || payslip.employeeNumber}</dd></div><div><dt>Name</dt><dd>{details?.employeeName || payslip.employeeName}</dd></div><div><dt>Location</dt><dd>{details?.location || '—'}</dd></div><div><dt>Hire Date</dt><dd>{formatDate(details?.hireDate)}</dd></div><div><dt>Pension Provider</dt><dd>{details?.pensionProvider || '—'}</dd></div><div><dt>Pension No.</dt><dd>{details?.pensionNumber || '—'}</dd></div></dl>
    <section className="payroll-breakdown-section"><h4>Allowances</h4><dl className="payroll-breakdown"><div><dt>Basic Allowance</dt><dd>{formatMoney(payslip.basicSalary, payslip.currency)}</dd></div><div><dt>Housing Allowance</dt><dd>{amountOrZero(housing)}</dd></div><div><dt>Transportation Allowance</dt><dd>{amountOrZero(transport)}</dd></div><div><dt>Utility</dt><dd>{amountOrZero(utility)}</dd></div>{payslip.benefits.filter((item) => !fixedBenefits.has(item)).map((item, index) => <div key={`other-benefit-${index}`}><dt>{item.name}</dt><dd>{formatMoney(item.amount, payslip.currency)}</dd></div>)}</dl></section>
    <dl className="payroll-breakdown"><div className="payroll-breakdown-total"><dt>Gross Earnings</dt><dd>{formatMoney(payslip.grossPay, payslip.currency)}</dd></div></dl>
    <section className="payroll-breakdown-section"><h4>Deductions</h4><dl className="payroll-breakdown"><div><dt>P.A.Y.E</dt><dd>{amountOrZero(paye)}</dd></div><div><dt>PENSION</dt><dd>{amountOrZero(pension)}</dd></div>{payslip.deductions.filter((item) => !fixedDeductions.has(item)).map((item, index) => <div key={`other-deduction-${index}`}><dt>{item.name}</dt><dd>{formatMoney(item.amount, payslip.currency)}</dd></div>)}<div className="payroll-breakdown-total"><dt>Total Deduction</dt><dd>{formatMoney(payslip.totalDeductions, payslip.currency)}</dd></div><div className="payroll-net-total"><dt>NET PAY</dt><dd>{formatMoney(payslip.netPay, payslip.currency)}</dd></div></dl></section>
    <dl className="payroll-employee-details payroll-bank-details"><div><dt>Tax ID</dt><dd>{details?.taxId || '—'}</dd></div><div><dt>NHF Number</dt><dd>{details?.nhfNumber || '—'}</dd></div><div><dt>Bank Name</dt><dd>{details?.bankName || '—'}</dd></div><div><dt>Account Name</dt><dd>{details?.accountName || '—'}</dd></div><div><dt>Account Number</dt><dd>{details?.accountNumber || '—'}</dd></div></dl>
    <p className="payroll-email-status payroll-no-print">{payslip.emailedAt ? <><Mail size={14} /> Emailed {new Date(payslip.emailedAt).toLocaleDateString()}</> : <><CircleAlert size={14} /> Email delivery is pending</>}</p>
  </article>
}
export function PayrollPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission('payroll:manage')
  const [employees, setEmployees] = useState<PayrollEmployee[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [myPayslips, setMyPayslips] = useState<Payslip[]>([])
  const [period, setPeriod] = useState(currentPeriod)
  const [selectedPayslipYear, setSelectedPayslipYear] = useState(() => previousPeriod().slice(0, 4))
  const [selectedPayslipMonth, setSelectedPayslipMonth] = useState(() => previousPeriod().slice(5, 7))
  const [editingEmployee, setEditingEmployee] = useState<PayrollEmployee | null>(null)
  const [monthlyDeductionEmployee, setMonthlyDeductionEmployee] = useState<PayrollEmployee | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [standards, setStandards] = useState<SalaryComponent[]>(defaultStandards)
  const [currencies, setCurrencies] = useState<string[]>(defaultCurrencies)
  const [standardsOpen, setStandardsOpen] = useState(false)
  const [standardsSaving, setStandardsSaving] = useState(false)
  const [currenciesOpen, setCurrenciesOpen] = useState(false)
  const [currencyCode, setCurrencyCode] = useState('')
  const [currencySaving, setCurrencySaving] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        if (canManage) {
          const [[employeeResult, payslipResult, standardsResult, currencyResult], ownPayslipResult] = await Promise.all([
            Promise.all([
              api.get<PayrollEmployee[]>(`/payroll/manage/employees?period=${encodeURIComponent(period)}`),
              api.get<Payslip[]>(`/payroll/manage/payslips?period=${encodeURIComponent(period)}`),
              api.get<SalaryComponent[]>('/payroll/manage/standards'),
              api.get<string[]>('/payroll/manage/currencies'),
            ]),
            api.get<Payslip[]>('/payroll/me').catch(() => []),
          ])
          if (!active) return
          setEmployees(employeeResult)
          setPayslips(payslipResult)
          setStandards(standardsResult)
          setCurrencies(currencyResult)
          setMyPayslips(ownPayslipResult)
        } else {
          const ownPayslipResult = await api.get<Payslip[]>('/payroll/me')
          if (!active) return
          setMyPayslips(ownPayslipResult)
        }
      } catch (cause) {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Unable to load payroll information.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [canManage, period, reloadKey])

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => `${employee.firstName} ${employee.lastName} ${employee.employeeNumber} ${employee.email}`.toLowerCase().includes(query))
  }, [employees, search])

  const payslipYears = useMemo(() => [...new Set([...myPayslips.map((payslip) => payslip.period.slice(0, 4)), previousPeriod().slice(0, 4)])].sort((a, b) => b.localeCompare(a)), [myPayslips])
  const filteredMyPayslips = useMemo(() => myPayslips.filter((payslip) =>
    (selectedPayslipYear === 'all' || payslip.period.startsWith(`${selectedPayslipYear}-`)) &&
    (selectedPayslipMonth === 'all' || payslip.period.endsWith(`-${selectedPayslipMonth}`)),
  ), [myPayslips, selectedPayslipMonth, selectedPayslipYear])

  async function saveConfiguration(form: ConfigurationForm) {
    if (!editingEmployee) return
    await api.put(`/payroll/manage/employees/${editingEmployee.id}`, form)
    setEditingEmployee(null)
    setNotice(`Salary details saved for ${editingEmployee.firstName} ${editingEmployee.lastName}.`)
    setReloadKey((key) => key + 1)
  }

  async function saveMonthDeductions(deductions: PayItem[]) {
    if (!monthlyDeductionEmployee) return
    await api.put(`/payroll/manage/employees/${monthlyDeductionEmployee.id}/monthly-deductions`, { period, deductions })
    setMonthlyDeductionEmployee(null)
    setNotice(`Deductions saved for ${monthlyDeductionEmployee.firstName} ${monthlyDeductionEmployee.lastName} in ${formatPeriod(period)}.`)
    setReloadKey((key) => key + 1)
  }

  async function saveStandards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStandardsSaving(true)
    try {
      const result = await api.put<SalaryComponent[]>('/payroll/manage/standards', { components: standards })
      setStandards(result)
      setStandardsOpen(false)
      setNotice('Standard salary components saved and applied to all configured employees.')
      setReloadKey((key) => key + 1)
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to save standard salary components.') }
    finally { setStandardsSaving(false) }
  }

  async function addCurrency(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCurrencySaving(true)
    setError('')
    try {
      const result = await api.post<string[]>('/payroll/manage/currencies', { code: currencyCode.trim().toUpperCase() })
      setCurrencies(result)
      setCurrencyCode('')
      setNotice('Payroll currency added. It is now available in employee salary setup.')
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to add payroll currency.') }
    finally { setCurrencySaving(false) }
  }

  async function generatePayroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProcessing(true)
    setNotice('')
    setError('')
    try {
      const result = await api.post<PayrollRunResult>('/payroll/manage/generate', { period })
      setNotice(`${formatPeriod(result.period)} payroll: ${result.created} payslip${result.created === 1 ? '' : 's'} created, ${result.sent} email${result.sent === 1 ? '' : 's'} sent, ${result.failed} failed, ${result.skipped} already sent, ${result.unconfigured} active employee${result.unconfigured === 1 ? '' : 's'} without payroll setup.`)
      setReloadKey((key) => key + 1)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Unable to generate monthly payslips.')
    } finally { setProcessing(false) }
  }

  if (loading) return <div className="dashboard-status" role="status"><LoaderCircle className="loading-icon" size={18} /> Loading payroll…</div>

  return <section className="payroll-page" aria-label="Payroll">
    <header className="payroll-page-intro"><div><p className="eyebrow">PEOPLE. PERFORMANCE. PROGRESS.</p><h2>Payroll</h2><p>Manage monthly salary details and employee payslips.</p></div><span className="payroll-currency-badge"><Banknote size={16} /> NGN · default currency</span></header>
    {error && <div className="employee-form-error" role="alert"><CircleAlert size={15} />{error}</div>}
    {notice && <div className="employee-notice" role="status"><Check size={15} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
    <section className="payroll-section"><div className="payroll-section-heading"><div><h3>My payslips</h3><p>Your payslips are private to your employee account.</p></div><div className="payroll-period-filters"><label>Year<select value={selectedPayslipYear} onChange={(event) => setSelectedPayslipYear(event.target.value)}><option value="all">All years</option>{payslipYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label>Month<select value={selectedPayslipMonth} onChange={(event) => setSelectedPayslipMonth(event.target.value)}><option value="all">All months</option>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat(undefined, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, Number(month) - 1, 1)))}</option>)}</select></label></div></div>{filteredMyPayslips.length ? <div className="payroll-payslip-list">{filteredMyPayslips.map((payslip) => <EmployeePayslip key={payslip.id} payslip={payslip} />)}</div> : <div className="employees-state empty-directory"><Wallet size={22} /><h2>No payslips for this selection</h2><p>Payslips will appear here after payroll has been processed for the selected month.</p></div>}</section>
    {canManage ? <>
      <form className="payroll-run-card" onSubmit={(event) => void generatePayroll(event)}><div><Wallet size={19} /><span><strong>Generate monthly payslips</strong><small>Create a locked payslip snapshot and email it to each configured employee. You can run a month again to retry failed email deliveries.</small></span></div><label>Payroll month<input type="month" value={period} max={currentPeriod()} onChange={(event) => setPeriod(event.target.value)} required /></label><button className="button-primary" type="submit" disabled={processing}>{processing ? <LoaderCircle className="loading-icon" size={15} /> : <Mail size={15} />}{processing ? 'Processing…' : 'Generate & email'}</button></form>
      <section className="payroll-section"><div className="payroll-section-heading"><div><h3>Employee salary setup</h3><p>Enter gross monthly salary and currency. Components are calculated using the company standards.</p></div><button className="button-secondary" type="button" onClick={() => setStandardsOpen((open) => !open)}>Set standard components</button><button className="button-secondary" type="button" onClick={() => setCurrenciesOpen((open) => !open)}>Manage currencies</button><label className="employee-search payroll-search"><span className="sr-only">Search payroll employees</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" /></label></div>
        {currenciesOpen && <form className="payroll-standards-form payroll-currency-form" onSubmit={(event) => void addCurrency(event)}><p>Available payroll currencies: {currencies.join(', ')}. NGN is the default for new salary setups.</p><div className="payroll-item-row"><input aria-label="New currency code" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} placeholder="Currency code, e.g. CAD" maxLength={3} minLength={3} pattern="[A-Z]{3}" required /><button className="button-primary" type="submit" disabled={currencySaving}>{currencySaving ? 'Adding…' : 'Add currency'}</button></div></form>}
        {standardsOpen && <form className="payroll-standards-form" onSubmit={(event) => void saveStandards(event)}><p>Components must add up to 100%. Changes recalculate all configured employee salaries and future payslips.</p>{standards.map((component, index) => <div className="payroll-item-row" key={`${index}-${component.name}`}><input aria-label="Component name" value={component.name} onChange={(event) => setStandards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} required maxLength={80} /><input aria-label="Percentage" type="number" min="0" max="100" step="0.01" value={component.percentage} onChange={(event) => setStandards((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: Number(event.target.value) } : item))} required /><button className="icon-button" type="button" aria-label={`Remove ${component.name}`} disabled={standards.length <= 1} onClick={() => setStandards((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button></div>)}<button className="button-secondary" type="button" onClick={() => setStandards((current) => [...current, { name: '', percentage: 0 }])}>Add component</button><strong>Total: {standards.reduce((sum, item) => sum + item.percentage, 0).toFixed(2)}%</strong><button className="button-primary" type="submit" disabled={standardsSaving || Math.round(standards.reduce((sum, item) => sum + item.percentage, 0) * 100) !== 10000}>{standardsSaving ? 'Saving…' : 'Save standards'}</button></form>}
        <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Employee</th><th>Gross salary</th><th>Deduction</th><th>Tax</th><th>Pension</th><th>Net salary</th><th>Setup</th></tr></thead><tbody>{filteredEmployees.map((employee) => {
          const config = employee.payrollConfiguration
          const allDeductions = [...(config?.deductions ?? []), ...(employee.monthlyDeductions ?? [])]
          const salaryAvailable = Boolean(config) || Number(employee.grossSalary) > 0
          const configuredGross = Number(employee.grossSalary) || (config ? Number(config.basicSalary) + itemTotal(config.benefits) : 0)
          const gross = config ? configuredGross + itemTotal(config.additions) : configuredGross
          const deductions = itemTotal(allDeductions)
          const tax = taxTotal(allDeductions)
          const pension = pensionTotal(allDeductions)
          const otherDeductions = allDeductions.filter((item) => !isTaxDeduction(item.name) && !isPensionDeduction(item.name))
          const currency = config?.currency ?? 'NGN'
          const payslipCreated = payslips.some((payslip) => payslip.employeeNumber === employee.employeeNumber)
          return <tr key={employee.id}><td><strong>{employee.firstName} {employee.lastName}</strong><small>{employee.employeeNumber} · {employee.email}</small></td><td>{salaryAvailable ? formatMoney(gross, currency) : '—'}</td><td>{salaryAvailable && otherDeductions.length ? otherDeductions.map((item, index) => <small key={`${item.name}-${index}`}>{item.name}: {formatMoney(item.amount, currency)}</small>) : '—'}</td><td>{salaryAvailable && tax > 0 ? formatMoney(tax, currency) : '—'}</td><td>{salaryAvailable && pension > 0 ? formatMoney(pension, currency) : '—'}</td><td>{salaryAvailable ? formatMoney(gross - deductions, currency) : '—'}</td><td><button className="button-secondary" type="button" onClick={() => setEditingEmployee(employee)}>{config ? 'Edit salary' : 'Set up salary'}</button>{config && <button className="button-secondary" type="button" onClick={() => setMonthlyDeductionEmployee(employee)} disabled={payslipCreated} title={payslipCreated ? 'Payslip already generated for this month' : undefined}>{payslipCreated ? 'Payslip generated' : 'Month deductions'}</button>}{config && !config.isEnabled && <small className="payroll-disabled-label">Automatic payroll off</small>}</td></tr>
        })}</tbody></table>{filteredEmployees.length === 0 && <p className="payroll-empty-items">No employees match this search.</p>}</div>
      </section>
      <section className="payroll-section"><div className="payroll-section-heading"><div><h3>{formatPeriod(period)} payslips</h3><p>Snapshot records for this monthly payroll run.</p></div></div>{payslips.length ? <div className="payroll-table-wrap"><table className="payroll-table"><thead><tr><th>Employee</th><th>Gross</th><th>Tax deduction</th><th>Deductions</th><th>Net pay</th><th>Email status</th></tr></thead><tbody>{payslips.map((payslip) => <tr key={payslip.id}><td><strong>{payslip.employeeName}</strong><small>{payslip.employeeNumber} · {(payslip.recipientEmails?.length ? payslip.recipientEmails : [payslip.recipientEmail]).join(', ')}</small></td><td>{formatMoney(payslip.grossPay, payslip.currency)}</td><td>{taxTotal(payslip.deductions) > 0 ? formatMoney(taxTotal(payslip.deductions), payslip.currency) : '—'}</td><td>{formatMoney(payslip.totalDeductions, payslip.currency)}</td><td>{formatMoney(payslip.netPay, payslip.currency)}</td><td>{payslip.emailedAt ? <span className="payroll-delivered"><Check size={14} /> Sent</span> : <span className="payroll-failed"><CircleAlert size={14} /> {payslip.emailError || 'Pending'}</span>}</td></tr>)}</tbody></table></div> : <p className="payroll-empty-items">No payslips generated for this month yet.</p>}</section>
    </> : null}
    {editingEmployee && <PayrollConfigurationDialog employee={editingEmployee} standards={standards} currencies={currencies} onClose={() => setEditingEmployee(null)} onSave={saveConfiguration} />}
    {monthlyDeductionEmployee && <MonthlyDeductionsDialog employee={monthlyDeductionEmployee} period={period} currency={monthlyDeductionEmployee.payrollConfiguration?.currency ?? 'NGN'} onClose={() => setMonthlyDeductionEmployee(null)} onSave={saveMonthDeductions} />}
  </section>
}
