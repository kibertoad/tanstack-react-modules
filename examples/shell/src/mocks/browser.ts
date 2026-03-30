import { setupWorker } from "msw/browser";
import { registerMockHandlers } from "./handlers.js";

const worker = setupWorker();
registerMockHandlers(worker);

export { worker };
