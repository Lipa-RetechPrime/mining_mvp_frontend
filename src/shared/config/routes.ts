export const routes = {
  home: "/",
  login: "/login",
  dashboard: "/dashboard",
  projects: {
    list: "/projects",
    create: "/projects/new",
    detail: (projectId: string) => `/projects/${projectId}`,
  },
  tenants: {
    list: "/tenants",
    create: "/tenants/new",
    detail: (tenantId: string) => `/tenants/${tenantId}`,
  },
  users: {
    list: "/users",
    create: "/users/new",
    detail: (userId: string) => `/users/${userId}`,
  },
} as const;
