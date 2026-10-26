// MOCK — Service Worker for development only; started from main.tsx behind import.meta.env.DEV.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
