"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authFetch } from "@/lib/auth-client";

export interface SessionUser {
  email: string;
  name: string;
  roles: string[];
}

export type SessionStatus = "cargando" | "autenticado" | "anonimo" | "error";

interface SessionContextValue {
  usuario: SessionUser | null;
  estado: SessionStatus;
  establecerUsuario: (usuario: SessionUser) => void;
  cerrarSesión: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<SessionUser | null>(null);
  const [estado, setEstado] = useState<SessionStatus>("cargando");
  const estadoModificado = useRef(false);

  useEffect(() => {
   
    let activo = true;

    async function consultarSesion() {
      try {
        const response = await authFetch("/api/auth/me");
        if (!activo || estadoModificado.current) return;

        if (response.ok) {
          const body = await response.json() as { user?: SessionUser };
          if (!body.user) {
            setEstado("error");
            return;
          }
          setUsuario(body.user);
          setEstado("autenticado");
          return;
        }

        setEstado(response.status === 401 ? "anonimo" : "error");
      } catch {
        if (activo && !estadoModificado.current) setEstado("error");
      }
    }

    void consultarSesion();
    return () => { activo = false; };
  }, []);

  function establecerUsuario(nuevoUsuario: SessionUser) {
    estadoModificado.current = true;
    setUsuario(nuevoUsuario);
    setEstado("autenticado");
  }

  async function cerrarSesión() {
    estadoModificado.current = true;
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // La sesión local se limpia aunque el servidor no responda.
    } finally {
      setUsuario(null);
      setEstado("anonimo");
    }
  }

  return (
    <SessionContext.Provider value={{ usuario, estado, establecerUsuario, cerrarSesión }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe usarse dentro de SessionProvider.");
  return context;
}