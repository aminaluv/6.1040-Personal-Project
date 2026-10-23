import { httpWire } from "@mit-sdg/sync-engine-http/tooling";
import { assembleApplication } from "./src/assembly.ts";
import { policy } from "./src/http.ts";

export default {
  assemble: assembleApplication,
  title: "Novelty",
  wireName: "NoveltyWire",
  design: {
    version: 1,
    documents: [
      new URL("./design/types.md", import.meta.url),
      new URL("./design/compositions/Shelves.md", import.meta.url),
      new URL("./design/compositions/Catalog.md", import.meta.url),
      new URL("./design/compositions/Feed.md", import.meta.url),
      new URL("./design/compositions/Growing.md", import.meta.url),
      new URL("./design/compositions/Sessions.md", import.meta.url),
      new URL("./design/compositions/Profile.md", import.meta.url),
    ],
  },
  projections: [httpWire({ policy, name: "NoveltyWireHttp" })],
};
