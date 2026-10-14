# Policy API

All policy routes require a bearer access token. Access is controlled by the
`handbook:read`, `handbook:create`, and `handbook:update` permissions.

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/handbook` | `handbook:read` | List published policies |
| GET | `/api/v1/handbook/:id` | `handbook:read` | Retrieve a published policy |
| GET | `/api/v1/handbook/manage` | `handbook:update` | List policies, including drafts |
| GET | `/api/v1/handbook/manage/:id` | `handbook:update` | Retrieve a policy, including drafts |
| POST | `/api/v1/handbook` | `handbook:create` | Create a policy |
| PATCH | `/api/v1/handbook/:id` | `handbook:update` | Edit or publish/unpublish a policy |
| POST | `/api/v1/handbook/:id/attachments` | `handbook:update` | Upload a policy file (raw file body, up to 20 MB) |
| GET | `/api/v1/handbook/attachments/:attachmentId` | `handbook:read` | Open an attachment for a published policy |

List endpoints accept `q`, `category`, `page`, and `pageSize` query parameters.
`pageSize` is limited to 100. New articles are drafts unless `isPublished` is
set to `true`. Slugs are generated from the title when omitted and must be
unique. Policy content stores formatted HTML from the editor. Attachments are
stored under `POLICY_UPLOAD_DIR` (defaults to `backend/uploads/policies`) and
are served only to authenticated users with policy access.

## Employee profile photos

`POST /api/v1/employees/:id/profile-photo` accepts a raw PNG, JPG, or WebP image
up to 1 MB. Employees can upload their own photo; users with `employee:update`
can upload for any employee. Authenticated employees can read their own photo,
and users with `employee:read` can view employee photos. Files are stored under
`PROFILE_PHOTO_DIR` (defaults to `backend/uploads/profile-photos`).

Example create request:

```json
{
  "title": "Leave Policy",
  "category": "Policies",
  "summary": "How to request and manage leave.",
  "content": "Submit leave requests through the HR portal.",
  "isPublished": false
}
```
# Office attendance and device security rollout

The migration `20261011090000_office_device_security` creates the Abuja (ABJ) and Lagos (LOS) offices with empty approved-network lists and creates attendance enforcement disabled. Existing employees keep a nullable office assignment until an administrator assigns each employee. New employee records require an active office.

Before enabling enforcement, a Super Admin must enter IPv4/IPv6 addresses or CIDR ranges verified by the office network administrators for every active office. The API validates the ranges and refuses to enable enforcement while any active office is unconfigured. Do not enter example or guessed public IP addresses.

Express trusts forwarded client addresses only from `TRUSTED_PROXY_IPS`, a comma-separated set of proxy IPs/CIDRs. Determine the actual cPanel/Apache proxy addresses with the hosting administrator before setting this value. The default is empty, which means forwarded headers are not trusted. Attendance enforcement remains disabled until office configuration and the proxy address have been verified.

Registered devices are identified by a random 256-bit credential in an HttpOnly cookie; only its SHA-256 verifier is stored. Cookies are Secure in production and use SameSite=Lax. Login transactionally revokes the user's earlier device sessions and refresh tokens before issuing the new session. Super Admin device revocation invalidates existing access tokens on the next request and revokes refresh tokens. Users can request replacement of one registered device, which remains active until a Super Admin approves the request.

Deploy by applying the new Prisma migration and generating the client before starting the TypeScript build. The migration deliberately does not assign existing employees to an office or configure office networks because those facts must be provided by authorized administrators.
