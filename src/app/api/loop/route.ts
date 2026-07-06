import { withDb } from "@/lib/route-helpers";
import { loopStatus, runLoop } from "@/lib/loop";

export async function GET() {
  return withDb(() => loopStatus());
}

export async function POST() {
  return withDb(() => runLoop("you"));
}
