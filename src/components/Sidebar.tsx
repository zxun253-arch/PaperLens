import { NavLink } from "react-router-dom";

const navItems = [
  { label: "论文库", to: "/library" },
  { label: "多论文对比", to: "/compare" },
  { label: "设置", to: "/settings" },
];

export function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-6">
        <p className="text-xl font-semibold text-slate-950">文献透镜</p>
        <p className="mt-1 text-sm font-medium text-cyan-700">PaperLens</p>
        <p className="mt-4 text-sm leading-6 text-slate-500">论文辅助工作台</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "block rounded px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-cyan-50 text-cyan-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-6 py-5">
        <p className="text-xs leading-5 text-slate-500">
          本地优先，AI 可选，帮助你管理、阅读、整理和沉淀学术论文。
        </p>
      </div>
    </aside>
  );
}
