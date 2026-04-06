import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/overview", label: "Overview" },
  { to: "/keywords", label: "Keywords" },
  { to: "/rank-tracker", label: "Rank Tracker" },
  { to: "/audit", label: "Audit" },
  { to: "/competitors", label: "Competitors" },
  { to: "/backlinks", label: "Backlinks" },
  { to: "/strategy", label: "Strategy" },
];

export function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold text-white">SEOAgent</h1>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded text-sm ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
