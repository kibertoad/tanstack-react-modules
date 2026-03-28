import { defineModule } from "@tanstack-react-modules/core";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { AppDependencies, AppSlots } from "@example/app-shared";
import { UserDetailActions } from "./components/UserDetailActions.js";
import { UserDetailPanel } from "./components/UserDetailPanel.js";

export default defineModule<AppDependencies, AppSlots>({
  id: "users",
  version: "0.1.0",

  meta: {
    name: "Users",
    description: "User management and profiles",
    icon: "users",
    category: "admin",
  },

  createRoutes: (parentRoute) => {
    const usersRoot = createRoute({
      getParentRoute: () => parentRoute,
      path: "users",
    });

    const userList = createRoute({
      getParentRoute: () => usersRoot,
      path: "/",
      component: lazyRouteComponent(() => import("./pages/UserList.js")),
    });

    const userDetail = createRoute({
      getParentRoute: () => usersRoot,
      path: "$userId",
      component: lazyRouteComponent(() => import("./pages/UserDetail.js")),
      staticData: {
        headerActions: UserDetailActions,
        detailPanel: UserDetailPanel,
      },
    });

    return usersRoot.addChildren([userList, userDetail]);
  },

  navigation: [{ label: "Users", to: "/users", icon: "users", group: "admin", order: 20 }],

  slots: {
    commands: [{ id: "users:list", label: "View Users", group: "navigate", onSelect: () => {} }],
  },

  requires: ["auth", "httpClient"],
});
