// Domain models for the User Service
// These are internal to this service and should not be shared with other services

export interface User {
  id: string;
  email: string;
  name?: string | null;
  createdAt: Date;
  updatedAt: Date;
}