import { Suspense } from "react";
import NearbyPlaces from "@/components/nearby-places";
export const metadata = { title: "Perto de mim · VIVA+" };
export default function Page() { return <Suspense fallback={null}><NearbyPlaces /></Suspense>; }
