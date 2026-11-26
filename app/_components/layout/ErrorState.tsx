import { Button } from "@/app/_components/ui/Button";

export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <main className="app-shell loading-shell loading-card-shell">
      <div className="loading-card error-card" role="alert">
        <strong>Không thể tải workspace</strong>
        <Button variant="secondary" onClick={reset}>
          Thử lại
        </Button>
      </div>
    </main>
  );
}
