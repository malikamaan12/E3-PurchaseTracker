import { Link } from "wouter";

export function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist</p>
        <Link href="/">
          <a className="text-primary hover:underline">
            Return to Dashboard
          </a>
        </Link>
      </div>
    </div>
  );
}
