# AZ Consultants — Study Abroad ERP

Professional ERP portal for **AZ Consultants** (Foreign Education Consultants) with branded teal & gold theme, folder-based student workflow, and role-specific dashboards.

## Roles

| Role | Access |
|------|--------|
| **Admin** | Full access — all folders, user management, document approvals, permanent delete |
| **Counselor** | Dashboard stats, student folders, add students, move between stages, upload docs |
| **Student** | Separate portal — view progress timeline, upload documents only |

## Student Workflow (Folders)

```
Queries → Admission Processing → Visa Processing → Satisfied
```

- Counselor adds students in **Queries**
- Moving to next folder creates a copy with all information preserved
- Each folder shows student cards with country, fee status, documents
- Open any student to view details, add notes, upload documents, create ZIP

## Features

- AZ Consultants logo & teal/gold branding throughout
- Country selection: Germany, Lithuania, UK, Scotland, Ireland, Italy, China, Hungary, Cyprus
- Consultancy fee tracking (Not Paid / Half Paid / Paid) with optional notes
- Counselor notes on every student record
- Document upload with **admin approval** workflow
- ZIP archive — select documents and download as ZIP
- Admin-only: add/delete users, approve documents
- Counselor can add students; only admin can permanently delete

## Quick Start

```bash
npm install
cp .env.example .env
# Edit DATABASE_URL and AUTH_SECRET

npm run db:push
npm run db:seed
npm run dev
```

Open **http://localhost:3000**

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@azconsultants.com | admin123 |
| Counselor | counselor@azconsultants.com | counselor123 |
| Student | student@example.com | student123 |

## Project Structure

```
src/app/
├── (dashboard)/
│   ├── dashboard/          # Stats overview
│   ├── students/
│   │   ├── query/          # Queries folder
│   │   ├── admission/      # Admission Processing folder
│   │   ├── visa/           # Visa Processing folder
│   │   ├── satisfied/      # Satisfied folder
│   │   ├── all/            # Total Students
│   │   └── record/[id]/    # Student detail + docs + ZIP
│   ├── approvals/          # Admin document approvals
│   ├── admin/              # User management
│   └── my-portal/          # Student-only portal
└── login/                  # Branded login page
```
