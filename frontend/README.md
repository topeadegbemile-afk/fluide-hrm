# Fluidé HRM — Human Resource Management System

A web-based Human Resource Management System built to streamline employee administration, attendance, leave management, performance reviews, and internal collaboration.

**Live Application:** https://hrm.fluidehomes.com

## Features

- **Dashboard:** Overview of HR activities and key information.
- **Employee Management:** Manage employee records and personal information.
- **Attendance Management:** Track employee attendance.
- **Leave Management:** Manage employee leave requests and records.
- **Performance Appraisals:** Support employee performance review workflows.
- **Department Collaboration:** Support communication and task coordination.
- **Roles and Permissions:** Manage user access and responsibilities.
- **Notifications:** Keep users informed about relevant activities.
- **Audit Logs:** Maintain records of relevant system activities.
- **Employee Handbook:** Provide access to workplace information and policies.
- **Organogram:** View organizational structure.
- **Reports:** Access HR-related reports.

## Technology Stack

**Frontend**
- React
- TypeScript
- Vite

**Backend**
- Node.js
- Express.js
- TypeScript and JavaScript

**Database and ORM**
- PostgreSQL
- Prisma ORM

## Project Structure

```text
fluide-hrm/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/topeadegbemile-afk/fluide-hrm.git
cd fluide-hrm
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create your local environment file using the project's environment template, then configure your database connection and other required environment variables.

Review the backend README for the exact configuration and startup commands.

### 3. Set up the frontend

Open another terminal:

```bash
cd frontend
npm install
```

Configure the frontend environment variables using `frontend/.env.example`, then start the development server using the script defined in `frontend/package.json`.

## Environment Variables

Keep credentials and secrets in local `.env` files. Never commit production credentials, database passwords, JWT secrets, or API keys.

Use the provided `.env.example` files as configuration templates.

## Live Demo

Visit: https://hrm.fluidehomes.com

## Development Status

Fluidé HRM is an ongoing project. Features and improvements may be added as development continues.

## Author

**Tope Adegbemile**

GitHub: https://github.com/topeadegbemile-afk

---

Built with a focus on practical HR workflows, maintainability, and continuous improvement.