import { LogoutButton } from "./LogoutButton";

interface HeaderProps {
  email: string;
}

export function Header({ email }: HeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-of-neutral-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-of-neutral-500">{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
