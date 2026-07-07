import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transacties" },
  { href: "/import", label: "Importeren" },
  { href: "/recurring", label: "Terugkerend" },
  { href: "/accounts", label: "Rekeningen" },
  { href: "/categories", label: "Categorieën" },
];

export default function NavBar() {
  return (
    <nav className="border-b bg-white px-4 py-3">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-700 hover:text-blue-600"
            >
              {link.label}
            </Link>
          ))}
        </div>
        <a href="/logout" className="text-sm text-gray-500 hover:text-red-600">
          Uitloggen
        </a>
      </div>
    </nav>
  );
}
