export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthenticatedRequest {
  cookies?: Record<string, unknown>;
  authUser?: AuthenticatedUser;
}
