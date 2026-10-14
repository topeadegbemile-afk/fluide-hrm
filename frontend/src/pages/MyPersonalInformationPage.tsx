import { useEffect, useState, type FormEvent } from 'react'
import { Check, CircleAlert, LoaderCircle, Plus, Save, Trash2, Upload } from 'lucide-react'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../auth/useAuth'
import { EmployeeAvatar } from '../components/EmployeeAvatar'

type InfoRow = Record<string, string>

type PersonalInformation = {
  taxId: string
  personalEmail: string
  bankName: string
  accountName: string
  accountNumber: string
  pensionProvider: string
  pensionNumber: string
  nhfNumber: string
  spouse: InfoRow
  beneficiaries: InfoRow[]
  dependants: InfoRow[]
  interests: string[]
  qualifications: InfoRow[]
  guarantors: InfoRow[]
}

type InformationResponse = {
  data: PersonalInformation
  updatedAt: string
  reviewStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewComment?: string | null
} | null
type InformationReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

const blank = (fields: string[]): InfoRow => Object.fromEntries(fields.map((field) => [field, '']))

const emptyInformation = (): PersonalInformation => ({
  taxId: '',
  personalEmail: '',
  bankName: '',
  accountName: '',
  accountNumber: '',
  pensionProvider: '',
  pensionNumber: '',
  nhfNumber: '',
  spouse: blank(['fullName', 'phone', 'email', 'occupation']),
  beneficiaries: [],
  dependants: [],
  interests: [],
  qualifications: [],
  guarantors: [],
})

const rowSections = [
  {
    key: 'beneficiaries',
    title: 'Beneficiaries',
    description: 'People you have nominated as beneficiaries.',
    fields: [
      { key: 'fullName', label: 'Full name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'phone', label: 'Phone number', type: 'tel' },
      { key: 'allocation', label: 'Allocation (%)', type: 'number' },
    ],
    newRow: () => blank(['fullName', 'relationship', 'phone', 'allocation']),
  },
  {
    key: 'dependants',
    title: 'Dependants',
    description: 'Add the family members who depend on you.',
    fields: [
      { key: 'fullName', label: 'Full name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
    ],
    newRow: () => blank(['fullName', 'relationship', 'dateOfBirth']),
  },
  {
    key: 'qualifications',
    title: 'Qualifications',
    description: 'Record your education and professional qualifications.',
    fields: [
      { key: 'qualification', label: 'Qualification' },
      { key: 'institution', label: 'Institution' },
      { key: 'fieldOfStudy', label: 'Field of study' },
      { key: 'yearCompleted', label: 'Year completed', type: 'number' },
    ],
    newRow: () => blank(['qualification', 'institution', 'fieldOfStudy', 'yearCompleted']),
  },
  {
    key: 'guarantors',
    title: 'Guarantors',
    description: 'Provide contact details for your guarantors.',
    fields: [
      { key: 'fullName', label: 'Full name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'phone', label: 'Phone number', type: 'tel' },
      { key: 'email', label: 'Email address', type: 'email' },
      { key: 'address', label: 'Address', wide: true },
    ],
    newRow: () => blank(['fullName', 'relationship', 'phone', 'email', 'address']),
  },
] as const

function SectionHeading({ title, description }: { title: string; description: string }) {
  return <div className="personal-info-section-heading"><h3>{title}</h3><p>{description}</p></div>
}

export function MyPersonalInformationPage() {
  const { user, refreshUser } = useAuth()
  const [information, setInformation] = useState<PersonalInformation>(emptyInformation)
  const [reviewStatus, setReviewStatus] = useState<InformationReviewStatus>()
  const [reviewComment, setReviewComment] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(null); return }
    const objectUrl = URL.createObjectURL(photoFile)
    setPhotoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photoFile])

  useEffect(() => {
    let active = true
    api.get<InformationResponse>('/employees/me/personal-information')
      .then((result) => {
        if (!active || !result?.data) return
        setInformation({ ...emptyInformation(), ...result.data })
        setReviewStatus(result.reviewStatus)
        setReviewComment(result.reviewComment ?? null)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load your information.')
      })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  function updateRows(key: 'beneficiaries' | 'dependants' | 'qualifications' | 'guarantors', index: number, field: string, value: string) {
    setInformation((current) => ({
      ...current,
      [key]: current[key].map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
    }))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    setNotice('')
    try {
      const result = await api.put<InformationResponse>('/employees/me/personal-information', information)
      setReviewStatus(result?.reviewStatus)
      setReviewComment(result?.reviewComment ?? null)
      setNotice(result?.reviewStatus === 'PENDING' ? 'Your information was submitted to HR for review.' : 'Your information has been saved.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not save your information.')
    } finally {
      setIsSaving(false)
    }
  }

  async function uploadPhoto() {
    if (!photoFile || !user?.employee) return
    setIsUploadingPhoto(true)
    setError('')
    setNotice('')
    try {
      await api.uploadFile(`/employees/${user.employee.id}/profile-photo`, photoFile)
      await refreshUser()
      setPhotoFile(null)
      setNotice('Your profile photo has been updated.')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not upload your profile photo.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  if (isLoading) {
    return <div className="dashboard-status" role="status"><LoaderCircle className="loading-icon" size={18} /> Loading your information…</div>
  }

  return (
    <form className="personal-information-page" onSubmit={(event) => void save(event)}>
      <div className="personal-info-intro">
        <div><p className="eyebrow">YOUR PROFILE</p><h2>Personal information</h2><p>Keep these details up to date. Your saved information will be available to HR.</p></div>
        <button className="button-primary" type="submit" disabled={isSaving}>
          {isSaving ? <LoaderCircle className="loading-icon" size={15} /> : <Save size={15} />}
          {isSaving ? 'Saving…' : 'Save information'}
        </button>
      </div>

      {error && <div className="employee-form-error" role="alert"><CircleAlert size={15} />{error}</div>}
      {notice && <div className="employee-notice" role="status"><Check size={15} />{notice}</div>}
      {reviewStatus && <div className={`employee-information-review-status is-${reviewStatus.toLowerCase()}`} role="status"><strong>{reviewStatus === 'PENDING' ? 'Awaiting HR review' : reviewStatus === 'APPROVED' ? 'Information approved' : 'HR requested updates'}</strong>{reviewComment && <span>{reviewComment}</span>}</div>}

      <section className="personal-info-section profile-photo-section">
        <EmployeeAvatar className="profile-photo-preview" photo={photoPreview ?? user?.employee?.profilePhoto} name={user?.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user?.email ?? 'Employee'} />
        <div className="profile-photo-copy"><h3>Profile photo</h3><p>Choose a clear photo for your employee profile and the top navigation.</p><small>PNG, JPG, or WebP · maximum 500 KB</small></div>
        <div className="profile-photo-actions"><label className="button-secondary profile-photo-select"><Upload size={14} /> Choose photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 500 * 1024) { setError('Profile photos must be 500 KB or smaller.'); return } setError(''); setPhotoFile(file) }} /></label><button className="button-primary" type="button" disabled={!photoFile || isUploadingPhoto} onClick={() => void uploadPhoto()}>{isUploadingPhoto ? <LoaderCircle className="loading-icon" size={14} /> : <Upload size={14} />}{isUploadingPhoto ? 'Uploading…' : 'Upload photo'}</button></div>
      </section>

      <section className="personal-info-section">
        <SectionHeading title="Tax and bank details" description="Add the details HR needs for payroll and employee records." />
        <div className="employee-form-grid">
          <label><span>Tax ID</span><input autoComplete="off" value={information.taxId} onChange={(event) => setInformation((current) => ({ ...current, taxId: event.target.value }))} /></label>
          <label><span>Personal email</span><input type="email" autoComplete="email" value={information.personalEmail} onChange={(event) => setInformation((current) => ({ ...current, personalEmail: event.target.value }))} /></label>
          <label><span>Bank name</span><input autoComplete="off" value={information.bankName} onChange={(event) => setInformation((current) => ({ ...current, bankName: event.target.value }))} /></label>
          <label><span>Account name</span><input autoComplete="off" value={information.accountName} onChange={(event) => setInformation((current) => ({ ...current, accountName: event.target.value }))} /></label>
          <label><span>Account number</span><input inputMode="numeric" autoComplete="off" value={information.accountNumber} onChange={(event) => setInformation((current) => ({ ...current, accountNumber: event.target.value }))} /></label>
          <label><span>Pension provider</span><input autoComplete="off" value={information.pensionProvider} onChange={(event) => setInformation((current) => ({ ...current, pensionProvider: event.target.value }))} /></label>
          <label><span>Pension number</span><input autoComplete="off" value={information.pensionNumber} onChange={(event) => setInformation((current) => ({ ...current, pensionNumber: event.target.value }))} /></label>
          <label><span>NHF number</span><input autoComplete="off" value={information.nhfNumber} onChange={(event) => setInformation((current) => ({ ...current, nhfNumber: event.target.value }))} /></label>
        </div>
      </section>

      <section className="personal-info-section">
        <SectionHeading title="Spouse details" description="Add your spouse or partner’s contact information." />
        <div className="employee-form-grid">
          {[
            { key: 'fullName', label: 'Full name' },
            { key: 'phone', label: 'Phone number', type: 'tel' },
            { key: 'email', label: 'Email address', type: 'email' },
            { key: 'occupation', label: 'Occupation' },
          ].map((field) => (
            <label key={field.key}><span>{field.label}</span><input type={'type' in field ? field.type : 'text'} value={information.spouse[field.key] ?? ''} onChange={(event) => setInformation((current) => ({ ...current, spouse: { ...current.spouse, [field.key]: event.target.value } }))} /></label>
          ))}
        </div>
      </section>

      {rowSections.map((section) => {
        const rows = information[section.key]
        return (
          <section className="personal-info-section" key={section.key}>
            <div className="personal-info-section-heading personal-info-repeat-heading">
              <div><h3>{section.title}</h3><p>{section.description}</p></div>
              <button className="button-secondary" type="button" onClick={() => setInformation((current) => ({ ...current, [section.key]: [...current[section.key], section.newRow()] }))}><Plus size={14} /> Add {section.title.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '')}</button>
            </div>
            {rows.length === 0 ? <p className="personal-info-empty">No {section.title.toLowerCase()} added yet.</p> : rows.map((row, index) => (
              <div className="personal-info-entry" key={`${section.key}-${index}`}>
                <div className="employee-form-grid">
                  {section.fields.map((field) => (
                    <label className={'wide' in field && field.wide ? 'employee-form-full' : ''} key={field.key}><span>{field.label}</span><input type={'type' in field ? field.type : 'text'} value={row[field.key] ?? ''} onChange={(event) => updateRows(section.key, index, field.key, event.target.value)} /></label>
                  ))}
                </div>
                <button className="personal-info-remove" type="button" aria-label={`Remove ${section.title.toLowerCase()} entry ${index + 1}`} onClick={() => setInformation((current) => ({ ...current, [section.key]: current[section.key].filter((_, rowIndex) => rowIndex !== index) }))}><Trash2 size={15} /> Remove</button>
              </div>
            ))}
          </section>
        )
      })}

      <section className="personal-info-section">
        <SectionHeading title="Interests" description="Add hobbies, interests, and activities you would like HR to know about." />
        <label className="personal-info-interests"><span>One interest per line</span><textarea rows={4} value={information.interests.join('\n')} onChange={(event) => setInformation((current) => ({ ...current, interests: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) }))} placeholder="Reading&#10;Volunteering&#10;Football" /></label>
      </section>

      <footer className="personal-info-footer">
        <p>Only you can edit this information. HR staff with employee management access can view it.</p>
        <button className="button-primary" type="submit" disabled={isSaving}>{isSaving ? <LoaderCircle className="loading-icon" size={15} /> : <Save size={15} />}{isSaving ? 'Saving…' : 'Save information'}</button>
      </footer>
    </form>
  )
}
