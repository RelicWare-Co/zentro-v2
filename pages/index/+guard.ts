import { redirect } from "vike/abort";

export const guard = () => {
  throw redirect("/dashboard", 301);
};
