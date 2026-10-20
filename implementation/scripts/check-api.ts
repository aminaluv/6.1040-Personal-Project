import { createHttpClient } from "@mit-sdg/sync-engine-http/client";
import type { NoveltyWireHttp } from "../generated/wire.ts";

const address = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "http://127.0.0.1:3000";
// With --wait, keep trying for 60 seconds. That gives the containers time to start.
const deadline = Date.now() + (process.argv.includes("--wait") ? 60_000 : 0);
const client = createHttpClient<NoveltyWireHttp>({ baseUrl: `${address}/api` });

while (true) {
  const result = await client.shelves.view({
    user: "healthcheck",
    shelf: "UP_NEXT",
  });
  if (!("error" in result)) {
    console.log(
      `The API at ${address} answered. It has ${result.shelf.items.length} reservation(s).`,
    );
    break;
  }
  if (Date.now() > deadline) {
    console.error(`Could not reach the API at ${address}. The client says ${result.error}.`);
    process.exit(1);
  }
  await Bun.sleep(1000);
}
