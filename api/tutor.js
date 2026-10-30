import { createTutorHandler } from "../server/tutor.mjs";
import { createSharedReservation } from "../server/shared-budget.mjs";

// These environment variables are read by Vercel's Node function, never Vite's client.
export default createTutorHandler({
  apiKey: process.env.OPENAI_API_KEY,
  reserveRequest: createSharedReservation(),
});
