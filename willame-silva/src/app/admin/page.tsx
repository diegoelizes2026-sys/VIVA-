import type { Metadata } from "next";
import { Painel } from "@/components/admin/painel";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function Admin() {
  return <Painel />;
}
