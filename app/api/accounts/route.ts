import { handle } from "@/lib/api";
import { balancesAsOf } from "@/lib/queries";

export const GET = handle(async () => balancesAsOf());
