import type { NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { dashboard } from "@/lib/queries";

export const GET = handle(async (req: NextRequest) => dashboard(req.nextUrl.searchParams.get("range") ?? undefined));
