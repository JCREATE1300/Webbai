import { createServerFn } from "@tanstack/react-start";

export const getMyRole = createServerFn({ method: "GET" }).handler(async () => ({
  isOwner: false,
  roles: [],
}));

export const getOwnerStats = createServerFn({ method: "GET" }).handler(async () => ({
  threadCount: 0,
  messageCount: 0,
  userCount: 0,
  users: [],
}));
