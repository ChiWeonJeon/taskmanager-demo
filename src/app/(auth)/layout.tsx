export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)]">
      <div className="w-full max-w-md p-8 rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-sm">
        {children}
      </div>
    </div>
  );
}
