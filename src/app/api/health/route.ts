import { withDb } from "@/lib/route-helpers";
import { systemHealth } from "@/lib/health";

export async function GET() {
  return withDb(() => systemHealth());
}
