import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

export const policy = httpPolicy({
  basePath: "/api",
  publicErrors: {
    ALREADY_SHELVED: "CONFLICT",
    NOT_SHELVED: "NOT_FOUND",
    ALREADY_SWIPED: "CONFLICT",
    NOT_SWIPED: "NOT_FOUND",
  },
});
