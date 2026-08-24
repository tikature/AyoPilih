import { StepIndicator } from "@/components/step-indicator";

export default function ElectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <StepIndicator />
      <div className="flex-1">{children}</div>
    </div>
  );
}