"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, type SessionUser } from "@/components/session/SessionProvider";
import { safeNext } from "@/lib/safe-next";

type FieldName = "name" | "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

async function registrationErrors(response: Response): Promise<{ message: string; fields: FieldErrors }> {
  try {
    const body = await response.json() as { message?: string; errors?: Record<string, string[]> };
    const fields: FieldErrors = {};
    for (const field of ["name", "email", "password"] as const) {
      const messages = body.errors?.[field];
      if (messages?.[0]) fields[field] = messages[0];
    }
    const firstError = Object.values(fields)[0];
    return { message: firstError ?? body.message ?? "No se pudo crear la cuenta.", fields };
  } catch {
    return { message: "No se pudo crear la cuenta.", fields: {} };
  }
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { establecerUsuario } = useSession();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const nextDestination = safeNext(searchParams.get("next"));
  const loginHref = nextDestination === "/cuenta"
    ? "/ingresar"
    : `/ingresar?next=${encodeURIComponent(nextDestination)}`;

  useEffect(() => {
    if (fieldErrors.name) nameRef.current?.focus();
    else if (fieldErrors.email) emailRef.current?.focus();
    else if (fieldErrors.password) passwordRef.current?.focus();
    else if (error) nameRef.current?.focus();
  }, [error, fieldErrors]);

   function validate() {
    const nextErrors: FieldErrors = {};
    if (!name.trim() || name.trim().length > 100) nextErrors.name = "El nombre debe tener entre 1 y 100 caracteres.";
    if (!email.trim() || email.trim().length > 256 || !/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Escribe un correo válido de hasta 256 caracteres.";
    if (password.length < 8 || password.length > 128) nextErrors.password = "La contraseña debe tener entre 8 y 128 caracteres.";
    setFieldErrors(nextErrors);
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    if (Object.keys(validate()).length > 0) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      if (!response.ok) {
        const result = await registrationErrors(response);
        setFieldErrors(result.fields);
        setError(result.message);
        return;
      }

      const body = await response.json() as { user?: SessionUser };
      if (!body.user) {
        setError("No se pudo crear la cuenta.");
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
      <label className="detail-mono grid gap-2 text-sm font-bold uppercase" htmlFor="register-name">
        Nombre
        <input ref={nameRef} id="register-name" type="text" maxLength={100} className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "register-name-error" : undefined} />
        {fieldErrors.name ? <span id="register-name-error" className="text-xs font-normal normal-case text-accent">{fieldErrors.name}</span> : null}
      </label>
      <label className="detail-mono grid gap-2 text-sm font-bold uppercase" htmlFor="register-email">
        Correo
        <input ref={emailRef} id="register-email" type="email" maxLength={256} className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "register-email-error" : undefined} />
        {fieldErrors.email ? <span id="register-email-error" className="text-xs font-normal normal-case text-accent">{fieldErrors.email}</span> : null}
      </label>
      <label className="detail-mono grid gap-2 text-sm font-bold uppercase" htmlFor="register-password">
        Contraseña
        <input ref={passwordRef} id="register-password" type="password" minLength={8} maxLength={128} className="border-[var(--brand-border-width)] border-foreground bg-background px-3 py-3 font-normal text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "register-password-error" : undefined} />
        {fieldErrors.password ? <span id="register-password-error" className="text-xs font-normal normal-case text-accent">{fieldErrors.password}</span> : null}
      </label>
      <button type="submit" className="t-button border-[var(--brand-border-width)] border-foreground bg-accent px-4 py-3 font-bold uppercase text-background disabled:cursor-not-allowed disabled:opacity-50" disabled={submitting}>
        {submitting ? "Creando..." : "Crear cuenta"}
      </button>
      <p className="detail-mono text-sm text-foreground-soft">¿Ya tienes cuenta? <Link className="font-bold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={loginHref}>Ingresa aquí</Link>.</p>
    </form>
  );
}