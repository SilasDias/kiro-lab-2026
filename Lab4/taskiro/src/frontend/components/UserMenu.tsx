/**
 * UserMenu — the signed-in account dropdown (R1.13, R3.6, R18.7).
 *
 * Reproduces the prototype's sidebar user footer + popover menu:
 *  - A trigger showing the user's avatar initials (brand-tinted circle) next to
 *    their display name and email, with a chevron affordance.
 *  - A dropdown with "Meu perfil", "Configurações", and a destructive "Sair".
 *
 * The initials come from the canonical `initials` helper (R3.6) applied to the
 * current `user.displayName` from `AuthContext`. "Meu perfil" / "Configurações"
 * are placeholder items matching the prototype, which had no real destinations.
 * "Sair" calls `logout()`, which revokes the session server-side and clears
 * local auth state (R1.13, R18.7).
 *
 * Visuals use the OKLCH theme tokens (primary for the avatar, destructive for
 * "Sair") rather than raw color literals, preserving the prototype's look
 * across light/dark themes. Self-contained: it wraps its own trigger so the app
 * shell (12.1) / Sidebar (11.1) can drop it in directly.
 */

import { ChevronUp, LogOut, Settings, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/state/AuthContext";

export interface UserMenuProps {
  className?: string;
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, logout } = useAuth();

  // Nothing to render when signed out (the app gates on auth elsewhere).
  if (!user) return null;

  const handleLogout = () => {
    // Fire-and-forget: `logout` clears local state even if the revoke fails.
    void logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu do usuário"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className,
          )}
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
              {initials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold text-foreground">
              {user.displayName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
          <ChevronUp className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem>
          <UserIcon />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Settings />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
