# Training Sessions Workspace

A React + TypeScript (Vite) workspace where a trainer can view training sessions, filter them by status, and create new ones. There is no real backend: all API requests go to a mock API built with [MSW](https://mswjs.io/), which runs in development and tests only.

## Requirements

- Node.js 24 or newer
- npm

## Getting started

```bash
npm install
npm run dev
```

Open the URL that Vite prints (usually `http://localhost:5173/`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with the MSW mock API |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint the project with ESLint |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |

> The mock API runs only in development, so a production build (`npm run preview`) has no data source and shows the list error state.

The task documentation (requirements, plan, review, verification and workflow log) is in `src/tasks/1/`.
