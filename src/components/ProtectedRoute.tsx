import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  // For now, just render the children without authentication
  return <>{children}</>;
};

export default ProtectedRoute;
