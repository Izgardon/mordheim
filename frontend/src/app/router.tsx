import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { routes } from "./routes/routes";

const router = createBrowserRouter(routes);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
