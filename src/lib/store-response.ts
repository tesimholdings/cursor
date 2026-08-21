import { NextResponse } from "next/server";
import { storeStatus } from "./store";

// A write to the shared store failed. Report the real error instead of an empty
// 500, so a storage problem is never mistaken for a rejected intake.
export async function storeFailureResponse(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "The shared deal store could not be written.",
      errorName: error instanceof Error ? error.name : undefined,
      storeUnavailable: true,
      persistence: await storeStatus(),
    },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
