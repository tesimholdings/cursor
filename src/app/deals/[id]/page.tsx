import { DealClient } from "@/components/DealClient";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealClient id={id} />;
}
