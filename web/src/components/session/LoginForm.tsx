"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, type SessionUser } from "@/components/session/SessionProvider";
import { safeNext } from "@/lib/safe-next";

async function serverMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { message?: string };
    return body.message ?? "No se pudo iniciar sesión.";
  } catch {
    return "No se pudo iniciar sesión.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { establecerUsuario } = useSession();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (error) emailRef.current?.focus();
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError(await serverMessage(response));
        return;
      }

      const body = await response.json() as { user?: SessionUser };
      if (!body.user) {
        setError("No se pudo iniciar sesión.");
        return;
      }
      establecerUsuario(body.user);
      router.replace(safeNext(searchParams.get("next")));
    } catch {
      setError("No se pudo conectar con el servicio. Inténtalo de nuevo.");
    } finally {
      setPassword("");
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-8 grid gap-5" onSubmit={handleSubmit} noValidate>
      {error ? <div role="alert" className="border-[var(--brand-border-width)] border-foreground bg-background p-3 text-sm text-foreground">{error}</div> : null}
      <label className="detail-mono grid gap-2 text-sm font-bold uppercase" htmlFor="login-email">
        Correo
        <input ref={emailRef} id="login-email" type="email" className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
      </label>
      <label className="detail-mono grid gap-2 text-sm font-bold uppercase" htmlFor="login-password">
        Contraseña
        <input id="login-password" type="password" className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
      </label>
      <button type="submit" className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting}>
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
      <p className="detail-mono text-sm text-foreground-soft">¿Primera vez aquí? <a className="font-bold text-accent underline" href="/registro">Crea tu cuenta</a>.</p>
    </form>
  );
}