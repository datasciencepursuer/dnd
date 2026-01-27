import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("maps", "routes/maps.tsx"),
  route("playground", "routes/playground.tsx"),
  route("playground/:mapId", "routes/playground.$mapId.tsx"),
  route("api/auth/*", "routes/api.auth.$.tsx"),
  route("api/maps", "routes/api.maps.tsx"),
  route("api/maps/:mapId", "routes/api.maps.$mapId.tsx"),
  route("api/maps/:mapId/share", "routes/api.maps.$mapId.share.tsx"),
  route("api/maps/:mapId/transfer", "routes/api.maps.$mapId.transfer.tsx"),
  route("invite/:token", "routes/invite.$token.tsx"),
] satisfies RouteConfig;
