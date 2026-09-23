import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "OrgTrace AI", description: "ИИ-аудитор реорганизации" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>;
}
