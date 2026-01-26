import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("maps", "routes/maps.tsx"),
  route("playground", "routes/playground.tsx"),
  route("playground/:mapId", "routes/playground.$mapId.tsx"),
] satisfies RouteConfig;
