import { defineModule } from "@tanstack-react-modules/core";
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import type { AppDependencies, AppSlots } from "@example/app-shared";

export default defineModule<AppDependencies, AppSlots>({
  id: "billing",
  version: "0.1.0",

  meta: {
    name: "Billing",
    description: "Manage invoices and billing",
    icon: "credit-card",
    category: "finance",
  },

  createRoutes: (parentRoute) => {
    const billingRoot = createRoute({
      getParentRoute: () => parentRoute,
      path: "billing",
    });

    const billingIndex = createRoute({
      getParentRoute: () => billingRoot,
      path: "/",
      component: lazyRouteComponent(() => import("./pages/BillingDashboard.js")),
    });

    const invoiceList = createRoute({
      getParentRoute: () => billingRoot,
      path: "invoices",
      component: lazyRouteComponent(() => import("./pages/InvoiceList.js")),
    });

    const invoiceDetail = createRoute({
      getParentRoute: () => billingRoot,
      path: "invoices/$invoiceId",
      component: lazyRouteComponent(() => import("./pages/InvoiceDetail.js")),
    });

    return billingRoot.addChildren([billingIndex, invoiceList, invoiceDetail]);
  },

  navigation: [
    { label: "Billing", to: "/billing", icon: "credit-card", group: "finance", order: 10 },
    { label: "Invoices", to: "/billing/invoices", group: "finance", order: 11 },
  ],

  slots: {
    commands: [
      {
        id: "billing:dashboard",
        label: "Open Billing Dashboard",
        group: "navigate",
        onSelect: () => {},
      },
      { id: "billing:invoices", label: "View Invoices", group: "navigate", onSelect: () => {} },
    ],
  },

  requires: ["auth", "httpClient"],
});
