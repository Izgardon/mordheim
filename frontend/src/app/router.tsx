// routing
import { createBrowserRouter, RouterProvider } from "react-router-dom";

// other
import { routes } from "./routes/routes";

const router = createBrowserRouter(routes);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}




