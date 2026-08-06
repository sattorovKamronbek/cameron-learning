import { redis } from "../index";

export async function enqueueJob(job: any) {
  const payload = JSON.stringify(job);
  await redis.lPush("judge:queue", payload);
}

export async function dequeueJob(timeout = 5) {
  // BRPOP seconds on key returns [key, value] or null
  const res = await redis.brPop("judge:queue", timeout);
  if (!res) return null;
  try {
    return JSON.parse(res.element);
  } catch (err) {
    return null;
  }
}
