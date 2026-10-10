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
