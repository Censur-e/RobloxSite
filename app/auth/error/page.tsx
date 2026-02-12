import Link from "next/link"
import { Gamepad2 } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10">
          <Gamepad2 className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Authentication Error</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong during authentication. Please try again.
          </p>
        </div>
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to Sign In
        </Link>
      </div>
    </main>
  )
}
