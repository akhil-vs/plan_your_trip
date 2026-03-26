import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      plan: "FREE" | "PRO" | "TEAM";
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    plan?: "FREE" | "PRO" | "TEAM";
    isAdmin?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: "FREE" | "PRO" | "TEAM";
    isAdmin?: boolean;
  }
}
