export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[100dvh] min-h-[100svh] w-full max-w-full overflow-hidden">
      {children}
    </div>
  );
}
